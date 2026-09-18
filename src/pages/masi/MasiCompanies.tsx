import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiCompanies, MasiCompany, Paged } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import { badgeClass, errorMessage, formatDate, pageParam } from './format';

const PAGE_SIZE = 50;

/** The company registry: name or registry-code search, status, and "hiring now" (an OPEN job exists). */
export default function MasiCompanies() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const hiring = params.get('hiring') === 'true';
  const pageNo = pageParam(params.get('page'));
  const [page, setPage] = useState<Paged<MasiCompany> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiCompanies(
      { q: q || undefined, status: status || undefined, hiring, page: pageNo, size: PAGE_SIZE },
      controller.signal,
    )
      .then((p) => {
        setPage(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load companies'));
      });
    return () => controller.abort();
  }, [q, status, hiring, pageNo]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }

  const total = page?.totalElements ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Companies</span>
          <span className="muted">{page ? `${total} matching` : ''}</span>
        </div>
        <form
          className="form-row masi-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const typed = new FormData(e.currentTarget).get('q');
            set('q', typeof typed === 'string' ? typed.trim() : '');
          }}
        >
          <input
            key={q}
            type="search"
            name="q"
            aria-label="Search name or registry code"
            placeholder="name or registry code…"
            defaultValue={q}
          />
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => set('status', e.target.value)}
          >
            <option value="">any status</option>
            <option value="ACTIVE">active</option>
            <option value="DORMANT">dormant</option>
          </select>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={hiring}
              onChange={(e) => set('hiring', e.target.checked ? 'true' : '')}
            />{' '}
            hiring now
          </label>
          <button type="submit" className="btn-small">
            Search
          </button>
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading companies...</div>}
        {page?.content.length === 0 && <div className="empty-state">No companies match.</div>}
        {page && page.content.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Registry code</th>
                <th>City</th>
                <th>ATS</th>
                <th>Status</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/masi/companies/${c.id}`}>{c.name}</Link>
                    {c.blacklisted && <span className="status-badge error"> blacklisted</span>}
                  </td>
                  <td>{c.registryCode ?? ''}</td>
                  <td>{c.hqCity ?? ''}</td>
                  <td>{c.atsVendor ?? ''}</td>
                  <td>
                    <span className={badgeClass(c.status)}>{c.status.toLowerCase()}</span>
                  </td>
                  <td>{formatDate(c.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn-small"
              disabled={pageNo <= 0}
              onClick={() => set('page', String(pageNo - 1))}
            >
              Previous
            </button>
            <span className="pagination-info">
              page {pageNo + 1} of {pages}
            </span>
            <button
              type="button"
              className="btn-small"
              disabled={pageNo + 1 >= pages}
              onClick={() => set('page', String(pageNo + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
