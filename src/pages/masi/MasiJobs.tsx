import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiJobs, MasiJob, Paged } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import { badgeClass, errorMessage, formatDate, PACKAGE_STATES, pageParam } from './format';
import MasiTable from '../../components/MasiTable';
import SourceMarks from './SourceMarks';

const PAGE_SIZE = 50;
/** The orders the page offers; anything else in the URL is not passed on. Newest first is the server's default: no parameter. */
const BY_MATCH = 'match,desc';

/** The registry: filters live in the URL so a view can be shared and comes back after a reload. */
export default function MasiJobs() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState<Paged<MasiJob> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = params.get('status') ?? 'OPEN';
  const q = params.get('q') ?? '';
  const remote = params.get('remote') ?? '';
  const packageStatus = params.get('packageStatus') ?? '';
  const company = params.get('company');
  const sort = params.get('sort') === BY_MATCH ? BY_MATCH : '';
  const pageNo = pageParam(params.get('page'));

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiJobs(
      {
        status: status as 'OPEN' | 'CLOSED' | 'ALL',
        q: q || undefined,
        remote: remote || undefined,
        packageStatus: packageStatus || undefined,
        company: company ? Number(company) : undefined,
        sort: sort || undefined,
        page: pageNo,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((p) => {
        setPage(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load jobs'));
      });
    return () => controller.abort();
  }, [status, q, remote, packageStatus, company, sort, pageNo]);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page'); // a new filter starts at the first page; a page change keeps it
    setParams(next);
  }

  const total = page?.totalElements ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Jobs</span>
          <span className="card-header-aside">
            <span className="muted">{page ? `${total} matching` : ''}</span>
            <Link to="/masi/jobs/add">add one by hand</Link>
          </span>
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
            aria-label="Search title"
            placeholder="title contains…"
            defaultValue={q}
          />
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => set('status', e.target.value)}
          >
            <option value="OPEN">open</option>
            <option value="CLOSED">closed</option>
            <option value="ALL">all</option>
          </select>
          <select
            aria-label="Remote"
            value={remote}
            onChange={(e) => set('remote', e.target.value)}
          >
            <option value="">any location</option>
            <option value="REMOTE">remote</option>
            <option value="HYBRID">hybrid</option>
            <option value="ON_SITE">on-site</option>
          </select>
          <select
            aria-label="Package"
            value={packageStatus}
            onChange={(e) => set('packageStatus', e.target.value)}
          >
            <option value="">any package state</option>
            <option value="NONE">no package</option>
            {PACKAGE_STATES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </select>
          <select aria-label="Order" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="">newest first</option>
            <option value={BY_MATCH}>best match first</option>
          </select>
          <button type="submit" className="btn-small">
            Search
          </button>
          {company && (
            <button type="button" className="status-badge" onClick={() => set('company', '')}>
              company filter ×
            </button>
          )}
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading jobs...</div>}
        {page?.content.length === 0 && <div className="empty-state">No jobs match.</div>}
        {page && page.content.length > 0 && (
          <p className="muted masi-intro">
            Match: how much of what the posting asks for your CV shows in words, 0–100. A dash: not
            scored yet.
          </p>
        )}
        {page && page.content.length > 0 && (
          <MasiTable label="Jobs">
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Sources</th>
                <th>Location</th>
                <th>First seen</th>
                <th className="masi-num">Match</th>
                <th>Package</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/masi/jobs/${j.id}`}>{j.title}</Link>
                    {j.status === 'CLOSED' && <span className="muted"> (closed)</span>}
                    {j.reopenedCount > 0 && (
                      <span className="muted masi-repost"> reposted ×{j.reopenedCount}</span>
                    )}
                    {j.status === 'MERGED' && (
                      <span className="muted">
                        {' ('}
                        {j.mergedIntoId ? (
                          <Link
                            to={`/masi/jobs/${j.mergedIntoId}`}
                            aria-label={`merged into job ${j.mergedIntoId}`}
                          >
                            merged
                          </Link>
                        ) : (
                          'merged'
                        )}
                        {')'}
                      </span>
                    )}
                  </td>
                  <td>
                    {j.companyId ? (
                      <Link to={`/masi/companies/${j.companyId}`}>{j.companyName}</Link>
                    ) : (
                      j.companyName
                    )}
                  </td>
                  <td>
                    <SourceMarks sources={j.sources} />
                  </td>
                  <td>
                    {j.location ?? ''}
                    {j.remote && j.remote !== 'UNKNOWN'
                      ? ` · ${j.remote.toLowerCase().replace('_', '-')}`
                      : ''}
                  </td>
                  <td>{formatDate(j.firstSeenAt)}</td>
                  <td className="masi-num">
                    {j.matchScore ?? (
                      <>
                        <span className="muted" aria-hidden="true">
                          —
                        </span>
                        <span className="sr-only">not scored</span>
                      </>
                    )}
                  </td>
                  <td>
                    {j.packageStatus ? (
                      <Link
                        to={`/masi/packages/${j.packageId}`}
                        className={badgeClass(j.packageStatus)}
                      >
                        {j.packageStatus.toLowerCase().replace('_', ' ')}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
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
