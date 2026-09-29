import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { apiRequest } from '../api.js';
import { type CreatedWorkshop, type RequesterSession, type WorkshopOptions } from '../types.js';

const supportLabels = {
  facilitator: 'Facilitator required',
  full: 'Full execution support',
  microsoft: 'Microsoft co-delivery',
  none: 'No support needed',
  technical: 'Technical / solution architect',
} as const;

const schema = z.object({
  requesterName: z.string().trim().min(1, 'Your name is required.').max(150),
  requesterRole: z.enum(['AE', 'CST', 'FPM', 'WSG']),
  customerName: z.string().trim().min(1, 'Customer name is required.').max(200),
  countryCode: z.string().regex(/^[A-Z]{2}$/, 'Select a country.'),
  location: z.string().trim().min(1, 'Location is required.').max(300),
  plannedDate: z.string().min(1, 'Choose a planned date.'),
  durationHours: z.number().min(1).max(24).multipleOf(0.5),
  estimatedAttendees: z.number().int().min(1).max(10_000),
  executionSupport: z.enum(['none', 'facilitator', 'technical', 'microsoft', 'full']),
  fundingRequired: z.boolean(),
  requestedFundingAmount: z.number().min(0).optional(),
  objectives: z.string().trim().max(10_000),
}).superRefine((value, context) => {
  if (value.fundingRequired && value.requestedFundingAmount === undefined) {
    context.addIssue({ code: 'custom', path: ['requestedFundingAmount'], message: 'Enter the requested amount.' });
  }
});

type FormValues = z.infer<typeof schema>;

function localDateAtNineUtc(date: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('Choose a valid planned date.');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const desiredUtc = Date.UTC(year, month - 1, day, 9);
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit',
    month: '2-digit', second: '2-digit', timeZone: timezone, year: 'numeric',
  });
  let candidate = desiredUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((value) => value.type === type)?.value);
    const representedUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    candidate += desiredUtc - representedUtc;
  }

  return new Date(candidate).toISOString();
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null;
}

function BrandHeader() {
  return (
    <header className="workshop-brand-header">
      <a className="workshop-brand-lockup" href="/" aria-label="AI Envisioning Workshops home">
        <img className="dell-logo" src="/brands/dell-logo.svg" alt="" /><span className="brand-divider" aria-hidden="true" />
        <span className="microsoft-lockup"><img src="/brands/microsoft-mark.svg" alt="" />Microsoft</span>
      </a>
    </header>
  );
}

export function WorkshopRequestPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<RequesterSession | null>(null);
  const [options, setOptions] = useState<WorkshopOptions | null>(null);
  const [submitError, setSubmitError] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requesterRole: 'AE', durationHours: 4, estimatedAttendees: 10,
      executionSupport: 'none', fundingRequired: false,
      objectives: '', requestedFundingAmount: undefined,
    },
  });
  const fundingRequired = form.watch('fundingRequired');
  const errors = form.formState.errors;

  useEffect(() => {
    void Promise.all([
      apiRequest<RequesterSession>('/api/requester/session'),
      apiRequest<WorkshopOptions>('/api/public/workshop-options'),
    ]).then(([requesterSession, workshopOptions]) => {
      setSession(requesterSession);
      setOptions(workshopOptions);
    }).catch(() => void navigate('/request/auth', { replace: true }));
  }, [navigate]);

  const submit = async (values: FormValues) => {
    setSubmitError('');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const workshop = await apiRequest<CreatedWorkshop>('/api/requester/workshops', {
        method: 'POST',
        data: {
          creatorName: values.requesterName,
          requesterRole: values.requesterRole,
          customerName: values.customerName,
          countryCode: values.countryCode,
          location: values.location,
          timezone,
          plannedStartAt: localDateAtNineUtc(values.plannedDate, timezone),
          durationMinutes: Math.round(values.durationHours * 60),
          estimatedAttendees: values.estimatedAttendees,
          executionSupportRequired: values.executionSupport !== 'none',
          executionSupportDetails: values.executionSupport === 'none' ? undefined : supportLabels[values.executionSupport],
          fundingRequired: values.fundingRequired,
          requestedFundingAmount: values.fundingRequired ? values.requestedFundingAmount : undefined,
          description: values.objectives,
        },
      });
      void navigate('/request/success', { state: workshop });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the request.');
    }
  };

  if (!session || !options) {
    return <main className="app-shell"><section className="form-page"><p>Checking requester access...</p></section></main>;
  }

  return (
    <div className="workshop-page">
      <BrandHeader />
      <section className="workshop-hero">
        <div className="workshop-hero-content">
          <p className="workshop-eyebrow">Co-delivery programme</p>
          <h1>AI Envisioning Workshop planner</h1>
          <p>AE, CST, FPM and WSG teams register a workshop once. You instantly get a unique link to track it end to end.</p>
          <div className="hero-brandline"><img className="dell-logo" src="/brands/dell-logo.svg" alt="" /><span className="brand-divider" /><span className="microsoft-lockup"><img src="/brands/microsoft-mark.svg" alt="" />Microsoft</span></div>
        </div>
      </section>
      <main className="workshop-form-wrap">
        <section className="registration-card" aria-labelledby="registration-title">
          <div className="registration-card-heading"><h2 id="registration-title">Register a new workshop</h2></div>
          <form className="registration-form" noValidate onSubmit={(event) => void form.handleSubmit((values) => void submit(values))(event)}>
            <label>Your name<input autoComplete="name" {...form.register('requesterName')} /><FieldError message={errors.requesterName?.message} /></label>
            <label>Your email<input type="email" value={session.email} readOnly /></label>
            <label>Role<select {...form.register('requesterRole')}><option value="AE">AE</option><option value="CST">CST</option><option value="FPM">FPM</option><option value="WSG">WSG</option></select></label>
            <label>Customer name<input autoComplete="organization" {...form.register('customerName')} /><FieldError message={errors.customerName?.message} /></label>
            <label>Country<select {...form.register('countryCode')}><option value="">{options.countries.length ? 'Select a country' : 'No countries configured yet'}</option>{options.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select><FieldError message={errors.countryCode?.message} /></label>
            <label>Location / venue<input placeholder="e.g. Munich Customer Solution Centre" {...form.register('location')} /><FieldError message={errors.location?.message} /></label>
            <label>Planned date<input type="date" {...form.register('plannedDate')} /><FieldError message={errors.plannedDate?.message} /></label>
            <label>Estimated duration (hours)<input type="number" min="1" max="24" step="0.5" {...form.register('durationHours', { valueAsNumber: true })} /><FieldError message={errors.durationHours?.message} /></label>
            <label>Estimated attendees<input type="number" min="1" max="10000" {...form.register('estimatedAttendees', { valueAsNumber: true })} /><FieldError message={errors.estimatedAttendees?.message} /></label>
            <label>Execution support required<select {...form.register('executionSupport')}><option value="none">No support needed</option><option value="facilitator">Facilitator required</option><option value="technical">Technical / solution architect</option><option value="microsoft">Microsoft co-delivery</option><option value="full">Full execution support</option></select></label>
            <div className="funding-control"><div><span className="funding-title">Funding required</span><p>Requested from the overall programme budget ({options.programCurrency}).</p></div><button type="button" role="switch" aria-checked={fundingRequired} aria-label="Funding required" className="funding-switch" onClick={() => form.setValue('fundingRequired', !fundingRequired, { shouldDirty: true, shouldValidate: true })}><span /></button></div>
            {fundingRequired ? <label className="funding-amount">Requested funding amount ({options.programCurrency})<input type="number" min="0" step="0.01" {...form.register('requestedFundingAmount', { setValueAs: (value: string) => value === '' ? undefined : Number(value) })} /><FieldError message={errors.requestedFundingAmount?.message} /></label> : null}
            <label className="registration-wide">Context / objectives<textarea rows={3} {...form.register('objectives')} /><FieldError message={errors.objectives?.message} /></label>
            {submitError ? <p className="registration-error" role="alert">{submitError}</p> : null}
            <div className="registration-wide registration-actions"><button className="primary-button" type="submit" disabled={form.formState.isSubmitting}>Submit and create tracking link <Send size={16} aria-hidden="true" /></button></div>
          </form>
        </section>
      </main>
      <footer className="workshop-footer"><span>AI Envisioning Workshops — Dell Technologies &amp; Microsoft co-delivery programme</span><a href="/admin">Programme admin</a></footer>
    </div>
  );
}
