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
