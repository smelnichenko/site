import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SortableHeader } from '../../components/SortableHeader';
import { sortRows, useUrlSort, type SortValue } from '../../components/sorting';
import { DeploymentSwitches, SourceConfig } from './SourceConfig';
import {
  fetchMasiAssistant,
  fetchMasiSource,
  fetchMasiSourceList,
  fetchMasiSourceRuns,
  MasiAssistant,
  MasiSource,
  MasiSourceCounts,
  MasiSourceRun,
  MasiSourceState,
  Paged,
  patchMasiAssistant,
  patchMasiSource,
  runMasiSource,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDateTime, noteClass, pageParam } from './format';
import MasiTable from '../../components/MasiTable';
import PictureStatus from './PictureStatus';
import { showOf, SHOW_WORDS, SHOWS } from './sourceStates';

/** A page of sources: the operator's choice (2026-11-18), as masi's own default. */
const PAGE_SIZE = 50;

/** A draft the operator is still editing (differs from what the server had) survives the reload every action triggers. */
function keepEdits(
  drafts: Record<number, string>,
  before: Map<number, string>,
  list: MasiSource[],
): Record<number, string> {
  const next: Record<number, string> = {};
  for (const s of list) {
    const edited = s.id in drafts && drafts[s.id] !== before.get(s.id);
    next[s.id] = edited ? drafts[s.id] : s.cron;
  }
  return next;
}

/** The daily request cap a source's config carries, or '' for none. The collector enforces it; the rest of the config is not ours to touch here. */
function capOf(configJson: string | null): string {
  try {
    const cap: unknown = configJson
      ? (JSON.parse(configJson) as Record<string, unknown>).dailyRequestCap
      : undefined;
    return typeof cap === 'number' ? String(cap) : '';
  } catch {
    return '';
  }
}

/** The config with the cap set (a whole number of requests) or removed (''); the other keys as they were. */
function withCap(configJson: string | null, cap: string): string {
  let config: Record<string, unknown> = {};
  try {
    config = configJson ? (JSON.parse(configJson) as Record<string, unknown>) : {};
  } catch {
    config = {};
  }
  if (cap === '') delete config.dailyRequestCap;
  else config.dailyRequestCap = Number(cap);
  return JSON.stringify(config);
}

/** The assistant's state beside its switch: off, or on and whether its Gmail and LinkedIn are ready; nothing until read. */
function assistantNote(assistant: MasiAssistant | null): string {
  if (!assistant) {
    return '';
  }
  if (!assistant.enabled) {
    return 'off';
  }
  const gmail = assistant.gmailReady ? 'ready' : 'no credentials';
  const linkedin = assistant.linkedinReady ? 'ready' : 'no cookie';
  return `on · gmail ${gmail} · linkedin ${linkedin}`;
}

/** The runs of every given source, or null for a page that has been left: a poll is not worth an error either way. */
async function readRuns(
  ids: number[],
  signal: AbortSignal,
  alive: boolean,
): Promise<Paged<MasiSourceRun>[] | null> {
  const fresh = await Promise.all(ids.map((id) => fetchMasiSourceRuns(id, signal)));
  return alive && fresh.every(Boolean) ? fresh : null;
}

/** The page's per-source runs with the ones just read put in place of the old. */
function mergeRuns(
  cur: Record<number, MasiSourceRun[]>,
  ids: number[],
  fresh: Paged<MasiSourceRun>[],
): Record<number, MasiSourceRun[]> {
  const next = { ...cur };
  ids.forEach((id, i) => {
    next[id] = fresh[i].content;
  });
  return next;
}

/** How far a running source has got: what its newest unfinished run has recorded, or '' when it has said nothing yet. */
function progressOf(row: MasiSourceRun | undefined, now: number): string {
  if (!row?.startedAt) return '';
  const minutes = Math.max(0, Math.round((now - Date.parse(row.startedAt)) / 60000));
  const parts: string[] = [];
  if (row.fetched > 0) parts.push(`${row.fetched.toLocaleString()} calls`);
  if (row.newContacts > 0) parts.push(`${row.newContacts.toLocaleString()} people`);
  parts.push(`${minutes} min`);
  return parts.join(' · ');
}

/** What each column of a source's runs sorts by; the error by whether there is one. */
const RUN_SORTS: Record<string, (r: MasiSourceRun) => SortValue> = {
  startedAt: (r) => r.startedAt,
  status: (r) => r.status,
  parsed: (r) => r.parsed,
  newJobs: (r) => r.newJobs,
  closedListings: (r) => r.closedListings,
  newCompanies: (r) => r.newCompanies,
  error: (r) => (r.error ? 1 : 0),
};

/** A source's last runs, sorted here (the 20 newest: the page's poll reads their newest first). */
function SourceRuns({
  sourceKey,
  runs,
  sort,
  onSort,
}: Readonly<{
  sourceKey: string;
  runs: MasiSourceRun[];
  sort: string;
  onSort: (next: string) => void;
}>) {
  const head = (column: string, label: string) => (
    <SortableHeader column={column} label={label} sort={sort} onSort={onSort} />
  );
  return (
    <table className="table masi-runs" data-testid={`runs-${sourceKey}`}>
      <thead>
        <tr>
          {head('startedAt', 'Started')}
          {head('status', 'Status')}
          {head('parsed', 'Parsed')}
          {head('newJobs', 'New jobs')}
          {head('closedListings', 'Closed')}
          {head('newCompanies', 'Companies')}
          {head('error', 'Error')}
        </tr>
      </thead>
      <tbody>
        {sortRows(runs, sort, RUN_SORTS).map((r) => (
          <tr key={r.id}>
            <td>{formatDateTime(r.startedAt)}</td>
            <td>
              <span className={badgeClass(r.status)}>
                {r.status.toLowerCase().replace('_', ' ')}
              </span>
              {!r.complete && r.status === 'OK' ? ' (incomplete)' : ''}
            </td>
            <td>{r.parsed}</td>
            <td>{r.newJobs}</td>
            <td>{r.closedListings}</td>
            <td>{r.newCompanies}</td>
            <td>{r.error && <span className={noteClass(r.status)}>{r.error}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A source's health as the "Show" select names it: switched off by its failures is "auto-disabled". */
function healthWords(health: string): string {
  return health === 'DISABLED_AUTO' ? SHOW_WORDS.DISABLED_AUTO : health.toLowerCase();
}

/** "(225)" after a "Show", once the counts are read. */
function counted(counts: MasiSourceCounts | null, show: MasiSourceState | 'ALL'): string {
  return counts ? ` (${counts[show]})` : '';
}

/**
 * The sources' search and "Show", each choice with how many it lists; a new search or choice starts at the first page
 * (the parent drops the page with it). Each named on the page, as masi's other filter rows are: a placeholder goes as
 * the first letter is typed. An emptied search box lists every source again at once - no press of Search to undo one.
 */
function SourceFilters({
  q,
  show,
  counts,
  onChange,
}: Readonly<{
  q: string;
  show: MasiSourceState | undefined;
  counts: MasiSourceCounts | null;
  onChange: (key: 'q' | 'state', value: string) => void;
}>) {
  // what is typed, until searched; a search the URL changes (back, a link) is shown in its place
  const [typed, setTyped] = useState(q);
  const [searched, setSearched] = useState(q);
  if (q !== searched) {
    setSearched(q);
    setTyped(q);
  }
  return (
    <form
      className="form-row masi-filters"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onChange('q', typed.trim());
      }}
    >
      <label htmlFor="source-q">Key or name</label>
      <input
        id="source-q"
        type="search"
        name="q"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          // emptied (by keys, or the box's own clear): every source again, the focus kept for the next search
          if (e.target.value === '' && q !== '') onChange('q', '');
        }}
      />
      <button type="submit" className="btn-small">
        Search
      </button>
      <label htmlFor="source-show">Show</label>
      <select
        id="source-show"
        value={show ?? ''}
        onChange={(e) => onChange('state', e.target.value)}
      >
        <option value="">all{counted(counts, 'ALL')}</option>
        {SHOWS.map((s) => (
          <option key={s} value={s}>
            {SHOW_WORDS[s]}
            {counted(counts, s)}
          </option>
        ))}
      </select>
    </form>
  );
}

/**
 * The collector agents, a page at a time - a few hundred, and a list read whole grows with them: search a key or a
 * name, show one state or group with how many each lists, sorted by masi; enable, cron, requests a day, run now, and an opened source's config and last runs.
 * With `sourceId` (the route /masi/sources/:id), that source alone, opened. A source without a bean (FAILING) cannot be
 * enabled.
 */
export default function MasiSources({ sourceId }: Readonly<{ sourceId?: number }>) {
  const alone = sourceId !== undefined;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const show = showOf(params.get('state'));
  const pageNo = pageParam(params.get('page'));
  const { sort, setSort } = useUrlSort('name,asc');
  // a source's last runs: the 20 newest, sorted here - the page's poll reads their newest first; their sort keeps the
  // page of sources where it is
  const { sort: runsSort, setSort: setRunsSort } = useUrlSort('startedAt,desc', 'runsSort', false);
  const [sources, setSources] = useState<MasiSource[] | null>(null);
  /** The page the rows in view are of, and how many the filter lists in all. */
  const [listed, setListed] = useState<{ page: number; total: number } | null>(null);
  const [counts, setCounts] = useState<MasiSourceCounts | null>(null);
  /** Bumped by an action: the page and its counts are read again, with the filters as they are by then. */
  const [reloads, setReloads] = useState(0);
  const [runs, setRuns] = useState<Record<number, MasiSourceRun[]>>({});
  const [openId, setOpenId] = useState<number | null>(sourceId ?? null);
  const [cronDraft, setCronDraft] = useState<Record<number, string>>({});
  const [capDraft, setCapDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [assistant, setAssistant] = useState<MasiAssistant | null>(null);
  /** The assistant's own failure, beside its switch: the list's loads neither show it nor clear it. */
  const [assistantError, setAssistantError] = useState<string | null>(null);

  /** The list's top: where a page change takes the window and the focus. */
  const listTop = useRef<HTMLElement>(null);
  const serverCron = useRef<Map<number, string>>(new Map());
  const take = useCallback((list: MasiSource[]) => {
    const before = serverCron.current;
    setCronDraft((drafts) => keepEdits(drafts, before, list));
    serverCron.current = new Map(list.map((s) => [s.id, s.cron]));
    setSources(list);
  }, []);
  /**
   * The page in view and every "Show"'s count with it; alone, the one source. Read again when the filters change and
   * after an action (`reloads`), only ever here: a new read aborts the one before it, and an answer that lands after
   * its read was left is dropped - an older page never shows under a newer URL.
   */
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        if (sourceId === undefined) {
          const answer = await fetchMasiSourceList(
            { q: q || undefined, state: show, sort, page: pageNo, size: PAGE_SIZE },
            signal,
          );
          if (signal.aborted) return;
          take(answer.page.content);
          setListed({ page: pageNo, total: answer.page.totalElements });
          setCounts(answer.counts);
        } else {
          const one = await fetchMasiSource(sourceId, signal);
          if (signal.aborted) return;
          take([one]);
        }
        setError(null);
      } catch (e: unknown) {
        if (!signal.aborted) setError(errorMessage(e, 'Failed to load sources'));
      }
    })();
    return () => controller.abort();
  }, [sourceId, q, show, sort, pageNo, take, reloads]);

  // a page past the last - asked for, or emptied by an action that moved its last row away - is the last page
  useEffect(() => {
    if (listed?.page !== pageNo || sources?.length !== 0) return;
    if (pageNo > 0 && listed.total > 0) {
      const next = new URLSearchParams(params);
      next.set('page', String(Math.ceil(listed.total / PAGE_SIZE) - 1));
      setParams(next, { replace: true });
    }
  }, [listed, pageNo, sources, params, setParams]);

  // the assistant's switch is the list's, not a source's: read once, not with every page
  useEffect(() => {
    if (alone) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        setAssistant(await fetchMasiAssistant(controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted) {
          setAssistantError(errorMessage(e, 'Failed to load the assistant'));
        }
      }
    })();
    return () => controller.abort();
  }, [alone]);

  // alone, the source is opened: its runs read at once, as a press on its name reads them
  useEffect(() => {
    if (sourceId === undefined) return undefined;
    const controller = new AbortController();
    fetchMasiSourceRuns(sourceId, controller.signal).then(
      (r) => setRuns((cur) => ({ ...cur, [sourceId]: r.content })),
      (e: unknown) => {
        if (!controller.signal.aborted) setMessage(errorMessage(e, 'Failed to load runs'));
      },
    );
    return () => controller.abort();
  }, [sourceId]);

  /**
   * While anything is running, its figures are read again every few seconds.
   *
   * The collector writes them as it goes (masi, RunProgress), so this is what turns 'running' into something an
   * operator can watch. Nothing polls when nothing runs: an idle page should not cost requests. Only the page in view
   * is polled: a running source on another page is polled when it is shown.
   */
  /** The instant of the last successful poll: the age shown beside a running source counts from it. */
  const [tick, setTick] = useState(0);
  const runningIds = (sources ?? [])
    .filter((s) => s.running)
    .map((s) => s.id)
    .join(',');
  useEffect(() => {
    if (!runningIds) return;
    const ids = runningIds.split(',').map(Number);
    const controller = new AbortController();
    let alive = true;
    const poll = () => {
      void readRuns(ids, controller.signal, alive).then(
        (fresh) => {
          if (!fresh || !alive) return;
          setRuns((cur) => mergeRuns(cur, ids, fresh));
          setTick(Date.now());
        },
        () => {
          // a poll that fails is left to the next one: the page keeps what it has
        },
      );
    };
    // once at once - a run that started while the page was open is already part way - and then on the interval
    poll();
    const timer = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [runningIds]);

  /**
   * An action, said done as soon as masi has done it; then the page and its counts are read again - a source switched
   * or run may move to another "Show" - by the page's own read, with the filters as they are by then. A read that
   * fails after it is the page's failure, never the action's.
   */
  async function act(id: number, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
      setReloads((n) => n + 1);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The action failed'));
    } finally {
      setBusyId(null);
    }
  }

  async function showRuns(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    try {
      const r = await fetchMasiSourceRuns(id);
      setRuns((cur) => ({ ...cur, [id]: r.content }));
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Failed to load runs'));
    }
  }

  /** A filter changed: in the URL, and back to the first page; a page change keeps the filters. */
  function set(key: 'q' | 'state' | 'page', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  /** A column header, sorted by masi. */
  const head = (column: string, label: ReactNode): ReactElement => (
    <SortableHeader column={column} label={label} sort={sort} onSort={setSort} />
  );

  /** A page change: the new page's rows are at the list's top, and the pager at its bottom - both go there. */
  function toPage(n: number) {
    set('page', String(n));
    const top = listTop.current;
    top?.focus({ preventScroll: true });
    top?.scrollIntoView?.({ block: 'start' });
  }

  /** A source's cron, saved when the field is left with another one. */
  const cronField = (s: MasiSource) => (
    <input
      aria-label={`Cron for ${s.key}`}
      value={cronDraft[s.id] ?? s.cron}
      onChange={(e) => setCronDraft((cur) => ({ ...cur, [s.id]: e.target.value }))}
      onBlur={() => {
        const next = (cronDraft[s.id] ?? s.cron).trim();
        if (next && next !== s.cron)
          void act(s.id, () => patchMasiSource(s.id, { cron: next }), `${s.key}: cron saved`);
      }}
      style={{ width: '10em', fontFamily: 'monospace' }}
    />
  );

  /** A source's daily request cap, saved into its config when the field is left with another whole number or none. */
  const capField = (s: MasiSource) => (
    <input
      type="number"
      min={0}
      step={1}
      aria-label={`Requests per day for ${s.key}`}
      placeholder="no cap"
      value={capDraft[s.id] ?? capOf(s.configJson)}
      onChange={(e) => setCapDraft((cur) => ({ ...cur, [s.id]: e.target.value }))}
      onBlur={(e) => {
        const next = (capDraft[s.id] ?? capOf(s.configJson)).trim();
        if (!e.target.checkValidity()) return; // a negative or fractional cap is not saved
        if (next !== capOf(s.configJson))
          void act(
            s.id,
            () => patchMasiSource(s.id, { configJson: withCap(s.configJson, next) }),
            next === '' ? `${s.key}: no request cap` : `${s.key}: ${next} requests a day`,
          );
      }}
      style={{ width: '6em' }}
    />
  );

  /** A source's health: its badge (running while it runs), how far a run has got, its failures and last note. */
  const healthOf = (s: MasiSource) => (
    <>
      <span className={badgeClass(s.health)}>{s.running ? 'running' : healthWords(s.health)}</span>
      {s.running && progressOf(runs[s.id]?.[0], tick) && (
        <div className="muted" data-testid={`progress-${s.key}`}>
          {progressOf(runs[s.id]?.[0], tick)}
        </div>
      )}
      {s.consecutiveFailures > 0 && (
        <div className="muted">{s.consecutiveFailures} failure(s) in a row</div>
      )}
      {s.lastError && <div className={noteClass(s.health)}>{s.lastError}</div>}
    </>
  );

  /** Switch a source on or off, and run it now. */
  const actionsOf = (s: MasiSource) => (
    <>
      <LoadingButton
        className={s.enabled ? 'status-badge' : 'status-badge add'}
        onClick={() =>
          void act(
            s.id,
            () => patchMasiSource(s.id, { enabled: !s.enabled }),
            `${s.key}: ${s.enabled ? 'disabled' : 'enabled'}`,
          )
        }
        loading={busyId === s.id}
        label={s.enabled ? 'Disable' : 'Enable'}
      />
      <LoadingButton
        className="status-badge action"
        onClick={() => void act(s.id, () => runMasiSource(s.id), `${s.key}: run started`)}
        loading={busyId === s.id}
        label="Run now"
      />
    </>
  );

  /** An opened source: its whole config, its changes and its last runs. */
  const openedOf = (s: MasiSource) => (
    <>
      <SourceConfig id={s.id} configJson={s.configJson} />
      <h3 className="masi-subtitle">Runs</h3>
      {!runs[s.id] && <div className="loading">Loading runs...</div>}
      {runs[s.id]?.length === 0 && <div className="empty-state">No runs yet.</div>}
      {runs[s.id] && runs[s.id].length > 0 && (
        <SourceRuns sourceKey={s.key} runs={runs[s.id]} sort={runsSort} onSort={setRunsSort} />
      )}
    </>
  );

  const total = listed?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let summary = '';
  if (!alone && counts) {
    summary = `${counts.ENABLED} of ${counts.ALL} enabled · ${total} match`;
  }
  const own = alone ? sources?.[0] : undefined;
  return (
    <div className="masi">
      <MasiNav />
      <div className="card masi-sources-card">
        <div className="card-header">
          <span className="card-title">{alone ? (own?.name ?? 'Source') : 'Sources'}</span>
          {alone ? (
            <Link to="/masi/sources" className="muted masi-back-link">
              all sources
            </Link>
          ) : (
            <span className="muted">{summary}</span>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        {!sources && !error && <div className="loading">Loading sources...</div>}
        {sources && !alone && (
          <div className="assistant-switch">
            <label>
              <input
                type="checkbox"
                // not read (yet, or it failed): no state to switch from - an unchecked box would say "off"
                disabled={assistant === null}
                checked={assistant?.enabled ?? false}
                onChange={(e) =>
                  void act(
                    0,
                    () => patchMasiAssistant(e.target.checked).then((a) => setAssistant(a)),
                    'assistant saved',
                  )
                }
              />{' '}
              Assistant (replies from your Gmail, applies on LinkedIn)
            </label>
            {assistantError ? (
              <span className={noteClass('ERROR')}>{assistantError}</span>
            ) : (
              <span className="muted">{assistantNote(assistant)}</span>
            )}
          </div>
        )}
        {sources && !alone && (
          // the list first - it is the page's work; the collection's own panels after it. Focused (not tabbable) when
          // a page changes, so a keyboard and a screen reader start at the new rows
          <section
            className="masi-source-list"
            aria-label="Source list"
            ref={listTop}
            tabIndex={-1}
          >
            <SourceFilters q={q} show={show} counts={counts} onChange={set} />
            {/* empty with rows elsewhere: a page past the last, on its way to the last one */}
            {sources.length === 0 && total === 0 && (
              <div className="empty-state">No sources match.</div>
            )}
            {sources.length > 0 && (
              <MasiTable
                label="Sources"
                className="masi-sources-table"
                // sized for what the cells hold at the narrowest (940 px, so a 1024 px screen holds it whole): the
                // longest kind unbroken (119 px with its padding), the cron field (154 px), the widest health badge
                // (140 px), "Requests/" sorted (it breaks after the slash) and the cap field, the two actions stacked
                // (109 px) - measured in the layout harness, 2026-11-18
                columns={['17%', '13%', '17%', '14%', '15%', '12%', '12%']}
                minWidth={940}
              >
                <thead>
                  <tr>
                    {head('name', 'Source')}
                    {head('kind', 'Kind')}
                    {head('nextRunAt', 'Cron')}
                    {head(
                      'cap',
                      <>
                        Requests/
                        <wbr />
                        day
                      </>,
                    )}
                    {head('health', 'Health')}
                    {head('lastSuccessAt', 'Last success')}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* the server's order: masi sorts the whole list, the page is a slice of it */}
                  {sources.map((s) => (
                    <Fragment key={s.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void showRuns(s.id)}
                          >
                            {s.name}
                          </button>
                          <div className="muted">{s.key}</div>
                        </td>
                        <td>
                          {s.kind.toLowerCase()} · {s.scope.toLowerCase()}
                        </td>
                        <td>{cronField(s)}</td>
                        <td>{capField(s)}</td>
                        <td>{healthOf(s)}</td>
                        <td>{formatDateTime(s.lastSuccessAt)}</td>
                        <td className="badge-group">{actionsOf(s)}</td>
                      </tr>
                      {openId === s.id && (
                        <tr>
                          <td colSpan={7}>
                            <div className="masi-source-detail masi-source-opened">
                              {openedOf(s)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </MasiTable>
            )}
            {pages > 1 && (
              <div className="pagination masi-sources-pager">
                <button
                  type="button"
                  className="btn-small"
                  disabled={pageNo <= 0}
                  onClick={() => toPage(pageNo - 1)}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  page {pageNo + 1} of {pages}
                </span>
                <button
                  type="button"
                  className="btn-small"
                  disabled={pageNo + 1 >= pages}
                  onClick={() => toPage(pageNo + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
        {own && (
          // the source alone: one record, read down - a table's row would put most of it off a phone's screen
          <>
            <dl className="masi-source-own">
              <dt>Key</dt>
              <dd>{own.key}</dd>
              <dt>Kind</dt>
              <dd>
                {own.kind.toLowerCase()} · {own.scope.toLowerCase()}
              </dd>
              <dt>Health</dt>
              <dd>{healthOf(own)}</dd>
              <dt>Cron</dt>
              <dd>{cronField(own)}</dd>
              <dt>Requests/day</dt>
              <dd>{capField(own)}</dd>
              <dt>Last success</dt>
              <dd>{formatDateTime(own.lastSuccessAt)}</dd>
            </dl>
            <div className="badge-group masi-source-actions">{actionsOf(own)}</div>
            <div className="masi-source-opened">{openedOf(own)}</div>
          </>
        )}
        {sources && !alone && (
          <>
            <PictureStatus />
            <DeploymentSwitches />
          </>
        )}
      </div>
    </div>
  );
}
