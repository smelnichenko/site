import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiJobs, MasiEmploymentType, MasiJob, Paged } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import { badgeClass, errorMessage, formatDate, PACKAGE_STATES, pageParam } from './format';
import MasiTable from '../../components/MasiTable';
import SourceMarks from './SourceMarks';
import FigureFilterNote from './FigureFilterNote';
import { figureParams, JOB_EVENTS, SALARY_FIGURES, windowLabel } from './figureLinks';

const PAGE_SIZE = 50;
/** The forms of work masi tells apart, as the filter offers them; anything else in the URL is not passed on. */
const EMPLOYMENT_TYPES: Array<[MasiEmploymentType, string]> = [
  ['PERMANENT', 'permanent'],
  ['FIXED_TERM', 'fixed-term'],
  ['CONTRACT', 'contract'],
  ['FREELANCE', 'freelance'],
  ['INTERNSHIP', 'internship'],
  ['PART_TIME', 'part-time'],
];

function employmentParam(value: string | null): MasiEmploymentType | '' {
  return EMPLOYMENT_TYPES.find(([t]) => t === value)?.[0] ?? '';
}

/** The orders the page offers; anything else in the URL is not passed on. Newest first is the server's default: no parameter. */
const BY_MATCH = 'match,desc';

/** How the report filter reads: "closed 12 Oct 2026 – 18 Oct 2026". */
const EVENT_WORDS = { NEW: 'first seen', CLOSED: 'closed', REPOSTED: 'reposted' } as const;
const SALARY_WORDS = { COUNTED: 'salary counted', EXCLUDED: 'salary not counted' } as const;
/** The report filter's parameters: clearing it drops them all, and nothing else. */
const FIGURE_KEYS = ['event', 'from', 'to', 'salary', 'titleNorm', 'tag', 'seniority'];

/** The registry: filters live in the URL so a view can be shared and comes back after a reload. */
export default function MasiJobs() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState<Paged<MasiJob> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // a report figure's jobs: what happened to them in the report's period, as masi counted them
  const figure = figureParams(params, JOB_EVENTS);
  const salary = SALARY_FIGURES.find((f) => f === params.get('salary'));
  // a bar's value: the jobs of one title, tag or seniority
  const titleNorm = params.get('titleNorm') ?? '';
  const tag = params.get('tag') ?? '';
  const seniority = params.get('seniority') ?? '';
  // a figure counts jobs of every status (a job closed in the week is mostly closed now): so does its list, unless asked
  const status = params.get('status') ?? (figure ? 'ALL' : 'OPEN');
  const q = params.get('q') ?? '';
  const remote = params.get('remote') ?? '';
  const packageStatus = params.get('packageStatus') ?? '';
  const employmentType = employmentParam(params.get('employmentType'));
  const country = (params.get('country') ?? '').toUpperCase();
  const company = params.get('company');
  const offeredSorts = new Set([
    BY_MATCH,
    'title,asc',
    'title,desc',
    'firstSeenAt,asc',
    'firstSeenAt,desc',
  ]);
  const rawSort = params.get('sort') ?? '';
  const sort = offeredSorts.has(rawSort) ? rawSort : '';
  const pageNo = pageParam(params.get('page'));

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiJobs(
      {
        status: status as 'OPEN' | 'CLOSED' | 'ALL',
        q: q || undefined,
        remote: remote || undefined,
        packageStatus: packageStatus || undefined,
        employmentType: employmentType || undefined,
        country: country || undefined,
        company: company ? Number(company) : undefined,
        sort: sort || undefined,
        event: figure?.event,
        from: figure?.from,
        to: figure?.to,
        salary,
        titleNorm: titleNorm || undefined,
        tag: tag || undefined,
        seniority: seniority || undefined,
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
    // the figure's three parts are primitives: an object would be new on every render and refetch for ever
  }, [
    status,
    q,
    remote,
    packageStatus,
    employmentType,
    country,
    company,
    sort,
    figure?.event,
    figure?.from,
    figure?.to,
    salary,
    titleNorm,
    tag,
    seniority,
    pageNo,
  ]);

  function sortBy(column: string) {
    const next = new URLSearchParams(params);
    const asc = `${column},asc`;
    next.set('sort', sort === asc ? `${column},desc` : asc);
    next.delete('page');
    setParams(next);
  }

  function sortMark(column: string): string {
    if (sort === `${column},asc`) return ' ▲';
    if (sort === `${column},desc`) return ' ▼';
    return '';
  }

  function set(key: string, value: string) {
    setAll({ [key]: value });
  }

  function setAll(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // a new filter starts at the first page; a page change keeps it
    if (!('page' in values)) next.delete('page');
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
            const form = new FormData(e.currentTarget);
            const typed = (name: string) => {
              const v = form.get(name);
              return typeof v === 'string' ? v.trim() : '';
            };
            setAll({ q: typed('q'), country: typed('country').toUpperCase() });
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
            <option value="UNKNOWN">location not stated</option>
          </select>
          <select
            aria-label="Employment type"
            value={employmentType}
            onChange={(e) => set('employmentType', e.target.value)}
          >
            <option value="">any form of work</option>
            {EMPLOYMENT_TYPES.map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </select>
          {/* a country is a code masi checks (an unknown one is its 400, shown above the list); the search sends it */}
          <input
            key={`country-${country}`}
            type="text"
            name="country"
            className="masi-country"
            aria-label="Country"
            placeholder="country (EE)"
            maxLength={2}
            pattern="[A-Za-z]{2}"
            autoCapitalize="characters"
            defaultValue={country}
          />
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
        {(figure || salary || titleNorm || tag || seniority) && (
          <FigureFilterNote
            parts={[
              ...(figure
                ? [`${EVENT_WORDS[figure.event]} ${windowLabel(figure.from, figure.to)}`]
                : []),
              ...(salary ? [SALARY_WORDS[salary]] : []),
              ...(titleNorm ? [`titled "${titleNorm}"`] : []),
              ...(tag ? [`tagged ${tag}`] : []),
              ...(seniority ? [`seniority ${seniority}`] : []),
            ]}
            onClear={() => setAll(Object.fromEntries(FIGURE_KEYS.map((k) => [k, ''])))}
          />
        )}
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
                <th>
                  <button type="button" className="sortable-th" onClick={() => sortBy('title')}>
                    Title{sortMark('title')}
                  </button>
                </th>
                <th>Company</th>
                <th>Sources</th>
                <th>Location</th>
                <th>
                  <button
                    type="button"
                    className="sortable-th"
                    onClick={() => sortBy('firstSeenAt')}
                  >
                    First seen{sortMark('firstSeenAt')}
                  </button>
                </th>
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
                    {j.status !== 'MERGED' && j.reopenedCount > 0 && (
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
