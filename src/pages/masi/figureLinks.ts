import type {
  MasiResponse,
  MasiJobEvent,
  MasiListingEvent,
  MasiPackageEvent,
  MasiSalaryFigure,
} from '../../services/api';
import { formatDateTime, MASI_ZONE } from './format';

/**
 * Where a report figure leads: the list of exactly the rows it counts. The period travels as the report's own pair of
 * instants, half-open as the figure's (from in, to out) - never as days a browser in another zone would cut again.
 */
export interface FigureWindow {
  from: string;
  to: string;
}

function link(path: string, params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v));
  }
  return `${path}?${q.toString()}`;
}

export function jobsLink(
  w: FigureWindow,
  event: MasiJobEvent,
  extra: {
    company?: number;
    salary?: MasiSalaryFigure;
    titleNorm?: string;
    tag?: string;
    remote?: string;
    seniority?: string;
  } = {},
): string {
  return link('/masi/jobs', { event, from: w.from, to: w.to, ...extra });
}

export function listingsLink(w: FigureWindow, event: MasiListingEvent, source?: string): string {
  return link('/masi/listings', { event, from: w.from, to: w.to, source });
}

export function packagesLink(w: FigureWindow, event: MasiPackageEvent): string {
  return link('/masi/packages', { event, from: w.from, to: w.to });
}

/** The interviews held in the period, of one language applied in if given. */
export function interviewsLink(w: FigureWindow, language?: string): string {
  return link('/masi/bookings', { event: 'INTERVIEW_HELD', from: w.from, to: w.to, language });
}

/** The caller's log rows of one response in the period. */
export function responsesLink(w: FigureWindow, response: MasiResponse): string {
  return link('/masi/activity', { response, from: w.from, to: w.to });
}

/** A figure filter read back from a list page's URL: all three parts and a known event, or nothing at all. */
export function figureParams<E extends string>(
  params: URLSearchParams,
  events: readonly E[],
  key = 'event',
): { event: E; from: string; to: string } | null {
  const event = events.find((e) => e === params.get(key));
  const from = params.get('from');
  const to = params.get('to');
  if (!event || !from || !to) return null;
  return { event, from, to };
}

export const JOB_EVENTS: readonly MasiJobEvent[] = ['NEW', 'CLOSED', 'REPOSTED'];
export const LISTING_EVENTS: readonly MasiListingEvent[] = ['NEW', 'CLOSED'];
export const PACKAGE_EVENTS: readonly MasiPackageEvent[] = ['REQUESTED', 'APPLIED'];
export const SALARY_FIGURES: readonly MasiSalaryFigure[] = ['COUNTED', 'EXCLUDED'];
export const BOOKING_EVENTS: readonly 'INTERVIEW_HELD'[] = ['INTERVIEW_HELD'];
export const RESPONSES: readonly MasiResponse[] = ['REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];
/** A response as the report and the log's filter name it: "3 refused". */
export const RESPONSE_WORDS: Record<MasiResponse, [string, string]> = {
  REPLIED: ['replied', 'replied'],
  INTERVIEW: ['invited to interview', 'invited to interview'],
  OFFER: ['offer', 'offers'],
  REJECTED: ['refused', 'refused'],
};
/** The language key masi gives the interviews whose application's language is not known. */
export const NO_LANGUAGE = 'none';

const DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: MASI_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: MASI_ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * "12 Oct 2026 – 18 Oct 2026" for a period of whole masi days (both ends midnight in its zone): the days people read,
 * the last one the day before the exclusive end, as a report's title says them. Any other window shows both instants.
 */
export function windowLabel(from: string, to: string): string {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${from} – ${to}`;
  const midnight = (d: Date) => CLOCK.format(d) === '00:00:00';
  if (midnight(a) && midnight(b)) {
    return `${DAY.format(a)} – ${DAY.format(new Date(b.getTime() - 1))}`;
  }
  return `${formatDateTime(from)} – ${formatDateTime(to)}`;
}

/** "3 new jobs", "1 new job". */
export function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
