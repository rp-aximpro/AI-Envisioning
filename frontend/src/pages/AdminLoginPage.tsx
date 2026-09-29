import { LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiRequest } from '../api.js';
import { type AdminIdentity } from '../types.js';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest<AdminIdentity>('/api/admin/auth/login', {
        method: 'POST',
        data: { email, password },
      });
      void navigate('/admin/workshops', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-page">
      <header className="admin-login-header"><Link to="/">AI Envisioning Workshops</Link><span>Administration</span></header>
      <section className="admin-login-content" aria-labelledby="admin-login-title">
        <LockKeyhole size={24} aria-hidden="true" />
        <p className="eyebrow">Programme administration</p>
        <h1 id="admin-login-title">Admin sign in</h1>
        <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
          <label>Email<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  );
}
