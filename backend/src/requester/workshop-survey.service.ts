import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';

import { AppError } from '../common/errors/app-error.js';
import { SurveyAnswer } from '../database/entities/survey-answer.entity.js';
import { SurveyQuestion, type SurveyQuestionType } from '../database/entities/survey-question.entity.js';
import { SurveySubmission } from '../database/entities/survey-submission.entity.js';
import { Workshop, WorkshopStatus } from '../database/entities/workshop.entity.js';
import { TrackingSessionService, type TrackingIdentity } from './tracking-session.service.js';

export interface ActiveSurveyQuestion {
  displayOrder: number;
  id: string;
  key: string;
  label: string;
  options: string[] | null;
  questionType: SurveyQuestionType;
  required: boolean;
}

export interface WorkshopSurvey {
  isCompleted: boolean;
  questions: ActiveSurveyQuestion[];
  submissionCount: number;
}

export interface SurveySubmissionInput {
  answers: Record<string, unknown>;
  respondentCompany?: string | null;
  respondentName?: string | null;
}

export interface SurveySubmissionResult {
  id: string;
  submittedAt: string;
}

@Injectable()
export class WorkshopSurveyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Workshop) private readonly workshopRepository: Repository<Workshop>,
    @InjectRepository(SurveyQuestion) private readonly questionRepository: Repository<SurveyQuestion>,
    @InjectRepository(SurveySubmission) private readonly submissionRepository: Repository<SurveySubmission>,
    @Inject(TrackingSessionService) private readonly trackingSessions: TrackingSessionService,
  ) {}

  async getSurvey(trackingToken: string, sessionToken: string | undefined): Promise<WorkshopSurvey> {
    const { workshop } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    this.requireSurveyPhase(workshop.status);
    const [questions, submissionCount] = await Promise.all([
      this.questionRepository.find({ order: { displayOrder: 'ASC', key: 'ASC' }, where: { active: true } }),
      this.submissionRepository.count({ where: { workshopId: workshop.id } }),
    ]);
    return {
      isCompleted: workshop.surveyCompletedAt !== null,
      questions: questions.map((question) => this.toActiveQuestion(question)),
      submissionCount,
    };
  }

  async submitSurvey(
    trackingToken: string,
    sessionToken: string | undefined,
    input: SurveySubmissionInput,
  ): Promise<SurveySubmissionResult> {
    const { workshop, identity } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    this.requireSurveyPhase(workshop.status);
    this.requireSurveyOpen(workshop.surveyCompletedAt);
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, {
        lock: { mode: 'pessimistic_write' },
        where: { id: workshop.id },
      });
      if (!locked) throw AppError.notFound('Workshop not found.');
      this.requireSurveyPhase(locked.status);
      this.requireSurveyOpen(locked.surveyCompletedAt);
      const questions = await runner.manager.find(SurveyQuestion, {
        order: { displayOrder: 'ASC', key: 'ASC' },
        where: { active: true },
      });
      if (questions.length === 0) throw AppError.badRequest('There is no active survey to submit.');

      const questionIds = new Set(questions.map((question) => question.id));
      if (Object.keys(input.answers).some((questionId) => !questionIds.has(questionId))) {
        throw AppError.badRequest('The survey changed. Reload the page and try again.');
      }

      const validAnswers: Array<{ question: SurveyQuestion; value: unknown }> = [];
      for (const question of questions) {
        const value = input.answers[question.id];
        const empty = this.isEmpty(value);
        if (empty) {
          if (question.required) throw AppError.badRequest(`Question "${question.label}" is required.`);
          validAnswers.push({ question, value: null });
          continue;
        }
        validAnswers.push({ question, value: this.validateAnswer(question, value) });
      }

      const submission = await runner.manager.save(runner.manager.create(SurveySubmission, {
        respondentCompany: this.optionalText(input.respondentCompany),
        respondentName: this.optionalText(input.respondentName),
        submittedByEmail: identity.email,
        workshopId: workshop.id,
      }));
      if (validAnswers.length > 0) {
        await runner.manager.save(validAnswers.map(({ question, value }) => runner.manager.create(SurveyAnswer, {
          answerJson: value,
          displayOrderSnapshot: question.displayOrder,
          optionsJsonSnapshot: question.optionsJson,
          questionId: question.id,
          questionKeySnapshot: question.key,
          questionLabelSnapshot: question.label,
          questionTypeSnapshot: question.questionType,
          submissionId: submission.id,
        })));
      }
      await runner.commitTransaction();
      return { id: submission.id, submittedAt: submission.submittedAt.toISOString() };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async markSurveyComplete(trackingToken: string, sessionToken: string | undefined): Promise<void> {
    const { identity, workshop } = await this.getAuthorizedWorkshop(trackingToken, sessionToken);
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const locked = await runner.manager.findOne(Workshop, {
        lock: { mode: 'pessimistic_write' },
        where: { id: workshop.id },
      });
      if (!locked) throw AppError.notFound('Workshop not found.');
      this.requireSurveyPhase(locked.status);
      this.requireSurveyOpen(locked.surveyCompletedAt);

      const submissionCount = await runner.manager.count(SurveySubmission, { where: { workshopId: locked.id } });
      if (submissionCount === 0) throw AppError.badRequest('Submit at least one survey response before completing this phase.');

      locked.surveyCompletedAt = new Date();
      locked.surveyCompletedByEmail = identity.email;
      await runner.manager.save(locked);
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async getAuthorizedWorkshop(
    trackingToken: string,
    sessionToken: string | undefined,
  ): Promise<{ identity: TrackingIdentity; workshop: Workshop }> {
    const workshop = await this.workshopRepository.findOne({ where: { trackingToken } });
    if (!workshop) throw AppError.notFound('Workshop not found.');
    const identity = await this.trackingSessions.getIdentity(sessionToken, workshop.id);
    if (!identity || identity.domain !== workshop.creatorDomain) throw AppError.unauthorized();
    return { identity, workshop };
  }

  private requireSurveyPhase(status: WorkshopStatus): void {
    if (status !== WorkshopStatus.FollowUp && status !== WorkshopStatus.Completed) {
      throw AppError.badRequest('The survey is available during follow-up.');
    }
  }

  private requireSurveyOpen(completedAt: Date | null): void {
    if (completedAt !== null) throw AppError.badRequest('The survey has already been marked complete.');
  }

  private toActiveQuestion(question: SurveyQuestion): ActiveSurveyQuestion {
    return {
      displayOrder: question.displayOrder,
      id: question.id,
      key: question.key,
      label: question.label,
      options: question.optionsJson,
      questionType: question.questionType,
      required: question.required,
    };
  }

  private validateAnswer(question: SurveyQuestion, value: unknown): unknown {
    switch (question.questionType) {
      case 'short_text':
      case 'long_text': {
        if (typeof value !== 'string') throw AppError.badRequest(`Question "${question.label}" must be text.`);
        const answer = value.trim();
        const maxLength = question.questionType === 'short_text' ? 500 : 10_000;
        if (!answer || answer.length > maxLength) throw AppError.badRequest(`Question "${question.label}" has an invalid response.`);
        return answer;
      }
      case 'rating':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
          throw AppError.badRequest(`Question "${question.label}" must be a rating from 1 to 5.`);
        }
        return value;
      case 'single_choice': {
        const options = this.choiceOptions(question);
        if (typeof value !== 'string' || !options.includes(value)) {
          throw AppError.badRequest(`Select a valid option for question "${question.label}".`);
        }
        return value;
      }
      case 'multi_choice': {
        const options = this.choiceOptions(question);
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !options.includes(item)) || new Set(value).size !== value.length) {
          throw AppError.badRequest(`Select valid options for question "${question.label}".`);
        }
        return value;
      }
      case 'yes_no':
        if (typeof value !== 'boolean') throw AppError.badRequest(`Question "${question.label}" must be answered yes or no.`);
        return value;
      default:
        throw AppError.badRequest('A survey question has an unsupported type.');
    }
  }

  private choiceOptions(question: SurveyQuestion): string[] {
    if (!Array.isArray(question.optionsJson) || question.optionsJson.length === 0 || question.optionsJson.some((option) => typeof option !== 'string') || new Set(question.optionsJson).size !== question.optionsJson.length) {
      throw AppError.badRequest(`The options for question "${question.label}" are not configured correctly.`);
    }
    return question.optionsJson;
  }

  private isEmpty(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
