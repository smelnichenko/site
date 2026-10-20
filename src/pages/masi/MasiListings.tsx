import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiListings, MasiListingRow, Paged } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDate, pageParam } from './format';
import FigureFilterNote from './FigureFilterNote';
import { figureParams, LISTING_EVENTS, windowLabel } from './figureLinks';

const PAGE_SIZE = 50;
const EVENT_WORDS = { NEW: 'first seen', CLOSED: 'closed' } as const;

/**
 * Every board's card for a job, newest first: what a report's listing figures lead to - a source's listings first seen
 * or closed in the report's period. The filter lives in the URL, as the report's link wrote it.
 */
export default function MasiListings() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState<Paged<MasiListingRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const figure = figureParams(params, LISTING_EVENTS);
  const source = params.get('source') ?? '';
  const pageNo = pageParam(params.get('page'));

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiListings(
      {
        event: figure?.event,
        from: figure?.from,
        to: figure?.to,
        source: source || undefined,
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
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load listings'));
      });
    return () => controller.abort();
    // the figure's parts, not the object: a new one each render would refetch for ever
  }, [figure?.event, figure?.from, figure?.to, source, pageNo]);

  function set(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in values)) next.delete('page');
    setParams(next);
  }

  const total = page?.totalElements ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const parts = [
    ...(figure ? [`${EVENT_WORDS[figure.event]} ${windowLabel(figure.from, figure.to)}`] : []),
    ...(source ? [`on ${source}`] : []),
  ];
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Listings</span>
          <span className="muted">{page ? `${total} matching` : ''}</span>
        </div>
        {parts.length > 0 && (
          <FigureFilterNote
            parts={parts}
            onClear={() => set({ event: '', from: '', to: '', source: '' })}
          />
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading listings...</div>}
        {page?.content.length === 0 && <div className="empty-state">No listings match.</div>}
        {page && page.content.length > 0 && (
          <MasiTable label="Listings">
            <thead>
              <tr>
                <th>Job</th>
                <th>Company</th>
                <th>On the board</th>
                <th>Source</th>
                <th>First seen</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/masi/jobs/${l.jobId}`}>{l.jobTitle ?? `job ${l.jobId}`}</Link>
                  </td>
                  <td>
                    {l.companyId ? (
                      <Link to={`/masi/companies/${l.companyId}`}>{l.companyName}</Link>
                    ) : (
                      (l.companyName ?? '')
                    )}
                  </td>
                  <td className="masi-listing-url">
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.title}
                    </a>
                  </td>
                  <td>{l.sourceName ?? l.sourceKey ?? ''}</td>
                  <td>{formatDate(l.firstSeenAt)}</td>
                  <td>
                    {l.closedAt ? (
                      formatDate(l.closedAt)
                    ) : (
                      <span className="muted">still listed</span>
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
              onClick={() => set({ page: String(pageNo - 1) })}
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
              onClick={() => set({ page: String(pageNo + 1) })}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
