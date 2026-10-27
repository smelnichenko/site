import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiBookings, MasiCalendarEvent, Paged } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDateTime, pageParam } from './format';
import FigureFilterNote from './FigureFilterNote';
import { BOOKING_EVENTS, figureParams, NO_LANGUAGE } from './figureLinks';

const PAGE_SIZE = 50;

/**
 * The caller's bookings, newest first: what a report's interviews lead to - the ones held in its period, of one
 * language applied in. The filter lives in the URL, as the report's link wrote it.
 */
export default function MasiBookings() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState<Paged<MasiCalendarEvent> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const figure = figureParams(params, BOOKING_EVENTS);
  const language = params.get('language') ?? '';
  const pageNo = pageParam(params.get('page'));

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiBookings(
      {
        event: figure?.event,
        from: figure?.from,
        to: figure?.to,
        language: language || undefined,
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
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the bookings'));
      });
    return () => controller.abort();
    // the figure's parts, not the object: a new one each render would refetch for ever
  }, [figure?.event, figure?.from, figure?.to, language, pageNo]);

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
  const period = figure
    ? { words: 'interviews held', from: figure.from, to: figure.to }
    : undefined;
  const parts = language
    ? [language === NO_LANGUAGE ? 'language not known' : `applied in ${language}`]
    : [];
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Bookings</span>
          <span className="muted">{page ? `${total} matching` : ''}</span>
        </div>
        {(period || parts.length > 0) && (
          <FigureFilterNote
            period={period}
            parts={parts}
            onClear={() => set({ event: '', from: '', to: '', language: '' })}
          />
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading bookings...</div>}
        {page?.content.length === 0 && <div className="empty-state">No bookings match.</div>}
        {page && page.content.length > 0 && (
          <MasiTable label="Bookings">
            <thead>
              <tr>
                <th>When</th>
                <th>Booking</th>
                <th>Job</th>
                <th>Company</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.startsAt)}</td>
                  <td className="masi-booking-title">{e.title}</td>
                  <td>
                    {e.jobId ? (
                      <Link to={`/masi/jobs/${e.jobId}`}>{e.jobTitle ?? `job ${e.jobId}`}</Link>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>
                    {e.companyId ? (
                      <Link to={`/masi/companies/${e.companyId}`}>{e.companyName}</Link>
                    ) : (
                      (e.companyName ?? '')
                    )}
                  </td>
                  <td>{e.outcome.toLowerCase().replace('_', ' ')}</td>
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
