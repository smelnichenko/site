/**
 * The sources of a masi from before it paged them, read into the shapes masi sends since. The site deploys first:
 * until masi follows, its GET /sources is every source as an array (and it has no /sources/counts), its dashboard lists
 * every source, a report's snapshot holds every source's health by key with no counts, and its stats list every source
 * with no rest. api.ts reads every answer through here, so the pages only ever see the new shapes; each is made the way
 * masi makes it. Drop this file - and read the answers as the new types directly - once masi answers in the new shapes.
 *
 * No import but types: the fallback goes as one file, and pulls nothing of the pages' (a router) into the API layer.
 */
import type {
  MasiDashboard,
  MasiReport,
  MasiSource,
  MasiSourceCounts,
  MasiSourceFilter,
  MasiSourceState,
  MasiSourceStats,
  MasiSourcesRest,
  MasiStats,
  Paged,
} from './api';

/** A source as the dashboard of a masi before paged sources listed every one. */
export interface OldDashboardSource {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  health: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  running: boolean;
}

/** GET /dashboard of either masi: the new one's counts and sources wanting a look, or the old one's every source. */
export type MasiDashboardAnswer = Omit<MasiDashboard, 'sourceCounts' | 'sourcesAttention'> & {
  sourceCounts?: MasiSourceCounts;
  sourcesAttention?: MasiSource[];
  sources?: OldDashboardSource[];
};

/** A period's stats from either masi: the old one listed every source and sent no rest. */
export type MasiStatsAnswer = Omit<MasiStats, 'sourcesRest'> & {
  sourcesRest?: MasiSourcesRest | null;
};

/** A report from either masi: the old one's snapshot holds every source's health and no counts. */
export type MasiReportAnswer = Omit<MasiReport, 'stats' | 'snapshot'> & {
  stats: MasiStatsAnswer;
  snapshot: Omit<MasiReport['snapshot'], 'sourceCounts'> & {
    sourceCounts?: MasiSourceCounts | null;
  };
};

/** What a "Show" reads of a source. */
type Row = Pick<MasiSource, 'enabled' | 'health' | 'running'>;

/** One source's state (masi SourceState): switched off by its failures, switched off by hand, or its health. */
function stateOf(s: Pick<MasiSource, 'enabled' | 'health'>): string {
  if (s.health === 'DISABLED_AUTO') return 'DISABLED_AUTO';
  if (!s.enabled) return 'OFF';
  return s.health;
}

const UNWELL = new Set(['DEGRADED', 'FAILING', 'DISABLED_AUTO']);

/** Which sources each "Show" lists (masi SourceFilter). */
const IN_SHOW: Record<MasiSourceState, (s: Row) => boolean> = {
  ENABLED: (s) => s.enabled,
  RUNNING: (s) => s.running,
  ATTENTION: (s) => UNWELL.has(stateOf(s)),
  OK: (s) => stateOf(s) === 'OK',
  DEGRADED: (s) => stateOf(s) === 'DEGRADED',
  FAILING: (s) => stateOf(s) === 'FAILING',
  DISABLED_AUTO: (s) => stateOf(s) === 'DISABLED_AUTO',
  OFF: (s) => stateOf(s) === 'OFF',
};

/** Health from the best to the worst (masi SourceFilter.healthRank): anything else ranks with the worst. */
const HEALTH_RANK = ['OK', 'DEGRADED', 'FAILING', 'DISABLED_AUTO'];

function healthRank(health: string): number {
  const rank = HEALTH_RANK.indexOf(health);
  return rank < 0 ? HEALTH_RANK.length - 1 : rank;
}

/** Two keys in Java's String order (masi compares keys so): by code unit, not by locale. */
function byKey(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The daily request cap as masi's sort reads it: a whole number of requests; anything else is none. */
function capOf(configJson: string | null): number | null {
  try {
    const cap: unknown = configJson
      ? (JSON.parse(configJson) as Record<string, unknown>).dailyRequestCap
      : undefined;
    return typeof cap === 'number' && Number.isInteger(cap) && cap >= 0 ? cap : null;
  } catch {
    return null;
  }
}

/** A column's value: text (compared A to Z whatever its case), a number, or null for none. */
type Value = string | number | null;

/** The columns masi sorts its sources by (SourceController.SORTS), each as the browser reads it from a row. */
const SORTS: Record<string, (s: MasiSource) => Value> = {
  name: (s) => s.name,
  kind: (s) => `${s.kind} ${s.scope}`,
  cap: (s) => capOf(s.configJson),
  health: (s) => healthRank(s.health),
  lastSuccessAt: (s) => s.lastSuccessAt,
  // masi now has no next run for a source that will not fire (switched off, or failing): last either way
  nextRunAt: (s) => (s.enabled && s.health !== 'FAILING' ? s.nextRunAt : null),
};

/**
 * Masi's order (ListSort): by the column's value, a missing direction descending; empty values last whichever way;
 * equal values by id the same way, so no page repeats or skips a row.
 */
function ordered(sort: string): (a: MasiSource, b: MasiSource) => number {
  const [column, direction] = sort.split(',');
  const value = SORTS[column] ?? SORTS.name;
  const sign = direction === 'asc' ? 1 : -1;
  return (a, b) => {
    const va = value(a);
    const vb = value(b);
    if ((va === null || va === '') !== (vb === null || vb === ''))
      return va === null || va === '' ? 1 : -1;
    let by = 0;
    if (typeof va === 'string' && typeof vb === 'string') {
      by = va.localeCompare(vb, undefined, { sensitivity: 'base', numeric: true });
    } else if (va !== null && vb !== null) {
      by = Number(va) - Number(vb);
    }
    return sign * (by || a.id - b.id);
  };
}

/**
 * The page of every source that masi would answer for the filter: a key or a name containing the search (case aside),
 * the "Show", the sort (name A to Z when none is asked), the page.
 */
export function pageOf(rows: readonly MasiSource[], filter: MasiSourceFilter): Paged<MasiSource> {
  const needle = (filter.q ?? '').trim().toLowerCase();
  const show = filter.state ? IN_SHOW[filter.state] : undefined;
  const kept = rows
    .filter(
      (s) =>
        (!needle ||
          s.key.toLowerCase().includes(needle) ||
          s.name.toLowerCase().includes(needle)) &&
        (!show || show(s)),
    )
    .sort(ordered(filter.sort || 'name,asc'));
  const start = filter.page * filter.size;
  return {
    content: kept.slice(start, start + filter.size),
    page: filter.page,
    size: filter.size,
    totalElements: kept.length,
  };
}

/** How many sources each "Show" lists, and all of them (masi SourceCounts). */
export function countsOf(rows: readonly Row[]): MasiSourceCounts {
  const counts: MasiSourceCounts = { ALL: rows.length };
  for (const [show, listed] of Object.entries(IN_SHOW) as Array<
    [MasiSourceState, (s: Row) => boolean]
  >) {
    counts[show] = rows.filter(listed).length;
  }
  return counts;
}

/** The most sources wanting a look the dashboard lists (masi DashboardController.ATTENTION_MOST). */
const ATTENTION_MOST = 10;

/**
 * The dashboard as the new masi sends it. The new masi's is taken as it is; the old one's every source is counted, and
 * the ones wanting a look listed worst first, the newest among equals, at most ten (masi SourceFilter.worstFirst) -
 * with no failures and no last error, which it did not send. An answer with neither is no dashboard of either masi:
 * it is refused, never read as "no source wants a look".
 */
export function dashboardOf(answer: MasiDashboardAnswer): MasiDashboard {
  const { sourceCounts, sourcesAttention, sources, ...rest } = answer;
  if (sourceCounts && sourcesAttention) {
    return { ...rest, sourceCounts, sourcesAttention };
  }
  if (!Array.isArray(sources)) {
    throw new TypeError('The dashboard sent no sources: neither their counts nor a list of them');
  }
  const attention = sources
    .filter(IN_SHOW.ATTENTION)
    .sort((a, b) => healthRank(b.health) - healthRank(a.health) || b.id - a.id)
    .slice(0, ATTENTION_MOST)
    .map((s) => ({ ...s, consecutiveFailures: null, lastError: null }));
  return { ...rest, sourceCounts: countsOf(sources), sourcesAttention: attention };
}

/** The most sources a period's stats list by name (masi PeriodStats.TOP_SOURCES). */
const TOP_SOURCES = 25;

/**
 * A period's stats as the new masi sends them. The old masi's list every source with no rest: read as masi reads a
 * period it stored so (PeriodStats.current) - the 25 with the most new listings, then the most closes, then by key, and
 * the others summed; no more than 25 are every source, with an empty rest.
 */
export function statsOf(answer: MasiStatsAnswer): MasiStats {
  const { sourcesRest, ...stats } = answer;
  if (sourcesRest) return { ...stats, sourcesRest };
  if (stats.sources.length <= TOP_SOURCES) {
    return { ...stats, sourcesRest: { sources: 0, newListings: 0, closedListings: 0, runs: {} } };
  }
  const ranked = [...stats.sources].sort(
    (a, b) =>
      b.newListings - a.newListings || b.closedListings - a.closedListings || byKey(a.key, b.key),
  );
  const others: MasiSourceStats[] = ranked.slice(TOP_SOURCES);
  const runs: Record<string, number> = {};
  for (const o of others) {
    for (const [status, n] of Object.entries(o.runs)) runs[status] = (runs[status] ?? 0) + n;
  }
  return {
    ...stats,
    sources: ranked.slice(0, TOP_SOURCES),
    sourcesRest: {
      sources: others.length,
      newListings: others.reduce((sum, o) => sum + o.newListings, 0),
      closedListings: others.reduce((sum, o) => sum + o.closedListings, 0),
      runs,
    },
  };
}

/** The most unwell sources a report names (masi ReportPayload.Snapshot.HEALTH_MOST). */
const HEALTH_MOST = 50;

/** A report's source states, worst first: the order masi stores them in. */
const STATE_RANK = ['OK', 'DEGRADED', 'FAILING', 'DISABLED_AUTO', 'OFF'];

/**
 * A report as the new masi sends it: its stats read by {@link statsOf}, its snapshot with counts and only the sources
 * that wanted a look. A report with no counts is taken for the old masi's - every source's health by key, "DISABLED"
 * for one switched off by hand or by its failures alike - and read as masi reads one it stored so
 * (ReportPayload.Snapshot.current): counted from that map, with no RUNNING (it did not see what ran), and the unwell of
 * it worst first, then by key, at most fifty. Unlike the dashboard, no counts is never a broken answer of the new masi:
 * it reads every report it stored before into today's shape, counts and all.
 */
export function reportOf(answer: MasiReportAnswer): MasiReport {
  const { sourceCounts, ...snapshot } = answer.snapshot;
  const stats = statsOf(answer.stats);
  if (sourceCounts) {
    return { ...answer, stats, snapshot: { ...snapshot, sourceCounts } };
  }
  const states = Object.entries(snapshot.sourceHealth).map(([key, health]): [string, string] => [
    key,
    health === 'DISABLED' ? 'OFF' : health,
  ]);
  const count = (state: string) => states.filter(([, s]) => s === state).length;
  const unwell = states.filter(([, s]) => UNWELL.has(s));
  return {
    ...answer,
    stats,
    snapshot: {
      ...snapshot,
      sourceHealth: Object.fromEntries(
        [...unwell]
          .sort(
            ([ka, a], [kb, b]) => STATE_RANK.indexOf(b) - STATE_RANK.indexOf(a) || byKey(ka, kb),
          )
          .slice(0, HEALTH_MOST),
      ),
      sourceCounts: {
        ALL: states.length,
        // as masi counts it: every source not switched off - an old report has no DISABLED_AUTO, only DISABLED
        ENABLED: states.length - count('OFF'),
        ATTENTION: unwell.length,
        OK: count('OK'),
        DEGRADED: count('DEGRADED'),
        FAILING: count('FAILING'),
        OFF: count('OFF'),
      },
    },
  };
}
