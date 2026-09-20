/** Shared presentation helpers for the masi pages. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `$${Number(v).toFixed(2)}`;
}

/** Hands a fetched file to the browser through a download link: no popup, so no blocker; the URL is revoked once the click has fired. */
export function openBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A page number from the URL: a non-integer or negative value is page 0, never a NaN sent to the API. */
export function pageParam(value: string | null): number {
  const n = Number(value ?? '0');
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Package states as the operator reads them. */
export const PACKAGE_STATES = [
  'NEW',
  'PREPARING',
  'PREPARED',
  'REVIEWED',
  'APPLIED',
  'SKIPPED',
  'FAILED_GUARD',
  'FAILED',
] as const;

export function badgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'PREPARED':
    case 'OK':
    case 'OPEN':
    case 'ACTIVE':
      return 'status-badge success';
    case 'APPLIED':
    case 'REVIEWED':
      return 'status-badge add';
    case 'FAILED':
    case 'FAILED_GUARD':
    case 'FAILING':
    case 'DISABLED_AUTO':
    case 'ERROR':
      return 'status-badge error';
    case 'PREPARING':
    case 'DEGRADED':
      return 'status-badge action';
    default:
      return 'status-badge';
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The last seven days (UTC dates), as the reports page opens. */
export function defaultRange(now = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from: isoDate(from), to: isoDate(to) };
}

/** "23 Mar 2026 – 29 Mar 2026" for a half-open [start, end): the end is exclusive, people read the last day. */
export function periodLabel(start: string, endExclusive: string): string {
  const last = new Date(new Date(endExclusive).getTime() - 1).toISOString();
  return `${formatDate(start)} – ${formatDate(last)}`;
}

/** masi cuts its days, weeks and deadlines in this zone, whatever zone the browser is in. */
export const MASI_ZONE = 'Europe/Tallinn';

/**
 * The last second of the calendar day `date` (YYYY-MM-DD) in `zone`, as an ISO instant: "open until the 31st" runs
 * through the 31st there. Null for a string that is not a date.
 */
export function endOfDayIn(date: string, zone: string = MASI_ZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  if (Number.isNaN(asUtc)) return null;
  // what the zone's wall clock shows at that UTC instant tells its offset there (DST included)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(asUtc));
  const part = (type: string) => Number(parts.find((x) => x.type === type)?.value);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return new Date(asUtc - (wall - asUtc)).toISOString();
}
