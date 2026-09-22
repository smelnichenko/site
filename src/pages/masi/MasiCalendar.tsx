import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createMasiCalendarEvent,
  deleteMasiCalendarEvent,
  fetchMasiCalendar,
  MasiCalendar as Calendar,
  MasiCalendarEvent as Event,
  MASI_DAY_KINDS,
  MASI_EVENT_KINDS,
  MASI_EVENT_OUTCOMES,
  updateMasiCalendarEvent,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage } from './format';
import {
  addDays,
  addMonths,
  clockOf,
  Day,
  dayOf,
  fromLocalInput,
  monthGrid,
  startOf,
  toLocalInput,
  weekOf,
} from './calendarTime';

type View = 'month' | 'week' | 'day';

const VIEWS: View[] = ['month', 'week', 'day'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The hours a working day is drawn over; anything outside them is listed above the grid, never hidden. */
const FIRST_HOUR = 8;
const LAST_HOUR = 20;
const HOUR_PX = 40;
/** A default meeting: long enough to read as a block, short enough not to swallow the afternoon. */
const DEFAULT_MINUTES = 60;
/** How many chips a month cell shows of each kind before it says "+N": a cell is an inch tall, not a list. */
const CELL_CHIPS = 3;

const KIND_WORDS: Record<Event['kind'], string> = {
  CALL: 'call',
  INTERVIEW: 'interview',
  FOLLOW_UP: 'follow-up',
  DEADLINE: 'deadline',
  OTHER: 'other',
};

const OUTCOME_WORDS: Record<Event['outcome'], string> = {
  NONE: 'not yet',
  DONE: 'done',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no show',
};

interface Draft {
  id: number | null;
  kind: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  title: string;
  location: string;
  notes: string;
  outcome: string;
  jobId: number | null;
  companyId: number | null;
  contactId: number | null;
}

function monthLabel(day: Day): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function dayLabel(day: Day): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Mon 21": what a week column's head says, where the year and the month are already in the page's heading. */
function shortLabel(day: Day): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The days a view covers, inclusive: the month's six weeks, the week's seven days, or the one day. */
function rangeOf(view: View, anchor: Day): Day[] {
  if (view === 'month') return monthGrid(anchor);
  if (view === 'week') return weekOf(anchor);
  return [anchor];
}

/** What the bar says the page is showing. */
function headingOf(view: View, anchor: Day, from: Day): string {
  if (view === 'month') {
    return monthLabel(anchor);
  }
  if (view === 'week') {
    return `Week of ${dayLabel(from)}`;
  }
  return dayLabel(anchor);
}

function emptyDraft(day: Day, hour = 10, jobId: number | null = null): Draft {
  const startsAt = `${day}T${String(hour).padStart(2, '0')}:00`;
  return {
    id: null,
    kind: 'CALL',
    startsAt,
    endsAt: `${day}T${String(hour + 1).padStart(2, '0')}:00`,
    allDay: false,
    title: '',
    location: '',
    notes: '',
    outcome: 'NONE',
    jobId,
    companyId: null,
    contactId: null,
  };
}

function draftOf(e: Event): Draft {
  return {
    id: e.id,
    kind: e.kind,
    startsAt: toLocalInput(e.startsAt),
    endsAt: toLocalInput(e.endsAt),
    allDay: e.allDay,
    title: e.title,
    location: e.location ?? '',
    notes: e.notes ?? '',
    outcome: e.outcome,
    jobId: e.jobId,
    companyId: e.companyId,
    contactId: e.contactId,
  };
}

/** A block's classes: its kind colours it, a cancelled booking is struck through. */
function blockClass(e: Event): string {
  return kindClass('masi-block', e);
}

/** What a head chip says before the title: the hour it starts, that it is all day, or that it carries on from before. */
function headPrefix(e: Event, day: Day): string {
  if (e.allDay) {
    return 'all day: ';
  }
  if (continuing(e, day)) {
    return 'continues: ';
  }
  return `${clockOf(e.startsAt)} `;
}

/** A chip's, in a month cell or a column head: the same kind, the same colour. */
function chipClass(e: Event): string {
  return kindClass('masi-chip', e);
}

function kindClass(base: string, e: Event): string {
  const classes = [base, `masi-${e.kind.toLowerCase()}`];
  if (e.outcome === 'CANCELLED') {
    classes.push('masi-cancelled');
  }
  return classes.join(' ');
}

/** Minutes from a day's midnight, in masi's zone: negative before it, past the day's length after it. */
function minutesWithin(day: Day, iso: string): number {
  return (Date.parse(iso) - Date.parse(startOf(day))) / 60_000;
}

/** Where a block sits on ONE day's hour grid: an event that spans days is clipped to the day being drawn. */
function blockStyle(e: Event, day: Day): { top: number; height: number } {
  const from = Math.max(minutesWithin(day, e.startsAt), FIRST_HOUR * 60);
  const to = Math.min(minutesWithin(day, e.endsAt), (LAST_HOUR + 1) * 60);
  return {
    top: ((from - FIRST_HOUR * 60) / 60) * HOUR_PX,
    height: (Math.max(to - from, 0) / 60) * HOUR_PX,
  };
}

/**
 * True when the event covers some, but not all, of the hours this day's grid draws. One that covers the whole of them —
 * an all-day booking, or the middle day of a conference — is listed in the head instead: as a block it would take a
 * lane from the calls that actually happen at an hour, and say nothing the head does not.
 */
function onGrid(e: Event, day: Day): boolean {
  const from = minutesWithin(day, e.startsAt);
  const to = minutesWithin(day, e.endsAt);
  return (
    !e.allDay &&
    to > FIRST_HOUR * 60 &&
    from < (LAST_HOUR + 1) * 60 &&
    !(from <= FIRST_HOUR * 60 && to >= (LAST_HOUR + 1) * 60)
  );
}

/** True when the event started before this day: the head says it goes on rather than repeating its clock. */
function continuing(e: Event, day: Day): boolean {
  return minutesWithin(day, e.startsAt) < 0;
}

/** One event's place among those it shares its hours with: which lane of how many. */
interface Placed {
  event: Event;
  lane: number;
  lanes: number;
}

/**
 * Side by side rather than on top of each other: events that overlap in time are laid out in lanes. Events are walked
 * in start order; a run of them that overlaps transitively is one cluster, and every event in a cluster is drawn in the
 * first lane free at its start, so a 10:00 call beside a 10:00 interview is two half-width blocks, not one hidden one.
 */
function place(events: Event[], day: Day): Placed[] {
  const sorted = [...events].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt),
  );
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const lanes = laneEnds.length || 1;
    cluster.forEach((p) => placed.push({ ...p, lanes }));
    cluster = [];
    laneEnds = [];
  };
  sorted.forEach((event) => {
    const from = minutesWithin(day, event.startsAt);
    const to = minutesWithin(day, event.endsAt);
    if (from >= clusterEnd) {
      close();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= from);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = to;
    clusterEnd = Math.max(clusterEnd, to);
    cluster.push({ event, lane, lanes: 1 });
  });
  close();
  return placed;
}

/** The operator's calendar: what is booked, what the day held, and what closes that day. */
export default function MasiCalendar() {
  const [params, setParams] = useSearchParams();
  const today = dayOf(new Date());
  const asked = params.get('view');
  const view: View = VIEWS.includes(asked as View) ? (asked as View) : 'month';
  const askedDay = params.get('day') ?? '';
  const anchor: Day = /^\d{4}-\d{2}-\d{2}$/.test(askedDay) ? askedDay : today;
  // a job opened its calendar: what is booked from here is about that job
  const job = params.get('job') ? Number(params.get('job')) : null;
  const [data, setData] = useState<Calendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const days = useMemo(
    () => rangeOf(VIEWS.includes(view) ? view : 'month', anchor),
    [view, anchor],
  );
  const from = days[0];
  const to = days[days.length - 1];

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setData(await fetchMasiCalendar(from, to, signal));
      setError(null);
    },
    [from, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the calendar'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  function go(next: Partial<{ view: View; day: Day }>) {
    const q = new URLSearchParams(params);
    if (next.view) q.set('view', next.view);
    if (next.day) q.set('day', next.day);
    setParams(q);
  }

  function shift(by: number) {
    if (view === 'month') go({ day: addMonths(anchor, by) });
    else go({ day: addDays(anchor, by * (view === 'week' ? 7 : 1)) });
  }

  const counts = useMemo(() => {
    const m = new Map<Day, { collected: number; sent: number; communicated: number }>();
    (data?.days ?? []).forEach((d) => m.set(d.day, d));
    return m;
  }, [data]);

  const eventsByDay = useMemo(() => {
    const m = new Map<Day, Event[]>();
    // sorted once, then grouped: each day's list comes out in the order the events start
    const sorted = [...(data?.events ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    sorted.forEach((e) => {
      // every day the event covers, not only the one it starts on: a three-day booking is on all three
      const last = dayOf(new Date(Date.parse(e.endsAt) - 1));
      for (let day = dayOf(e.startsAt); day <= last; day = addDays(day, 1)) {
        m.set(day, [...(m.get(day) ?? []), e]);
      }
    });
    return m;
  }, [data]);

  const deadlinesByDay = useMemo(() => {
    const m = new Map<Day, Calendar['deadlines']>();
    (data?.deadlines ?? []).forEach((d) => {
      const day = dayOf(d.expiresAt);
      m.set(day, [...(m.get(day) ?? []), d]);
    });
    return m;
  }, [data]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const startsAt = fromLocalInput(draft.startsAt);
      const endsAt = fromLocalInput(draft.endsAt) ?? undefined;
      if (!startsAt) throw new Error('Give the event a start');
      const body = {
        kind: draft.kind,
        startsAt,
        endsAt,
        allDay: draft.allDay,
        title: draft.title.trim(),
        location: draft.location.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        outcome: draft.outcome,
        jobId: draft.jobId ?? undefined,
        companyId: draft.companyId ?? undefined,
        contactId: draft.contactId ?? undefined,
      };
      if (draft.id === null) await createMasiCalendarEvent(body);
      else await updateMasiCalendarEvent(draft.id, body);
      setDraft(null);
      await reload();
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving failed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setMessage(null);
    try {
      await deleteMasiCalendarEvent(id);
      setDraft(null);
      await reload();
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Deleting failed'));
    } finally {
      setBusy(false);
    }
  }

  const heading = headingOf(view, anchor, from);

  return (
    <div>
      <MasiNav />
      <div className="card">
        <div className="card-header masi-calendar-header">
          <span className="card-title">Calendar</span>
          <span className="muted">{heading}</span>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-row masi-filters masi-calendar-bar">
          <div className="btn-group" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={v === view ? 'btn-small active' : 'btn-small'}
                aria-pressed={v === view}
                onClick={() => go({ view: v })}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-small"
            aria-label="Earlier"
            onClick={() => shift(-1)}
          >
            ←
          </button>
          <button type="button" className="btn-small" onClick={() => go({ day: today })}>
            Today
          </button>
          <button type="button" className="btn-small" aria-label="Later" onClick={() => shift(1)}>
            →
          </button>
          <button
            type="button"
            className="status-badge action"
            onClick={() => setDraft(emptyDraft(view === 'month' ? today : anchor, 10, job))}
          >
            New event
          </button>
        </div>
        {message && <div className="error">{message}</div>}

        {view === 'month' && (
          <MonthGrid
            days={days}
            anchor={anchor}
            today={today}
            counts={counts}
            eventsByDay={eventsByDay}
            deadlinesByDay={deadlinesByDay}
            onOpenDay={(d) => go({ view: 'day', day: d })}
            onEdit={(e) => setDraft(draftOf(e))}
          />
        )}
        {view !== 'month' && (
          <HourGrid
            days={days}
            today={today}
            counts={counts}
            eventsByDay={eventsByDay}
            deadlinesByDay={deadlinesByDay}
            onEdit={(e) => setDraft(draftOf(e))}
            onPick={(d, hour) => setDraft(emptyDraft(d, hour, job))}
          />
        )}

        {draft && (
          <EventForm
            draft={draft}
            busy={busy}
            onChange={setDraft}
            onSave={() => void save()}
            onDelete={draft.id === null ? undefined : () => void remove(draft.id as number)}
            onClose={() => setDraft(null)}
          />
        )}
      </div>
    </div>
  );
}

interface GridProps {
  days: Day[];
  today: Day;
  counts: Map<Day, { collected: number; sent: number; communicated: number }>;
  eventsByDay: Map<Day, Event[]>;
  deadlinesByDay: Map<Day, Calendar['deadlines']>;
  onEdit: (e: Event) => void;
}

/** Where a day's number sends the reader: that day of the log, narrowed to the kind the number counted. */
function logLink(day: Day, kind: string): string {
  const q = new URLSearchParams({ day });
  if (kind) {
    q.set('kind', kind);
  }
  return `/masi/activity?${q.toString()}`;
}

/** The day's three numbers, each a link into the log of that day. */
function DayCounts({ day, counts }: Readonly<{ day: Day; counts: GridProps['counts'] }>) {
  const c = counts.get(day);
  if (!c || (c.collected === 0 && c.sent === 0 && c.communicated === 0)) return null;
  // each number links to the rows it counted, and to no others
  const items: Array<[string, number, string]> = [
    ['sent', c.sent, MASI_DAY_KINDS.sent.join(',')],
    ['collected', c.collected, MASI_DAY_KINDS.collected.join(',')],
    ['talked', c.communicated, MASI_DAY_KINDS.communicated.join(',')],
  ];
  // a phone column is too narrow for the word: it keeps its first letter there, and the label says both either way
  return (
    <div className="masi-day-counts">
      {items
        .filter(([, n]) => n > 0)
        .map(([word, n, kind]) => (
          <Link key={word} to={logLink(day, kind)} aria-label={`${word} ${n} on ${day}`}>
            <span className="masi-count-word">{word}&nbsp;</span>
            <span className="masi-count-letter" aria-hidden="true">
              {word[0]}
            </span>
            {n}
          </Link>
        ))}
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  today,
  counts,
  eventsByDay,
  deadlinesByDay,
  onOpenDay,
  onEdit,
}: Readonly<GridProps & { anchor: Day; onOpenDay: (d: Day) => void }>) {
  const month = anchor.slice(0, 7);
  return (
    <div className="masi-month" role="grid" aria-label="Month">
      <div className="masi-month-row" role="row">
        {WEEKDAYS.map((w) => (
          <div key={w} className="masi-month-head" role="columnheader">
            {w}
          </div>
        ))}
      </div>
      {weeks(days).map((week) => (
        <div key={week[0]} className="masi-month-row" role="row">
          {week.map((day) => cell(day))}
        </div>
      ))}
    </div>
  );

  function cell(day: Day) {
    const events = eventsByDay.get(day) ?? [];
    const deadlines = deadlinesByDay.get(day) ?? [];
    const shown = events.slice(0, CELL_CHIPS);
    const over = events.length - shown.length + Math.max(deadlines.length - CELL_CHIPS, 0);
    const classes = ['masi-month-cell'];
    if (!day.startsWith(month)) classes.push('masi-outside');
    if (day === today) classes.push('masi-today');
    return (
      <div key={day} className={classes.join(' ')} role="gridcell">
        <button
          type="button"
          className="masi-day-number"
          aria-label={`Open ${dayLabel(day)}`}
          onClick={() => onOpenDay(day)}
        >
          {Number(day.slice(8))}
        </button>
        <DayCounts day={day} counts={counts} />
        {shown.map((e) => (
          <button
            key={e.id}
            type="button"
            className={chipClass(e)}
            title={e.title}
            onClick={() => onEdit(e)}
          >
            {e.allDay ? '' : `${clockOf(e.startsAt)} `}
            {e.title}
          </button>
        ))}
        {deadlines.slice(0, CELL_CHIPS).map((d) => (
          <Link
            key={d.jobId}
            to={`/masi/jobs/${d.jobId}`}
            className="masi-chip masi-deadline-chip"
            title={`${d.title} closes`}
          >
            closes: {d.title}
          </Link>
        ))}
        {over > 0 && (
          <button
            type="button"
            className="masi-chip masi-more"
            aria-label={`${over} more on ${dayLabel(day)}`}
            onClick={() => onOpenDay(day)}
          >
            +{over}
          </button>
        )}
      </div>
    );
  }
}

/** The weeks of a month grid: seven days a row, as the grid draws them. */
function weeks(days: Day[]): Day[][] {
  const out: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    out.push(days.slice(i, i + 7));
  }
  return out;
}

function HourGrid({
  days,
  today,
  counts,
  eventsByDay,
  deadlinesByDay,
  onEdit,
  onPick,
}: Readonly<GridProps & { onPick: (d: Day, hour: number) => void }>) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  return (
    <div className={days.length > 1 ? 'masi-week' : 'masi-week masi-one-day'}>
      <div className="masi-hours" aria-hidden="true">
        <div className="masi-col-head" />
        {hours.map((h) => (
          <div key={h} className="masi-hour" style={{ height: HOUR_PX }}>
            {String(h).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      {days.map((day) => {
        const events = eventsByDay.get(day) ?? [];
        const deadlines = deadlinesByDay.get(day) ?? [];
        const listed = events.filter((e) => !onGrid(e, day));
        return (
          <div key={day} className={day === today ? 'masi-day-col masi-today' : 'masi-day-col'}>
            <div className="masi-col-head">
              <span className="masi-col-day">
                {days.length > 1 ? shortLabel(day) : dayLabel(day)}
              </span>
              <DayCounts day={day} counts={counts} />
              {listed.map((e) => (
                <button key={e.id} type="button" className={chipClass(e)} onClick={() => onEdit(e)}>
                  {headPrefix(e, day)}
                  {e.title}
                </button>
              ))}
              {deadlines.map((d) => (
                <Link
                  key={d.jobId}
                  to={`/masi/jobs/${d.jobId}`}
                  className="masi-chip masi-deadline-chip"
                >
                  closes: {d.title}
                </Link>
              ))}
            </div>
            <div className="masi-slots" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="masi-slot"
                  style={{ height: HOUR_PX }}
                  /* a week is 91 of these: they are a pointer shortcut, and "New event" is the way in from the keyboard */
                  tabIndex={-1}
                  aria-label={`Book ${String(h).padStart(2, '0')}:00 on ${dayLabel(day)}`}
                  onClick={() => onPick(day, h)}
                />
              ))}
              {place(
                events.filter((e) => onGrid(e, day)),
                day,
              ).map(({ event: e, lane, lanes }) => {
                const { top, height } = blockStyle(e, day);
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={blockClass(e)}
                    title={e.title}
                    style={{
                      top,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${(1 / lanes) * 100}% - 4px)`,
                    }}
                    onClick={() => onEdit(e)}
                  >
                    <span className="masi-block-time">{clockOf(e.startsAt)}</span> {e.title}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventForm({
  draft,
  busy,
  onChange,
  onSave,
  onDelete,
  onClose,
}: Readonly<{
  draft: Draft;
  busy: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}>) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <section
      className="masi-event-form"
      aria-label={draft.id === null ? 'New event' : 'Edit event'}
    >
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ev-kind">What</label>
          <select id="ev-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value })}>
            {MASI_EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_WORDS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group masi-grow">
          <label htmlFor="ev-title">Title</label>
          <input
            id="ev-title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ev-start">Starts</label>
          <input
            id="ev-start"
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => {
              const startsAt = e.target.value;
              const ends = fromLocalInput(startsAt);
              const endsAt = ends
                ? toLocalInput(new Date(Date.parse(ends) + DEFAULT_MINUTES * 60_000).toISOString())
                : draft.endsAt;
              set({ startsAt, endsAt });
            }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ev-end">Ends</label>
          <input
            id="ev-end"
            type="datetime-local"
            value={draft.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ev-allday">All day</label>
          <input
            id="ev-allday"
            type="checkbox"
            checked={draft.allDay}
            onChange={(e) => set({ allDay: e.target.checked })}
          />
        </div>
        <div className="form-group masi-grow">
          <label htmlFor="ev-where">Where</label>
          <input
            id="ev-where"
            value={draft.location}
            maxLength={300}
            placeholder="a room, a phone number, a link"
            onChange={(e) => set({ location: e.target.value })}
          />
        </div>
        <div className="form-group masi-grow">
          <label htmlFor="ev-notes">Notes</label>
          <input
            id="ev-notes"
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
        {draft.id !== null && (
          <div className="form-group">
            <label htmlFor="ev-outcome">Outcome</label>
            <select
              id="ev-outcome"
              value={draft.outcome}
              onChange={(e) => set({ outcome: e.target.value })}
            >
              {MASI_EVENT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_WORDS[o]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="form-row">
        <LoadingButton
          className="status-badge action"
          onClick={onSave}
          loading={busy}
          disabled={!draft.title.trim()}
          label={draft.id === null ? 'Book it' : 'Save'}
        />
        {onDelete && (
          <button type="button" className="btn-small" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        )}
        <button type="button" className="btn-small" onClick={onClose} disabled={busy}>
          Close
        </button>
        {draft.jobId !== null && (
          <Link className="btn-small" to={`/masi/jobs/${draft.jobId}`}>
            the job
          </Link>
        )}
      </div>
    </section>
  );
}
