import { Link } from 'react-router-dom';
import type { MasiCalendarEvent } from '../../services/api';
import { dayOf } from './calendarTime';
import { KIND_WORDS, OUTCOME_WORDS } from './calendarWords';
import { formatDate, formatDateTime } from './format';

/** When a booking is: its day for an all-day one, else its day and hour. */
function when(e: MasiCalendarEvent): string {
  return e.allDay ? `${formatDate(e.startsAt)}, all day` : formatDateTime(e.startsAt);
}

interface Props {
  jobId: number;
  /** The job's bookings, loaded with the job itself: arriving late they pushed the note and its button down the page. */
  events: MasiCalendarEvent[] | null;
  error: string | null;
  /** Set for a merged job: its bookings moved to the job it became, and a booking made here would be filed there. */
  mergedIntoId: number | null;
}

/**
 * What is arranged about this position: its calls and interviews, oldest first, each opening its day in the calendar;
 * and a way to book one, which the calendar then files under this job. A merged job has none of its own.
 */
export default function JobBookings({ jobId, events, error, mergedIntoId }: Readonly<Props>) {
  if (mergedIntoId !== null) {
    return (
      <section className="masi-job-bookings" aria-labelledby="masi-bookings-label">
        <h3 id="masi-bookings-label" className="masi-card-label">
          Bookings
        </h3>
        <p className="muted">
          This position was merged: its bookings are on{' '}
          <Link to={`/masi/jobs/${mergedIntoId}`}>the job it became</Link>.
        </p>
      </section>
    );
  }
  return (
    <section className="masi-job-bookings" aria-labelledby="masi-bookings-label">
      <div className="masi-job-bookings-header">
        <h3 id="masi-bookings-label" className="masi-card-label">
          Bookings
        </h3>
        <Link to={`/masi/calendar?job=${jobId}&view=week`}>Book a call or an interview</Link>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {events?.length === 0 && <div className="empty-state">Nothing booked for this position.</div>}
      {events && events.length > 0 && (
        <ul>
          {events.map((e) => (
            <li key={e.id}>
              <Link to={`/masi/calendar?view=day&day=${dayOf(e.startsAt)}&job=${jobId}`}>
                {when(e)}
              </Link>
              {` · ${KIND_WORDS[e.kind]} · ${e.title}`}
              {e.contactName ? ` · with ${e.contactName}` : ''}
              {e.outcome !== 'NONE' && (
                <>
                  {' '}
                  <span className="masi-tag">{OUTCOME_WORDS[e.outcome]}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
