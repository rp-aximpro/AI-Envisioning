import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { type SurveyQuestionType } from './survey-question.entity.js';

@Entity({ name: 'survey_answers' })
export class SurveyAnswer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ name: 'answer_json', type: 'jsonb', nullable: true })
  answerJson!: unknown | null;

  @Column({ name: 'question_key_snapshot', type: 'varchar', length: 100 })
  questionKeySnapshot!: string;

  @Column({ name: 'question_label_snapshot', type: 'text' })
  questionLabelSnapshot!: string;

  @Column({ name: 'question_type_snapshot', type: 'varchar', length: 30 })
  questionTypeSnapshot!: SurveyQuestionType;

  @Column({ name: 'options_json_snapshot', type: 'jsonb', nullable: true })
  optionsJsonSnapshot!: string[] | null;

  @Column({ name: 'display_order_snapshot', type: 'integer' })
  displayOrderSnapshot!: number;
}
