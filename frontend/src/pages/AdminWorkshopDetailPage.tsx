import { ArrowLeft, Check, Download, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest, apiUrl } from '../api.js';
import { type AdminReviewResult, type AdminWorkshopDetail, type WorkshopStatus } from '../types.js';

function displayStatus(status: WorkshopStatus): string {
  return status.replaceAll('_', ' ');
}

function dateTime(value: string, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    ...(timezone ? { timeZone: timezone, timeStyle: 'short' as const } : {}),
  }).format(new Date(value));
}

function amount(value: string | null, currency: string): string {
  if (value === null) return 'Not specified';
  return new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format(Number(value));
}

function deliveryMessage(mode: AdminReviewResult['emailDeliveryMode']): string {
  if (mode === 'sent') return 'Decision saved and email sent to the requester.';
  if (mode === 'logged') return 'Decision saved and email content logged locally.';
  return 'Decision saved, but the email could not be delivered.';
}

export function AdminWorkshopDetailPage() {
  const { id = '' } = useParams();
  const [workshop, setWorkshop] = useState<AdminWorkshopDetail | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [proofOverrideReason, setProofOverrideReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setShowDecline(false);
    void apiRequest<AdminWorkshopDetail>(`/api/admin/workshops/${id}`)
      .then((details) => {
        if (!active) return;
        setWorkshop(details);
        setApprovedAmount(details.requestedFundingAmount ?? '');
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this workshop.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const approve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<AdminReviewResult>(`/api/admin/workshops/${id}/approve`, {
        method: 'POST',
        data: workshop?.fundingRequired ? { approvedFundingAmount: Number(approvedAmount) } : {},
      });
      setWorkshop(result.workshop);
      setNotice(deliveryMessage(result.emailDeliveryMode));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to approve this workshop.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<AdminReviewResult>(`/api/admin/workshops/${id}/decline`, {
        method: 'POST',
        data: { reason: declineReason },
      });
      setWorkshop(result.workshop);
      setShowDecline(false);
      setNotice(deliveryMessage(result.emailDeliveryMode));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to decline this workshop.');
    } finally {
      setBusy(false);
    }
  };

  const waiveProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<AdminWorkshopDetail>(`/api/admin/workshops/${id}/execution-proof-override`, {
        method: 'POST',
        data: { reason: proofOverrideReason },
      });
      setWorkshop(result);
      setProofOverrideReason('');
      setNotice('Proof upload waived. The reason and admin identity have been recorded.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to record the proof waiver.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="admin-content"><p>Loading workshop...</p></main>;
  if (!workshop) return <main className="admin-content"><p className="admin-error" role="alert">{error || 'Workshop not found.'}</p><Link className="back-link" to="/admin/workshops"><ArrowLeft size={16} /> Back to queue</Link></main>;

  return (
    <main className="admin-content">
      <Link className="admin-back-link" to="/admin/workshops"><ArrowLeft size={16} aria-hidden="true" /> Workshop queue</Link>
      <div className="admin-detail-heading"><div><p className="eyebrow">{workshop.workshopCode}</p><h1>{workshop.customerName}</h1><p>{workshop.creatorName} - {workshop.creatorEmail} - {workshop.requesterRole.toUpperCase()}</p></div><span className={`admin-status status-${workshop.status}`}>{displayStatus(workshop.status)}</span></div>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      {workshop.status === 'pending_review' ? (
        <section className="admin-review-actions" aria-labelledby="review-actions-title">
          <div><h2 id="review-actions-title">Review request</h2><p>Approval or decline can only be submitted once while this request is pending review.</p></div>
          <form className="admin-approve-form" onSubmit={(event) => void approve(event)}>
            {workshop.fundingRequired ? <label>Approved amount ({workshop.currencyCode})<input type="number" min="0" max="99999999999.99" step="0.01" value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} required /></label> : null}
            <button type="submit" className="primary-button" disabled={busy}><Check size={17} /> Approve and plan</button>
          </form>
          {showDecline ? <form className="admin-decline-form" onSubmit={(event) => void decline(event)}><label>Reason for decline<textarea rows={3} maxLength={5000} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} required /></label><div><button type="submit" className="danger-button" disabled={busy}><X size={17} /> Confirm decline</button><button type="button" className="text-button" onClick={() => setShowDecline(false)}>Cancel</button></div></form> : <button type="button" className="danger-outline-button" onClick={() => setShowDecline(true)} disabled={busy}>Decline request</button>}
        </section>
      ) : null}

      <section className="admin-detail-section" aria-labelledby="request-details-title">
        <h2 id="request-details-title">Request details</h2>
        <dl className="admin-detail-grid">
          <div><dt>Requester</dt><dd>{workshop.creatorName}</dd></div><div><dt>Email</dt><dd>{workshop.creatorEmail}</dd></div>
          <div><dt>Creator domain</dt><dd>{workshop.creatorDomain}</dd></div><div><dt>Role</dt><dd>{workshop.requesterRole.toUpperCase()}</dd></div>
          <div><dt>Customer</dt><dd>{workshop.customerName}</dd></div><div><dt>Country</dt><dd>{workshop.countryName} ({workshop.countryCode})</dd></div>
          <div><dt>Location / venue</dt><dd>{workshop.location}</dd></div><div><dt>Planned date</dt><dd>{dateTime(workshop.plannedStartAt, workshop.timezone)}</dd></div>
          <div><dt>Timezone</dt><dd>{workshop.timezone}</dd></div><div><dt>Duration</dt><dd>{workshop.durationMinutes / 60} hours</dd></div>
          <div><dt>Estimated attendees</dt><dd>{workshop.estimatedAttendees}</dd></div><div><dt>Execution support</dt><dd>{workshop.executionSupportRequired ? workshop.executionSupportDetails ?? 'Required' : 'No support needed'}</dd></div>
          <div><dt>Funding requested</dt><dd>{workshop.fundingRequired ? amount(workshop.requestedFundingAmount, workshop.currencyCode) : 'No funding requested'}</dd></div>
          {workshop.approvedFundingAmount !== null ? <div><dt>Funding approved</dt><dd>{amount(workshop.approvedFundingAmount, workshop.currencyCode)}</dd></div> : null}
          <div><dt>Created</dt><dd>{dateTime(workshop.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{dateTime(workshop.updatedAt)}</dd></div>
          {workshop.approvedAt ? <div><dt>Approved</dt><dd>{dateTime(workshop.approvedAt)}</dd></div> : null}
          {workshop.declinedAt ? <div><dt>Declined</dt><dd>{dateTime(workshop.declinedAt)}</dd></div> : null}
          {workshop.completedAt ? <div><dt>Completed</dt><dd>{dateTime(workshop.completedAt)}</dd></div> : null}
          <div className="admin-detail-wide"><dt>Context / objectives</dt><dd>{workshop.description || 'No additional context provided.'}</dd></div>
          {workshop.declineReason ? <div className="admin-detail-wide"><dt>Decline reason</dt><dd>{workshop.declineReason}</dd></div> : null}
        </dl>
      </section>

      {workshop.execution || workshop.files.length ? (
        <section className="admin-detail-section" aria-labelledby="execution-title">
          <h2 id="execution-title">Execution</h2>
          {workshop.execution ? <dl className="admin-detail-grid">
            <div><dt>Actual attendees</dt><dd>{workshop.execution.actualAttendees}</dd></div>
            <div><dt>Submitted</dt><dd>{dateTime(workshop.execution.submittedAt)}</dd></div>
            <div><dt>Submitted by</dt><dd>{workshop.execution.submittedByEmail}</dd></div>
            <div className="admin-detail-wide"><dt>Notes</dt><dd>{workshop.execution.notes || 'No notes provided.'}</dd></div>
          </dl> : null}
          {workshop.files.length ? <ul className="workshop-proof-list">{workshop.files.map((file) => <li key={file.id}><span>{file.originalFilename}</span><a className="secondary-button" href={apiUrl(`/api/admin/workshops/${id}/files/${file.id}/download`)}><Download size={16} /> Download</a></li>)}</ul> : <p className="admin-muted">No proof files uploaded.</p>}
        </section>
      ) : null}

      {workshop.proofOverride ? (
        <section className="admin-detail-section" aria-labelledby="proof-waiver-title">
          <h2 id="proof-waiver-title">Proof waiver recorded</h2>
          <p>{workshop.proofOverride.reason}</p>
          <p className="admin-muted">{workshop.proofOverride.email} - {dateTime(workshop.proofOverride.recordedAt)}</p>
        </section>
      ) : workshop.status === 'executed' && !workshop.files.length ? (
        <section className="admin-detail-section" aria-labelledby="proof-waiver-title">
          <h2 id="proof-waiver-title">Proof waiver</h2>
          <p>Record a reason to let the requester submit execution details without a proof file.</p>
          <form className="admin-decline-form" onSubmit={(event) => void waiveProof(event)}>
            <label>Reason<textarea rows={3} maxLength={5000} value={proofOverrideReason} onChange={(event) => setProofOverrideReason(event.target.value)} required /></label>
            <button className="secondary-button" type="submit" disabled={busy}>Record proof waiver</button>
          </form>
        </section>
      ) : null}

      <section className="admin-detail-section" aria-labelledby="history-title"><h2 id="history-title">Status history</h2>
        {workshop.statusHistory.length ? <ol className="admin-history">{workshop.statusHistory.map((entry, index) => <li key={`${entry.createdAt}-${index}`}><strong>{displayStatus(entry.fromStatus)} to {displayStatus(entry.toStatus)}</strong><span>{dateTime(entry.createdAt)}{entry.changedByEmail ? ` - ${entry.changedByEmail}` : ''}</span>{entry.reason ? <p>{entry.reason}</p> : null}</li>)}</ol> : <p className="admin-muted">No status changes recorded.</p>}
      </section>
    </main>
  );
}
