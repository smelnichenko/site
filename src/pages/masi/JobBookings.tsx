import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMasiJobBookings, MasiCalendarEvent } from '../../services/api';
import { dayOf } from './calendarTime';
import { KIND_WORDS, OUTCOME_WORDS } from './calendarWords';
import { errorMessage, formatDate, formatDateTime } from './format';

/** When a booking is: its day for an all-day one, else its day and hour. */
function when(e: MasiCalendarEvent): string {
  return e.allDay ? `${formatDate(e.startsAt)}, all day` : formatDateTime(e.startsAt);
}

/**
 * What is arranged about this position: its calls and interviews, oldest first, each opening its day in the calendar;
 * and a way to book one, which the calendar then files under this job.
 */
export default function JobBookings({ jobId }: Readonly<{ jobId: number }>) {
  const [events, setEvents] = useState<MasiCalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiJobBookings(jobId, controller.signal)
      .then((found) => {
        setEvents(found);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the bookings'));
      });
    return () => controller.abort();
  }, [jobId]);

  return (
    <section className="masi-job-bookings" aria-label="Bookings for this job">
      <div className="card-header">
        <span className="card-title">Bookings</span>
        <Link to={`/masi/calendar?job=${jobId}&view=week`}>Book a call or an interview</Link>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!events && !error && <div className="loading">Loading bookings...</div>}
      {events?.length === 0 && <div className="empty-state">Nothing booked for this position.</div>}
      {events && events.length > 0 && (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- WebKit drops the list role from a list-style:none list
        <ul className="masi-listings" role="list">
          {events.map((e) => (
            <li key={e.id}>
              <Link to={`/masi/calendar?view=day&day=${dayOf(e.startsAt)}`}>{when(e)}</Link>
              {` · ${KIND_WORDS[e.kind]} · ${e.title}`}
              {e.contactName ? ` · with ${e.contactName}` : ''}
              {e.outcome !== 'NONE' && <span className="masi-tag">{OUTCOME_WORDS[e.outcome]}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
