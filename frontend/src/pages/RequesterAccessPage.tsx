import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../api.js';
import { PortalHeader } from '../PortalHeader.js';
import { type RequesterSession } from '../types.js';

export function RequesterAccessPage() {
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setMessage(''); try { if (sent) { await apiRequest<RequesterSession>('/api/public/request-access/verify-otp', { method: 'POST', data: { email, code } }); void navigate('/request/new'); } else { const result = await apiRequest<{ message: string }>('/api/public/request-access/send-otp', { method: 'POST', data: { email } }); setSent(true); setMessage(result.message); } } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to continue.'); } finally { setBusy(false); } };
  return <main className="app-shell"><PortalHeader /><section className="form-page"><p className="eyebrow">Requester access</p><h1>Verify your work email</h1><p className="page-lede">Use an approved AE or CST email address to start a workshop request.</p><form className="form-grid access-form" onSubmit={(event) => void submit(event)}><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent || busy} required /></label>{sent ? <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} required /></label> : null}{message ? <p className="form-message" role="status">{message}</p> : null}<button className="primary-button" disabled={busy} type="submit">{sent ? 'Verify and continue' : 'Send verification code'} <Send size={17} /></button>{sent ? <button className="text-button" type="button" onClick={() => setSent(false)}>Use a different email</button> : null}</form></section></main>;
}
