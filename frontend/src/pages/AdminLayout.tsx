import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { apiRequest } from '../api.js';
import { type AdminIdentity } from '../types.js';

export function AdminLayout() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<AdminIdentity>('/api/admin/auth/session')
      .then((session) => { if (active) setIdentity(session); })
      .catch(() => { if (active) void navigate('/admin/login', { replace: true }); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [navigate]);

  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>('/api/admin/auth/logout', { method: 'POST' });
      void navigate('/admin/login', { replace: true });
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  };

  if (checking || !identity) return <main className="admin-loading">Checking administrator access...</main>;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin/workshops">AI Envisioning <span>Administration</span></Link>
        <nav aria-label="Administration">
          <Link to="/admin/workshops">Workshops</Link>
          <span className="admin-identity">{identity.displayName}</span>
          <button type="button" className="icon-button" onClick={() => void logout()} disabled={busy} aria-label="Log out" title="Log out"><LogOut size={18} /></button>
        </nav>
      </header>
      {error ? <p className="admin-toast" role="alert">{error}</p> : null}
      <Outlet context={identity} />
      <footer className="admin-footer">Programme administration - Signed in as {identity.email}</footer>
    </div>
  );
}
