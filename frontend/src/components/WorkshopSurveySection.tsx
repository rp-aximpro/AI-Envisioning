import { Check, Send } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { apiRequest } from '../api.js';
import { type SurveyQuestion, type WorkshopSurvey } from '../types.js';

interface WorkshopSurveySectionProps {
  onCompleted: () => Promise<void>;
  trackingToken: string;
}

type SurveyAnswerValue = boolean | number | string | string[];

function hasAnswer(value: SurveyAnswerValue | undefined): boolean {
  return value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
}

export function WorkshopSurveySection({ onCompleted, trackingToken }: WorkshopSurveySectionProps) {
  const [survey, setSurvey] = useState<WorkshopSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [respondentName, setRespondentName] = useState('');
  const [respondentCompany, setRespondentCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSurvey(null);
    setAnswers({});
    setSubmitted(false);
    setCompleting(false);
    setRespondentName('');
    setRespondentCompany('');
    setError('');
    void apiRequest<WorkshopSurvey>(`/api/tracking/workshops/${trackingToken}/survey`)
      .then((result) => { if (active) setSurvey(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the survey.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [trackingToken]);

  const setAnswer = (questionId: string, value: SurveyAnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!survey) return;
    const missing = survey.questions.find((question) => question.required && !hasAnswer(answers[question.id]));
    if (missing) {
      setError(`Question "${missing.label}" is required.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiRequest<{ id: string; submittedAt: string }>(`/api/tracking/workshops/${trackingToken}/surveys`, {
        method: 'POST',
        data: { answers, respondentCompany, respondentName },
      });
      setAnswers({});
      setRespondentName('');
      setRespondentCompany('');
      setSubmitted(true);
      setSurvey((current) => current ? { ...current, submissionCount: current.submissionCount + 1 } : current);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the survey.');
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setSubmitted(false);
    setError('');
  };

  const completeSurvey = async () => {
    setCompleting(true);
    setError('');
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/mark-survey-complete`, { method: 'POST' });
      await onCompleted();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Unable to complete the survey phase.');
    } finally {
      setCompleting(false);
    }
  };

  const renderQuestion = (question: SurveyQuestion): ReactNode => {
    const value = answers[question.id];
    const requiredLabel = question.required ? <span className="survey-required">Required</span> : null;
    if (question.questionType === 'short_text') {
      return <label className="survey-text-question" key={question.id}>{question.label}{requiredLabel}<input type="text" maxLength={500} required={question.required} value={typeof value === 'string' ? value : ''} onChange={(event) => setAnswer(question.id, event.target.value)} /></label>;
    }
    if (question.questionType === 'long_text') {
      return <label className="survey-text-question" key={question.id}>{question.label}{requiredLabel}<textarea rows={4} maxLength={10000} required={question.required} value={typeof value === 'string' ? value : ''} onChange={(event) => setAnswer(question.id, event.target.value)} /></label>;
    }
    if (question.questionType === 'rating') {
      return <fieldset className="survey-question" key={question.id}><legend>{question.label}{requiredLabel}</legend><div className="survey-options survey-rating-options">{[1, 2, 3, 4, 5].map((rating) => <label key={rating}><input type="radio" name={question.id} required={question.required} checked={value === rating} onChange={() => setAnswer(question.id, rating)} /><span>{rating}</span></label>)}</div><span className="survey-scale-labels"><span>Low</span><span>High</span></span></fieldset>;
    }
    if (question.questionType === 'yes_no') {
      const options: Array<{ label: string; value: boolean }> = [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ];
      return <fieldset className="survey-question" key={question.id}><legend>{question.label}{requiredLabel}</legend><div className="survey-options">{options.map(({ label, value: answer }) => <label key={String(answer)}><input type="radio" name={question.id} required={question.required} checked={value === answer} onChange={() => setAnswer(question.id, answer)} /><span>{label}</span></label>)}</div></fieldset>;
    }
    const options = question.options ?? [];
    if (question.questionType === 'single_choice') {
      return <fieldset className="survey-question" key={question.id}><legend>{question.label}{requiredLabel}</legend><div className="survey-options">{options.map((option) => <label key={option}><input type="radio" name={question.id} required={question.required} checked={value === option} onChange={() => setAnswer(question.id, option)} /><span>{option}</span></label>)}</div></fieldset>;
    }
    const selected = Array.isArray(value) ? value : [];
    return <fieldset className="survey-question" key={question.id}><legend>{question.label}{requiredLabel}</legend><div className="survey-options">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setAnswer(question.id, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
  };

  return (
    <section className="tracking-section workshop-survey" aria-labelledby="survey-title">
      <h2 id="survey-title">Post-workshop survey</h2>
      {loading ? <p>Loading survey...</p> : error && !survey ? <p className="tracking-error" role="alert">{error}</p> : null}
      {!loading && survey?.isCompleted ? <p>Survey phase completed. New responses are closed.</p> : null}
      {!loading && survey && !survey.isCompleted && survey.questions.length === 0 ? <p>No active survey questions.</p> : null}
      {submitted ? <div className="survey-success" role="status"><p>Response submitted. Thank you.</p><button className="text-button" type="button" onClick={startAnother}>Submit another response</button></div> : null}
      {error && survey ? <p className="tracking-error" role="alert">{error}</p> : null}
      {!loading && survey && !survey.isCompleted && survey.questions.length > 0 && !submitted ? (
        <form className="survey-form" onSubmit={(event) => void submit(event)}>
          <div className="survey-respondent-fields">
            <label>Your name<input autoComplete="name" maxLength={150} value={respondentName} onChange={(event) => setRespondentName(event.target.value)} /></label>
            <label>Company<input autoComplete="organization" maxLength={200} value={respondentCompany} onChange={(event) => setRespondentCompany(event.target.value)} /></label>
          </div>
          {survey.questions.map(renderQuestion)}
          <button className="primary-button" type="submit" disabled={submitting || completing}><Send size={16} /> {submitting ? 'Submitting...' : 'Submit response'}</button>
        </form>
      ) : null}
      {!loading && survey && !survey.isCompleted && survey.submissionCount > 0 ? <div className="survey-complete-action"><span>{survey.submissionCount} response{survey.submissionCount === 1 ? '' : 's'} submitted</span><button className="secondary-button" type="button" onClick={() => void completeSurvey()} disabled={completing || submitting}><Check size={16} /> {completing ? 'Completing...' : 'Mark survey complete'}</button></div> : null}
    </section>
  );
}
