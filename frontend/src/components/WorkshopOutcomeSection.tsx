import { Check, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { apiRequest } from '../api.js';
import { type WorkshopTracking } from '../types.js';

interface WorkshopOutcomeSectionProps {
  onCompleted: () => Promise<void>;
  trackingToken: string;
  workshop: WorkshopTracking;
}

interface LeadDraft {
  description: string;
  id: string;
  leadReference: string;
}

interface OpportunityDraft {
  id: string;
  name: string;
  notes: string;
  opportunityReference: string;
  pipelineValue: string;
  stage: string;
}

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

function toCents(value: string): bigint | null {
  if (!moneyPattern.test(value)) return null;
  const [wholePart, fraction = ''] = value.split('.');
  const whole = wholePart ?? '0';
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatMoney(amount: string, currencyCode: string): string {
  const [wholePart, fraction = '00'] = amount.split('.');
  const whole = wholePart ?? '0';
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currencyCode} ${groupedWhole}.${fraction.padEnd(2, '0')}`;
}

function newLead(): LeadDraft {
  return { description: '', id: crypto.randomUUID(), leadReference: '' };
}

function newOpportunity(): OpportunityDraft {
  return { id: crypto.randomUUID(), name: '', notes: '', opportunityReference: '', pipelineValue: '', stage: '' };
}

export function WorkshopOutcomeSection({ onCompleted, trackingToken, workshop }: WorkshopOutcomeSectionProps) {
  const [leads, setLeads] = useState<LeadDraft[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityDraft[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [actualFundingAmount, setActualFundingAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pipelineTotal = opportunities.reduce((total, opportunity) => total + (toCents(opportunity.pipelineValue) ?? 0n), 0n);
  const draftLeadCount = leads.filter((lead) => lead.leadReference.trim() || lead.description.trim()).length;
  const draftOpportunityCount = opportunities.filter((opportunity) => opportunity.name.trim() || opportunity.pipelineValue.trim()).length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest<void>(`/api/tracking/workshops/${trackingToken}/complete`, {
        method: 'POST',
        data: {
          actualFundingAmount: workshop.fundingRequired ? actualFundingAmount || null : null,
          completionNotes,
          leads: leads.filter((lead) => lead.leadReference.trim() || lead.description.trim()).map((lead) => ({
            description: lead.description.trim() || null,
            leadReference: lead.leadReference.trim() || null,
          })),
          opportunities: opportunities.filter((opportunity) => opportunity.name.trim() || opportunity.pipelineValue.trim()).map((opportunity) => ({
            name: opportunity.name.trim(),
            notes: opportunity.notes.trim() || null,
            opportunityReference: opportunity.opportunityReference.trim() || null,
            pipelineValue: opportunity.pipelineValue,
            stage: opportunity.stage.trim() || null,
          })),
        },
      });
      await onCompleted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to complete this workshop.');
    } finally {
      setSubmitting(false);
    }
  };

  if (workshop.status === 'completed') {
    return (
      <section className="tracking-section outcome-section" aria-labelledby="outcome-title">
        <h2 id="outcome-title">Workshop outcomes</h2>
        <dl className="tracking-details">
          <div><dt>Leads</dt><dd>{workshop.leadCount}</dd></div>
          <div><dt>Opportunities</dt><dd>{workshop.opportunityCount}</dd></div>
          <div><dt>Total pipeline</dt><dd>{formatMoney(workshop.totalPipelineValue, workshop.currencyCode)}</dd></div>
          {workshop.actualFundingAmount !== null ? <div><dt>Actual funding</dt><dd>{formatMoney(workshop.actualFundingAmount, workshop.currencyCode)}</dd></div> : null}
          {workshop.completionNotes ? <div className="details-wide"><dt>Completion notes</dt><dd>{workshop.completionNotes}</dd></div> : null}
          {workshop.completedAt ? <div><dt>Completed</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(workshop.completedAt))}</dd></div> : null}
        </dl>
        {workshop.leads.length > 0 ? <div className="outcome-list"><h3>Leads</h3><ul>{workshop.leads.map((lead) => <li key={lead.id}><strong>{lead.leadReference || 'Lead'}</strong>{lead.description ? <span>{lead.description}</span> : null}</li>)}</ul></div> : null}
        {workshop.opportunities.length > 0 ? <div className="outcome-list"><h3>Opportunities</h3><ul>{workshop.opportunities.map((opportunity) => <li key={opportunity.id}><strong>{opportunity.name}</strong><span>{formatMoney(opportunity.pipelineValue, opportunity.currencyCode)}{opportunity.stage ? ` · ${opportunity.stage}` : ''}</span>{opportunity.opportunityReference ? <span>Reference: {opportunity.opportunityReference}</span> : null}{opportunity.notes ? <span>{opportunity.notes}</span> : null}</li>)}</ul></div> : null}
      </section>
    );
  }

  return (
    <section className="tracking-section outcome-section" aria-labelledby="outcome-title">
      <h2 id="outcome-title">Workshop outcomes and closeout</h2>
      <p>Record the outcomes, review the pipeline total, and complete the workshop.</p>
      {error ? <p className="tracking-error" role="alert">{error}</p> : null}
      <form className="outcome-form" onSubmit={(event) => void submit(event)}>
        <div className="outcome-subsection">
          <div className="outcome-subsection-heading"><h3>Leads</h3><button className="secondary-button" type="button" onClick={() => setLeads((current) => [...current, newLead()])} disabled={submitting || leads.length >= 100}><Plus size={16} /> Add lead</button></div>
          {leads.map((lead, index) => <fieldset className="outcome-entry" key={lead.id}>
            <legend>Lead {index + 1}</legend>
            <label>Lead reference<input maxLength={150} value={lead.leadReference} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, leadReference: event.target.value } : item))} /></label>
            <label>Description<input maxLength={5000} value={lead.description} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, description: event.target.value } : item))} /></label>
            <button className="icon-button outcome-remove" type="button" aria-label={`Remove lead ${index + 1}`} title="Remove lead" onClick={() => setLeads((current) => current.filter((item) => item.id !== lead.id))} disabled={submitting}><Trash2 size={16} /></button>
          </fieldset>)}
          {leads.length === 0 ? <p className="outcome-empty">No leads added.</p> : null}
        </div>

        <div className="outcome-subsection">
          <div className="outcome-subsection-heading"><h3>Opportunities</h3><button className="secondary-button" type="button" onClick={() => setOpportunities((current) => [...current, newOpportunity()])} disabled={submitting || opportunities.length >= 100}><Plus size={16} /> Add opportunity</button></div>
          {opportunities.map((opportunity, index) => <fieldset className="outcome-entry" key={opportunity.id}>
            <legend>Opportunity {index + 1}</legend>
            <label>Name<input maxLength={200} value={opportunity.name} onChange={(event) => setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, name: event.target.value } : item))} /></label>
            <label>Opportunity reference<input maxLength={150} value={opportunity.opportunityReference} onChange={(event) => setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, opportunityReference: event.target.value } : item))} /></label>
            <label>Pipeline value ({workshop.currencyCode})<input inputMode="decimal" maxLength={15} value={opportunity.pipelineValue} onChange={(event) => setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, pipelineValue: event.target.value } : item))} /></label>
            <label>Stage<input maxLength={100} value={opportunity.stage} onChange={(event) => setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, stage: event.target.value } : item))} /></label>
            <label className="details-wide">Notes<textarea rows={2} maxLength={5000} value={opportunity.notes} onChange={(event) => setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, notes: event.target.value } : item))} /></label>
            <button className="icon-button outcome-remove" type="button" aria-label={`Remove opportunity ${index + 1}`} title="Remove opportunity" onClick={() => setOpportunities((current) => current.filter((item) => item.id !== opportunity.id))} disabled={submitting}><Trash2 size={16} /></button>
          </fieldset>)}
          {opportunities.length === 0 ? <p className="outcome-empty">No opportunities added.</p> : null}
        </div>

        <div className="outcome-preview" aria-live="polite">
          <span>{draftLeadCount} lead{draftLeadCount === 1 ? '' : 's'}</span>
          <span>{draftOpportunityCount} opportunit{draftOpportunityCount === 1 ? 'y' : 'ies'}</span>
          <strong>Pipeline total: {formatMoney(`${pipelineTotal / 100n}.${(pipelineTotal % 100n).toString().padStart(2, '0')}`, workshop.currencyCode)}</strong>
        </div>

        {workshop.fundingRequired ? <label className="outcome-funding">Actual funding amount ({workshop.currencyCode})<input inputMode="decimal" maxLength={15} value={actualFundingAmount} onChange={(event) => setActualFundingAmount(event.target.value)} required /><span>Approved: {workshop.approvedFundingAmount ? formatMoney(workshop.approvedFundingAmount, workshop.currencyCode) : 'not available'}. Actual cannot exceed the approved amount.</span></label> : null}
        <label className="outcome-notes">Completion notes<textarea rows={4} maxLength={10000} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} /></label>
        <button className="primary-button" type="submit" disabled={submitting}><Check size={17} /> {submitting ? 'Completing...' : 'Complete workshop'}</button>
      </form>
    </section>
  );
}
