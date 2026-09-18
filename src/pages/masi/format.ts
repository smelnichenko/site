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
