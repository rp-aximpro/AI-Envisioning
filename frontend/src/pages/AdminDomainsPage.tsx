import { Check, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { apiRequest } from '../api.js';
import { type AdminDomain } from '../types.js';

const emptyDraft = { domain: '', displayName: '' };

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function AdminDomainsPage() {
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<AdminDomain[]>('/api/admin/domains')
      .then((items) => { if (active) setDomains(items); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load approved domains.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<AdminDomain>(editingId ? `/api/admin/domains/${editingId}` : '/api/admin/domains', {
        method: editingId ? 'PATCH' : 'POST',
        data: draft,
      });
      setDomains((items) => {
        const next = editingId ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved];
        return next.sort((left, right) => left.domain.localeCompare(right.domain));
      });
      setDraft(emptyDraft);
      setEditingId('');
      setNotice(editingId ? 'Domain updated.' : 'Domain added.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the domain.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (domain: AdminDomain) => {
    setBusyId(domain.id);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<AdminDomain>(`/api/admin/domains/${domain.id}`, {
        method: 'PATCH',
        data: { active: !domain.active },
      });
      setDomains((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(updated.active ? `${updated.domain} is enabled.` : `${updated.domain} is disabled.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update domain access.');
    } finally {
      setBusyId('');
    }
  };

  const beginEdit = (domain: AdminDomain) => {
    setEditingId(domain.id);
    setDraft({ domain: domain.domain, displayName: domain.displayName });
    setError('');
    setNotice('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setDraft(emptyDraft);
  };

  return (
    <main className="admin-content">
      <div className="admin-page-heading">
        <div><p className="eyebrow">Access control</p><h1>Approved domains</h1></div>
        <span className="admin-result-count">{domains.length} total, {domains.filter((domain) => domain.active).length} enabled</span>
      </div>

      <form className="admin-access-form" onSubmit={(event) => void save(event)}>
        <label><span>Domain</span><input required type="text" autoComplete="off" placeholder="example.com" value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value })} /></label>
        <label><span>Display name</span><input required type="text" maxLength={150} placeholder="Example Corporation" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
        <div className="admin-access-form-actions">
          <button className="primary-button" type="submit" disabled={saving}>{editingId ? <Check size={16} /> : <Plus size={16} />}{editingId ? 'Save changes' : 'Add domain'}</button>
          {editingId ? <button className="secondary-button" type="button" onClick={cancelEdit} disabled={saving}><X size={16} />Cancel</button> : null}
        </div>
      </form>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table admin-domain-table">
          <thead><tr><th>Domain</th><th>Organization</th><th>Access</th><th>Updated</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {domains.map((domain) => <tr key={domain.id}>
              <td className="admin-domain-name">{domain.domain}</td>
              <td>{domain.displayName}</td>
              <td><label className="admin-domain-toggle"><input type="checkbox" checked={domain.active} disabled={busyId === domain.id} onChange={() => void toggleActive(domain)} /><span>{domain.active ? 'Enabled' : 'Disabled'}</span></label></td>
              <td>{displayDate(domain.updatedAt)}</td>
              <td><button type="button" className="icon-button" title={`Edit ${domain.domain}`} aria-label={`Edit ${domain.domain}`} onClick={() => beginEdit(domain)}><Pencil size={16} /></button></td>
            </tr>)}
            {!loading && domains.length === 0 ? <tr><td className="admin-empty" colSpan={5}>No approved domains configured.</td></tr> : null}
            {loading ? <tr><td className="admin-empty" colSpan={5}>Loading domains...</td></tr> : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
