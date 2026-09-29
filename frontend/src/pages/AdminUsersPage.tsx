import { Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';

import { apiRequest } from '../api.js';
import { type AdminIdentity, type AdminUser } from '../types.js';

const emptyDraft = { displayName: '', email: '', password: '' };

function displayDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
}

export function AdminUsersPage() {
  const currentAdmin = useOutletContext<AdminIdentity>();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<AdminUser[]>('/api/admin/users')
      .then((items) => { if (active) setAdmins(items); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load administrators.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const admin = await apiRequest<AdminUser>('/api/admin/users', { method: 'POST', data: draft });
      setAdmins((items) => [...items, admin].sort((left, right) => left.email.localeCompare(right.email)));
      setDraft(emptyDraft);
      setNotice(`Administrator ${admin.email} added.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to add administrator.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (admin: AdminUser) => {
    setBusyId(admin.id);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<AdminUser>(`/api/admin/users/${admin.id}`, {
        method: 'PATCH',
        data: { active: !admin.active },
      });
      setAdmins((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(updated.active ? `${updated.email} is active.` : `${updated.email} is deactivated.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update administrator access.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <main className="admin-content">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Access control</p><h1>Administrators</h1></div>
        <span className="admin-result-count">{admins.length} total, {admins.filter((admin) => admin.active).length} active</span>
      </div>

      <form className="admin-access-form admin-admin-form" onSubmit={(event) => void createAdmin(event)}>
        <label><span>Name</span><input required type="text" maxLength={150} autoComplete="name" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
        <label><span>Email</span><input required type="email" maxLength={320} autoComplete="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        <label><span>Initial password</span><input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
        <div className="admin-access-form-actions"><button className="primary-button" type="submit" disabled={saving}><Plus size={16} />Add administrator</button></div>
      </form>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table admin-users-table">
          <thead><tr><th>Administrator</th><th>Email</th><th>Access</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {admins.map((admin) => <tr key={admin.id}>
              <td>{admin.displayName}</td>
              <td>{admin.email}</td>
              <td><label className="admin-domain-toggle"><input type="checkbox" checked={admin.active} disabled={busyId === admin.id || admin.id === currentAdmin.adminId} onChange={() => void toggleActive(admin)} /><span>{admin.active ? 'Active' : 'Inactive'}</span></label></td>
              <td>{displayDate(admin.lastLoginAt)}</td>
            </tr>)}
            {!loading && admins.length === 0 ? <tr><td className="admin-empty" colSpan={4}>No administrator accounts found.</td></tr> : null}
            {loading ? <tr><td className="admin-empty" colSpan={4}>Loading administrators...</td></tr> : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
