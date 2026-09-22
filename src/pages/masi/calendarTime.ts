import { MASI_ZONE } from './format';

/**
 * A calendar day, YYYY-MM-DD: the calendar is the operator's, cut in {@link MASI_ZONE} whatever zone the browser is in.
 * A branded string, so a day and an ISO instant (both strings) cannot be passed for one another by accident.
 */
export type Day = string & { readonly __day?: unique symbol };

export interface Wall {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** What the zone's wall clock shows at an instant. */
export function wallAt(instant: Date | string, zone: string = MASI_ZONE): Wall {
  const parts = formatter(zone).formatToParts(
    typeof instant === 'string' ? new Date(instant) : instant,
  );
  const part = (type: string) => Number(parts.find((x) => x.type === type)?.value);
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
  };
}

function wallAsUtc(w: Wall): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
}

/**
 * The instant the zone's wall clock reads `w`. Two passes: the offset read at a first guess is corrected by the offset
 * at the answer, so a time on the far side of a DST change lands right. A wall time that does not exist (the spring
 * gap) comes out an hour later, and one that exists twice (the autumn repeat) is its first occurrence.
 */
export function instantOf(w: Wall, zone: string = MASI_ZONE): string {
  const target = wallAsUtc(w);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const shown = wallAsUtc(wallAt(new Date(guess), zone));
    guess += target - shown;
  }
  return new Date(guess).toISOString();
}

/** The calendar day an instant falls on, in the zone. */
export function dayOf(instant: Date | string, zone: string = MASI_ZONE): Day {
  const w = wallAt(instant, zone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** The instant a day starts in the zone. */
export function startOf(day: Day, zone: string = MASI_ZONE): string {
  const [year, month, d] = day.split('-').map(Number);
  return instantOf({ year, month, day: d, hour: 0, minute: 0 }, zone);
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayOf(day: Day): number {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The Monday of the day's week. */
export function mondayOf(day: Day): Day {
  return addDays(day, -weekdayOf(day));
}

export function weekOf(day: Day): Day[] {
  const monday = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Six weeks from the Monday on or before the 1st: every month fits, and the grid never changes height. */
export function monthGrid(day: Day): Day[] {
  const first = `${day.slice(0, 7)}-01`;
  const monday = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(monday, i));
}

export function addMonths(day: Day, n: number): Day {
  const [y, m] = day.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Minutes past the day's midnight on the zone's wall clock — where an event sits on an hour grid. */
export function minuteOfDay(instant: string, zone: string = MASI_ZONE): number {
  const w = wallAt(instant, zone);
  return w.hour * 60 + w.minute;
}

/** "HH:MM" on the zone's wall clock. */
export function clockOf(instant: string, zone: string = MASI_ZONE): string {
  const w = wallAt(instant, zone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** The value a `datetime-local` input shows for an instant: the zone's wall clock, whatever the browser's zone. */
export function toLocalInput(instant: string, zone: string = MASI_ZONE): string {
  const w = wallAt(instant, zone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** The instant a `datetime-local` value means, read as the zone's wall clock; null for anything else. */
export function fromLocalInput(value: string, zone: string = MASI_ZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  return instantOf({ year, month, day, hour, minute }, zone);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
