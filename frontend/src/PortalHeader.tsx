import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { apiRequest } from './api.js';
import { type RequesterSession } from './types.js';

export function PortalHeader({ session }: { session?: RequesterSession }) {
  const navigate = useNavigate();
  const logout = async () => {
    await apiRequest<void>('/api/public/request-access/logout', { method: 'POST' });
    void navigate('/request/auth');
  };

  return <header className="portal-header"><Link to="/" className="brand-mark">AI Envisioning Workshops</Link>{session ? <div className="session-tools"><span>{session.email}</span><button type="button" className="icon-button" aria-label="Log out" title="Log out" onClick={() => void logout()}><LogOut size={18} /></button></div> : null}</header>;
}
