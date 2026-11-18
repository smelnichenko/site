/**
 * The sources of a masi from before it paged them (ops plan 118 PR 3), read into the shapes masi sends since. The site
 * deploys first: until masi follows, its GET /sources is every source as an array (and it has no /sources/counts), its
 * dashboard lists every source, a report's snapshot holds every source's health by key with no counts, and its stats
 * list every source with no rest. Each is made here into what masi makes of it now, the way masi makes it, so the
 * pages read one shape. Drop this file, and the calls to it, once masi answers in the new shapes.
 */
import { sortRows, type SortValue } from '../components/sorting';
import type {
  MasiDashboardSource,
  MasiSource,
  MasiSourceCounts,
  MasiSourceFilter,
  MasiSourceState,
  MasiSourceStats,
  MasiSourcesRest,
  Paged,
} from './api';

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

/** The columns masi sorts its sources by (SourceController.SORTS), each as the browser reads it from a row. */
const SORTS: Record<string, (s: MasiSource) => SortValue> = {
  name: (s) => s.name,
  kind: (s) => `${s.kind} ${s.scope}`,
  cap: (s) => capOf(s.configJson),
  health: (s) => healthRank(s.health),
  lastSuccessAt: (s) => s.lastSuccessAt,
  // masi now has no next run for a source that will not fire (switched off, or failing): last either way
  nextRunAt: (s) => (s.enabled && s.health !== 'FAILING' ? s.nextRunAt : null),
};

/**
 * The page of every source that masi would answer for the filter: a key or a name containing the search (case aside),
 * the "Show", the sort (empty values last, then by id the same way; name A to Z when none is asked), the page.
 */
export function pageOf(rows: readonly MasiSource[], filter: MasiSourceFilter): Paged<MasiSource> {
  const needle = (filter.q ?? '').trim().toLowerCase();
  const show = filter.state ? IN_SHOW[filter.state] : undefined;
  const kept = rows.filter(
    (s) =>
      (!needle || s.key.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)) &&
      (!show || show(s)),
  );
  const sorted = sortRows(kept, filter.sort || 'name,asc', SORTS);
  const start = filter.page * filter.size;
  return {
    content: sorted.slice(start, start + filter.size),
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
 * The dashboard's sources: the counts, and the ones wanting a look - worst first, the newest among equals, at most ten
 * (masi SourceFilter.worstFirst). A dashboard of the new masi is taken as it is.
 */
export function dashboardSources(data: {
  sourceCounts?: MasiSourceCounts;
  sourcesAttention?: MasiSource[];
  sources?: MasiDashboardSource[];
}): {
  counts: MasiSourceCounts;
  attention: Array<MasiDashboardSource & Partial<MasiSource>>;
} {
  if (data.sourceCounts && data.sourcesAttention) {
    return { counts: data.sourceCounts, attention: data.sourcesAttention };
  }
  const all = data.sources ?? [];
  const attention = all
    .filter(IN_SHOW.ATTENTION)
    .sort((a, b) => healthRank(b.health) - healthRank(a.health) || b.id - a.id)
    .slice(0, ATTENTION_MOST);
  return { counts: countsOf(all), attention };
}

/** The most unwell sources a report names (masi ReportPayload.Snapshot.HEALTH_MOST). */
const HEALTH_MOST = 50;

/** A report's source states, worst first: the order masi stores them in. */
const STATE_RANK = ['OK', 'DEGRADED', 'FAILING', 'DISABLED_AUTO', 'OFF'];

/**
 * A report's sources: its counts, and the sources that wanted a look, worst first. A report a masi before paged sources
 * stored holds every source's health by key ("DISABLED" for one switched off, by hand or by its failures alike), with
 * no counts: read as masi reads it now (ReportPayload.Snapshot.current) - counted from that map, with no RUNNING (it did
 * not see what ran), and the unwell of it worst first, then by key, at most fifty.
 */
export function reportSources(snapshot: {
  sourceHealth: Record<string, string>;
  sourceCounts?: MasiSourceCounts | null;
}): { counts: MasiSourceCounts; unwell: Array<[string, string]> } {
  if (snapshot.sourceCounts) {
    return { counts: snapshot.sourceCounts, unwell: Object.entries(snapshot.sourceHealth) };
  }
  const states = Object.entries(snapshot.sourceHealth).map(([key, health]): [string, string] => [
    key,
    health === 'DISABLED' ? 'OFF' : health,
  ]);
  const count = (state: string) => states.filter(([, s]) => s === state).length;
  const unwell = states
    .filter(([, s]) => UNWELL.has(s))
    .sort(([ka, a], [kb, b]) => STATE_RANK.indexOf(b) - STATE_RANK.indexOf(a) || byKey(ka, kb))
    .slice(0, HEALTH_MOST);
  return {
    counts: {
      ALL: states.length,
      // as masi counts it: every source not switched off - an old report has no DISABLED_AUTO, only DISABLED
      ENABLED: states.length - count('OFF'),
      ATTENTION: states.filter(([, s]) => UNWELL.has(s)).length,
      OK: count('OK'),
      DEGRADED: count('DEGRADED'),
      FAILING: count('FAILING'),
      OFF: count('OFF'),
    },
    unwell,
  };
}

/** The most sources a period's stats list by name (masi PeriodStats.TOP_SOURCES). */
const TOP_SOURCES = 25;

/**
 * A period's sources: the rows listed by name and the rest summed. Stats from a masi before paged sources list every
 * source with no rest: cut as masi cuts them now (PeriodStats.current) - the 25 with the most new listings, then the
 * most closes, then by key - and the others summed. A few rows and no rest are every source: nothing to cut.
 */
export function topSources(stats: {
  sources: MasiSourceStats[];
  sourcesRest?: MasiSourcesRest | null;
}): { rows: MasiSourceStats[]; rest: MasiSourcesRest | null } {
  if (stats.sourcesRest || stats.sources.length <= TOP_SOURCES) {
    return { rows: stats.sources, rest: stats.sourcesRest ?? null };
  }
  const ranked = [...stats.sources].sort(
    (a, b) =>
      b.newListings - a.newListings || b.closedListings - a.closedListings || byKey(a.key, b.key),
  );
  const others = ranked.slice(TOP_SOURCES);
  const runs: Record<string, number> = {};
  for (const o of others) {
    for (const [status, n] of Object.entries(o.runs)) runs[status] = (runs[status] ?? 0) + n;
  }
  return {
    rows: ranked.slice(0, TOP_SOURCES),
    rest: {
      sources: others.length,
      newListings: others.reduce((sum, o) => sum + o.newListings, 0),
      closedListings: others.reduce((sum, o) => sum + o.closedListings, 0),
      runs,
    },
  };
}
