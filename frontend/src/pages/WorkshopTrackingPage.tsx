import { Check, Download, LogOut, Send, Upload } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest, apiUrl } from '../api.js';
import { WorkshopOutcomeSection } from '../components/WorkshopOutcomeSection.js';
import { WorkshopSurveySection } from '../components/WorkshopSurveySection.js';
import { type WorkshopTracking } from '../types.js';

function formatPlannedDate(workshop: WorkshopTracking): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: workshop.timezone,
  }).format(new Date(workshop.plannedStartAt));
}

function formatFunding(workshop: WorkshopTracking): string {
  if (!workshop.fundingRequired) return 'No funding requested';
  if (workshop.requestedFundingAmount === null) return 'Amount not specified';
  return new Intl.NumberFormat(undefined, {
    currency: workshop.currencyCode,
    style: 'currency',
  }).format(Number(workshop.requestedFundingAmount));
}

function statusLabel(status: WorkshopTracking['status']): string {
  return status.replaceAll('_', ' ');
}

export function WorkshopTrackingPage() {
  const { trackingToken = '' } = useParams();
  const [workshop, setWorkshop] = useState<WorkshopTracking | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [actualAttendees, setActualAttendees] = useState('');
  const [executionNotes, setExecutionNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [additionalProofFiles, setAdditionalProofFiles] = useState<File[]>([]);

  useEffect(() => {
    let active = true;
    setCheckingSession(true);
    setWorkshop(null);
    setCodeSent(false);
    setCode('');
    setNotice('');
    setError('');
    setProofFiles([]);
    setAdditionalProofFiles([]);
    setActualAttendees('');
    setExecutionNotes('');
    void apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`)
      .then((details) => { if (active) setWorkshop(details); })
      .catch(() => { if (active) setWorkshop(null); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [trackingToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!codeSent) {
        const result = await apiRequest<{ message: string }>(`/api/public/workshops/${trackingToken}/send-otp`, {
          method: 'POST',
          data: { email },
        });
        setCodeSent(true);
        setNotice(result.message);
      } else {
        await apiRequest<{ domain: string; email: string }>(`/api/public/workshops/${trackingToken}/verify-otp`, {
          method: 'POST',
          data: { code, email },
        });
        const details = await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`);
        setWorkshop(details);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to verify this email.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await apiRequest<void>('/api/tracking/logout', { method: 'POST' });
      setWorkshop(null);
      setCodeSent(false);
      setCode('');
      setNotice('');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to end this session.');
    } finally {
      setBusy(false);
    }
  };

  const markPlannedComplete = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/mark-executed`, { method: 'POST' });
      setWorkshop(await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`));
      setNotice('Planned phase completed. Submit attendance and proof after the workshop.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the workshop phase.');
    } finally {
      setBusy(false);
    }
  };

  const submitExecution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData();
    form.append('actualAttendees', actualAttendees);
    form.append('notes', executionNotes);
    proofFiles.forEach((file) => form.append('files', file));
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/execution`, {
        method: 'POST',
        data: form,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setWorkshop(await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`));
      setNotice('Execution details and proof saved. Mark the Executed phase complete when ready.');
      setProofFiles([]);
      setActualAttendees('');
      setExecutionNotes('');
      formElement.reset();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to submit execution details.');
    } finally {
      setBusy(false);
    }
  };

  const addProofFiles = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData();
    additionalProofFiles.forEach((file) => form.append('files', file));
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/execution/files`, {
        method: 'POST',
        data: form,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setWorkshop(await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`));
      setAdditionalProofFiles([]);
      formElement.reset();
      setNotice('Additional proof files uploaded.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to add proof files.');
    } finally {
      setBusy(false);
    }
  };

  const markExecutedComplete = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/mark-executed-complete`, { method: 'POST' });
      setWorkshop(await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`));
      setNotice('Executed phase completed. The workshop is now in follow-up.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to complete the Executed phase.');
    } finally {
      setBusy(false);
    }
  };

  const refreshTrackingDetails = async () => {
    setWorkshop(await apiRequest<WorkshopTracking>(`/api/tracking/workshops/${trackingToken}`));
    setError('');
    setNotice('');
  };

  return (
    <div className="tracking-page">
      <header className="workshop-brand-header tracking-header">
        <Link className="workshop-brand-lockup" to="/" aria-label="AI Envisioning Workshops home">
          <span>Dell Technologies</span><span className="brand-divider" aria-hidden="true" />
          <span className="microsoft-lockup"><img src="/brands/microsoft-mark.svg" alt="" />Microsoft</span>
        </Link>
        {workshop ? <div className="tracking-session"><span>{workshop.creatorEmail}</span><button type="button" className="icon-button" onClick={() => void logout()} disabled={busy} aria-label="Log out" title="Log out"><LogOut size={18} /></button></div> : null}
      </header>

      {checkingSession ? <main className="tracking-auth"><p>Checking access...</p></main> : workshop ? (
        <>
          <section className="tracking-hero">
            <div className="tracking-content">
              <p className="workshop-eyebrow">Workshop tracking</p>
              <p className="tracking-code">{workshop.workshopCode}</p>
              <h1>{workshop.customerName}</h1>
              <p className="tracking-subtitle">Requested by {workshop.creatorName} · {workshop.requesterRole.toUpperCase()}</p>
              <div className={`tracking-status status-${workshop.status}`}><span>Current phase</span><strong>{statusLabel(workshop.status)}</strong></div>
            </div>
          </section>
          <main className="tracking-content tracking-dashboard">
            <section className="tracking-section" aria-labelledby="timeline-title">
              <h2 id="timeline-title">Lifecycle</h2>
              <ol className="lifecycle-timeline">
                {workshop.timeline.map((item) => (
                  <li className={`timeline-${item.state}`} key={item.label}>
                    <span className="timeline-marker" aria-hidden="true" />
                    <div><strong>{item.label}</strong>{item.date ? <time dateTime={item.date}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.date))}</time> : null}</div>
                  </li>
                ))}
              </ol>
            </section>

            {workshop.status === 'declined' ? (
              <section className="decline-reason" aria-labelledby="decline-title"><h2 id="decline-title">Decline reason</h2><p>{workshop.declineReason || 'No reason was provided.'}</p></section>
            ) : null}

            {notice ? <p className="tracking-notice" role="status">{notice}</p> : null}
            {error ? <p className="tracking-error" role="alert">{error}</p> : null}

            {workshop.status === 'planned' ? (
              <section className="tracking-action" aria-labelledby="planned-action-title">
                <div><h2 id="planned-action-title">Planned phase</h2><p>When the workshop is ready to move into execution, mark this phase complete.</p></div>
                <button className="primary-button" type="button" onClick={() => void markPlannedComplete()} disabled={busy}><Check size={17} /> Mark Planned complete</button>
              </section>
            ) : null}

            {workshop.status === 'executed' && !workshop.execution ? (
              <section className="tracking-action" aria-labelledby="execution-form-title">
                <div><h2 id="execution-form-title">Submit execution details</h2><p>Include the actual attendee count and at least one proof file{workshop.proofOverride ? ', unless waived by an administrator' : ''}.</p></div>
                <form className="execution-form" onSubmit={(event) => void submitExecution(event)}>
                  <label>Actual attendees<input type="number" min="0" max="999999" step="1" required value={actualAttendees} onChange={(event) => setActualAttendees(event.target.value)} /></label>
                  <label>Execution notes<textarea rows={4} maxLength={10000} value={executionNotes} onChange={(event) => setExecutionNotes(event.target.value)} /></label>
                  <label className="proof-file-field">Proof files <span>{workshop.proofOverride ? 'Optional: an administrator recorded a proof waiver.' : 'JPEG, PNG, or PDF; select one or more.'}</span><input type="file" accept="image/jpeg,image/png,application/pdf" multiple required={!workshop.proofOverride} onChange={(event) => setProofFiles(Array.from(event.target.files ?? []))} /></label>
                  {proofFiles.length ? <ul className="selected-files">{proofFiles.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}</ul> : null}
                  <button className="primary-button" type="submit" disabled={busy || (proofFiles.length === 0 && !workshop.proofOverride)}><Upload size={17} /> {busy ? 'Submitting...' : 'Submit execution'}</button>
                </form>
              </section>
            ) : null}

            {workshop.execution && workshop.status === 'executed' ? (
              <section className="tracking-section" aria-labelledby="execution-summary-title">
                <h2 id="execution-summary-title">Execution summary</h2>
                <dl className="tracking-details">
                  <div><dt>Actual attendees</dt><dd>{workshop.execution.actualAttendees}</dd></div>
                  <div><dt>Submitted</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(workshop.execution.submittedAt))}</dd></div>
                  <div className="details-wide"><dt>Execution notes</dt><dd>{workshop.execution.notes || 'No notes provided.'}</dd></div>
                </dl>
                {workshop.proofOverride && workshop.files.length === 0 ? <p className="proof-waiver-note">Proof waived by {workshop.proofOverride.email}: {workshop.proofOverride.reason}</p> : null}
                <ul className="workshop-proof-list">{workshop.files.map((file) => <li key={file.id}><span>{file.originalFilename}</span><a className="secondary-button" href={apiUrl(`/api/tracking/workshops/${trackingToken}/files/${file.id}/download`)}><Download size={16} /> Download</a></li>)}</ul>
                {workshop.status === 'executed' ? <div className="tracking-action execution-complete-action"><div><h2>Executed phase</h2><p>Once execution details and required proof are ready, complete this phase to continue to follow-up.</p></div><button className="primary-button" type="button" onClick={() => void markExecutedComplete()} disabled={busy}><Check size={17} /> Mark Executed complete</button></div> : null}
                {workshop.status === 'executed' ? <form className="execution-form additional-proof-form" onSubmit={(event) => void addProofFiles(event)}>
                  <label className="proof-file-field">Add proof files <span>JPEG, PNG, or PDF; select one or more.</span><input type="file" accept="image/jpeg,image/png,application/pdf" multiple required onChange={(event) => setAdditionalProofFiles(Array.from(event.target.files ?? []))} /></label>
                  {additionalProofFiles.length ? <ul className="selected-files">{additionalProofFiles.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}</ul> : null}
                  <button className="secondary-button" type="submit" disabled={busy || additionalProofFiles.length === 0}><Upload size={16} /> {busy ? 'Uploading...' : 'Add files'}</button>
                </form> : null}
              </section>
            ) : null}
            {workshop.proofOverride && !workshop.execution && workshop.status === 'executed' ? <section className="tracking-section"><h2>Proof waiver</h2><p className="proof-waiver-note">{workshop.proofOverride.reason} ({workshop.proofOverride.email})</p></section> : null}

            {(workshop.status === 'follow_up' || workshop.status === 'completed') && !workshop.surveyCompletedAt ? <WorkshopSurveySection trackingToken={trackingToken} onCompleted={refreshTrackingDetails} /> : null}
            {workshop.surveyCompletedAt ? <section className="tracking-section" aria-labelledby="survey-completed-title"><h2 id="survey-completed-title">Post-workshop survey</h2><p>Survey marked complete on {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(workshop.surveyCompletedAt))}.</p></section> : null}
            {workshop.status === 'follow_up' || workshop.status === 'completed' ? <WorkshopOutcomeSection trackingToken={trackingToken} workshop={workshop} onCompleted={refreshTrackingDetails} /> : null}

            <section className="tracking-section" aria-labelledby="workshop-details-title">
              <h2 id="workshop-details-title">Workshop details</h2>
              <dl className="tracking-details">
                <div><dt>Requester</dt><dd>{workshop.creatorName} <span>({workshop.creatorEmail})</span></dd></div>
                <div><dt>Role</dt><dd>{workshop.requesterRole.toUpperCase()}</dd></div>
                <div><dt>Customer</dt><dd>{workshop.customerName}</dd></div>
                <div><dt>Country</dt><dd>{workshop.countryName}</dd></div>
                <div><dt>Location / venue</dt><dd>{workshop.location}</dd></div>
                <div><dt>Scheduled</dt><dd>{formatPlannedDate(workshop)}</dd></div>
                <div><dt>Duration</dt><dd>{workshop.durationMinutes / 60} hours</dd></div>
                <div><dt>Estimated attendees</dt><dd>{workshop.estimatedAttendees}</dd></div>
                <div><dt>Execution support</dt><dd>{workshop.executionSupportRequired ? workshop.executionSupportDetails ?? 'Required' : 'No support needed'}</dd></div>
                <div><dt>Funding</dt><dd>{formatFunding(workshop)}</dd></div>
                <div className="details-wide"><dt>Context / objectives</dt><dd>{workshop.description || 'No additional context provided.'}</dd></div>
              </dl>
            </section>
          </main>
        </>
      ) : (
        <main className="tracking-auth" aria-labelledby="tracking-auth-title">
          <p className="eyebrow">Secure workshop access</p>
          <h1 id="tracking-auth-title">Verify your work email</h1>
          <p className="page-lede">Enter an email address from the workshop requester's company domain. A verification code is required to view workshop details.</p>
          <form className="form-grid access-form" onSubmit={(event) => void submit(event)}>
            <label>Work email<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={codeSent || busy} required /></label>
            {codeSent ? <label>Verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label> : null}
            {notice ? <p className="form-message" role="status">{notice}</p> : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait...' : codeSent ? 'Verify and view workshop' : 'Send verification code'} <Send size={17} aria-hidden="true" /></button>
            {codeSent ? <button className="text-button" type="button" onClick={() => { setCodeSent(false); setCode(''); setNotice(''); setError(''); }}>Use a different email</button> : null}
          </form>
        </main>
      )}
      <footer className="workshop-footer"><span>AI Envisioning Workshops · Dell Technologies &amp; Microsoft</span><Link to="/">Home</Link></footer>
    </div>
  );
}
