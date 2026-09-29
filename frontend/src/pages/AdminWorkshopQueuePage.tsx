import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../api.js';
import { type AdminWorkshopPage, type WorkshopOptions, type WorkshopStatus } from '../types.js';

const pageSize = 25;
const statuses: WorkshopStatus[] = ['pending_review', 'planned', 'executed', 'follow_up', 'completed', 'declined'];

function displayStatus(status: WorkshopStatus): string {
  return status.replaceAll('_', ' ');
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function AdminWorkshopQueuePage() {
  const [countries, setCountries] = useState<WorkshopOptions['countries']>([]);
  const [draft, setDraft] = useState({ countryCode: '', creator: '', requesterRole: '', search: '', sortBy: 'createdAt', sortOrder: 'desc', status: '' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminWorkshopPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<WorkshopOptions>('/api/public/workshop-options')
      .then((options) => setCountries(options.countries))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = {
      page,
      pageSize,
      ...(filters.countryCode ? { countryCode: filters.countryCode } : {}),
      ...(filters.creator ? { creator: filters.creator } : {}),
      ...(filters.requesterRole ? { requesterRole: filters.requesterRole } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      ...(filters.status ? { status: filters.status } : {}),
    };
    void apiRequest<AdminWorkshopPage>('/api/admin/workshops', { params })
      .then((workshops) => { if (active) setResult(workshops); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load workshops.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  };

  const clearFilters = () => {
    const empty = { countryCode: '', creator: '', requesterRole: '', search: '', sortBy: 'createdAt', sortOrder: 'desc', status: '' };
    setDraft(empty);
    setFilters(empty);
    setPage(1);
  };

  return (
    <main className="admin-content">
      <div className="admin-page-heading"><div><p className="eyebrow">Review queue</p><h1>Workshop requests</h1></div><span className="admin-result-count">{result?.total ?? 0} total</span></div>
      <form className="admin-filter-bar" onSubmit={applyFilters}>
        <label className="admin-search-field"><span>Search</span><div><Search size={16} aria-hidden="true" /><input aria-label="Search workshops" placeholder="Code, customer, requester, location" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} /></div></label>
        <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
        <label><span>Country</span><select value={draft.countryCode} onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })}><option value="">All countries</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        <label><span>Role</span><select value={draft.requesterRole} onChange={(event) => setDraft({ ...draft, requesterRole: event.target.value })}><option value="">AE and CST</option><option value="ae">AE</option><option value="cst">CST</option></select></label>
        <label><span>Creator</span><input value={draft.creator} onChange={(event) => setDraft({ ...draft, creator: event.target.value })} placeholder="Name or email" /></label>
        <label><span>Sort by</span><select value={draft.sortBy} onChange={(event) => setDraft({ ...draft, sortBy: event.target.value })}><option value="createdAt">Created date</option><option value="plannedStartAt">Planned date</option><option value="workshopCode">Workshop code</option><option value="customerName">Customer</option><option value="creatorName">Creator</option><option value="status">Status</option></select></label>
        <label><span>Direction</span><select value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}><option value="desc">Newest / Z-A</option><option value="asc">Oldest / A-Z</option></select></label>
        <div className="admin-filter-actions"><button className="primary-button" type="submit">Apply filters</button><button className="text-button" type="button" onClick={clearFilters}>Clear</button></div>
      </form>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table">
          <thead><tr><th>Workshop</th><th>Customer</th><th>Creator</th><th>Role</th><th>Country</th><th>Planned</th><th>Status</th><th>Funding requested</th><th>Created</th></tr></thead>
          <tbody>
            {result?.items.map((workshop) => <tr key={workshop.id}>
              <td><Link className="admin-code-link" to={`/admin/workshops/${workshop.id}`}>{workshop.workshopCode}</Link></td>
              <td>{workshop.customerName}</td>
              <td>{workshop.creatorName}<small>{workshop.creatorEmail}</small></td>
              <td>{workshop.requesterRole.toUpperCase()}</td>
              <td>{workshop.countryName}</td>
              <td>{displayDate(workshop.plannedStartAt)}</td>
              <td><span className={`admin-status status-${workshop.status}`}>{displayStatus(workshop.status)}</span></td>
              <td>{workshop.fundingRequired && workshop.requestedFundingAmount !== null ? `${workshop.currencyCode} ${workshop.requestedFundingAmount}` : 'No'}</td>
              <td>{displayDate(workshop.createdAt)}</td>
            </tr>)}
            {!loading && result?.items.length === 0 ? <tr><td className="admin-empty" colSpan={9}>No workshop requests match these filters.</td></tr> : null}
            {loading && !result ? <tr><td className="admin-empty" colSpan={9}>Loading workshop requests...</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination"><span>{result ? `Showing ${result.total ? (page - 1) * pageSize + 1 : 0}-${Math.min(page * pageSize, result.total)} of ${result.total}` : ''}</span><div><button type="button" className="secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {Math.max(1, result?.pageCount ?? 0)}</span><button type="button" className="secondary-button" disabled={loading || page >= (result?.pageCount ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    </main>
  );
}
