import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMasiAssistant,
  fetchMasiSourceRuns,
  fetchMasiSources,
  MasiAssistant,
  MasiSource,
  MasiSourceRun,
  patchMasiAssistant,
  patchMasiSource,
  runMasiSource,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDateTime } from './format';
import MasiTable from '../../components/MasiTable';

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

/** The operator's token a source's config carries (the GitHub PAT), or '' for none. Shown for sources that use one. */
function tokenOf(configJson: string | null): string {
  try {
    const token: unknown = configJson
      ? (JSON.parse(configJson) as Record<string, unknown>).token
      : undefined;
    return typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
}

/** The config with the token set or removed (''); the other keys as they were. */
function withToken(configJson: string | null, token: string): string {
  let config: Record<string, unknown> = {};
  try {
    config = configJson ? (JSON.parse(configJson) as Record<string, unknown>) : {};
  } catch {
    config = {};
  }
  if (token === '') delete config.token;
  else config.token = token;
  return JSON.stringify(config);
}

/** Whether the source reads an operator token from its config. */
function takesToken(s: MasiSource): boolean {
  return s.key === 'github' || tokenOf(s.configJson) !== '';
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


/** How far a running source has got: what its newest unfinished run has recorded, or '' when it has said nothing yet. */
function progressOf(row: MasiSourceRun | undefined, now: number): string {
  if (!row || !row.startedAt) return '';
  const minutes = Math.max(0, Math.round((now - Date.parse(row.startedAt)) / 60000));
  const parts: string[] = [];
  if (row.fetched > 0) parts.push(`${row.fetched.toLocaleString()} calls`);
  if (row.newContacts > 0) parts.push(`${row.newContacts.toLocaleString()} people`);
  parts.push(`${minutes} min`);
  return parts.join(' · ');
}

/** Every collector agent: enable, cron, run now, and its last runs; a source without a bean (FAILING) cannot be enabled. */
export default function MasiSources() {
  const [sources, setSources] = useState<MasiSource[] | null>(null);
  const [runs, setRuns] = useState<Record<number, MasiSourceRun[]>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [cronDraft, setCronDraft] = useState<Record<number, string>>({});
  const [capDraft, setCapDraft] = useState<Record<number, string>>({});
  const [tokenDraft, setTokenDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [assistant, setAssistant] = useState<MasiAssistant | null>(null);

  const serverCron = useRef<Map<number, string>>(new Map());
  const reload = useCallback(async (signal?: AbortSignal) => {
    const list = await fetchMasiSources(signal);
    const before = serverCron.current;
    setCronDraft((drafts) => keepEdits(drafts, before, list));
    serverCron.current = new Map(list.map((s) => [s.id, s.cron]));
    setSources(list);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
        setAssistant(await fetchMasiAssistant(controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load sources'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  /**
   * While anything is running, its figures are read again every few seconds.
   *
   * The collector writes them as it goes (masi, RunProgress), so this is what turns 'running' into something an
   * operator can watch. Nothing polls when nothing runs: an idle page should not cost requests.
   */
  /** The instant of the last successful poll: the age shown beside a running source counts from it. */
  const [tick, setTick] = useState(0);
  const runningIds = (sources ?? []).filter((s) => s.running).map((s) => s.id).join(',');
  useEffect(() => {
    if (!runningIds) return;
    const ids = runningIds.split(',').map(Number);
    const controller = new AbortController();
    let alive = true;
    const poll = () => {
      void (async () => {
        try {
          const fresh = await Promise.all(ids.map((id) => fetchMasiSourceRuns(id, controller.signal)));
          if (!alive) return;
          setRuns((cur) => {
            const next = { ...cur };
            ids.forEach((id, i) => { next[id] = fresh[i].content; });
            return next;
          });
          setTick(Date.now());
        } catch {
          // a poll that fails is left to the next one: the page keeps what it has
        }
      })();
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

  async function act(id: number, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      await reload();
      setMessage(done);
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

  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sources</span>
          <span className="muted">
            {sources
              ? `${sources.filter((s) => s.enabled).length} of ${sources.length} enabled`
              : ''}
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        {!sources && !error && <div className="loading">Loading sources...</div>}
        {sources && (
          <>
            <div className="assistant-switch">
              <label>
                <input
                  type="checkbox"
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
              <span className="muted">{assistantNote(assistant)}</span>
            </div>
            <MasiTable label="Sources">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Kind</th>
                  <th>Cron</th>
                  <th>Requests/day</th>
                  <th>Token</th>
                  <th>Health</th>
                  <th>Last success</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
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
                      <td>
                        <input
                          aria-label={`Cron for ${s.key}`}
                          value={cronDraft[s.id] ?? s.cron}
                          onChange={(e) =>
                            setCronDraft((cur) => ({ ...cur, [s.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const next = (cronDraft[s.id] ?? s.cron).trim();
                            if (next && next !== s.cron)
                              void act(
                                s.id,
                                () => patchMasiSource(s.id, { cron: next }),
                                `${s.key}: cron saved`,
                              );
                          }}
                          style={{ width: '10em', fontFamily: 'monospace' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`Requests per day for ${s.key}`}
                          placeholder="no cap"
                          value={capDraft[s.id] ?? capOf(s.configJson)}
                          onChange={(e) =>
                            setCapDraft((cur) => ({ ...cur, [s.id]: e.target.value }))
                          }
                          onBlur={(e) => {
                            const next = (capDraft[s.id] ?? capOf(s.configJson)).trim();
                            if (!e.target.checkValidity()) return; // a negative or fractional cap is not saved
                            if (next !== capOf(s.configJson))
                              void act(
                                s.id,
                                () =>
                                  patchMasiSource(s.id, {
                                    configJson: withCap(s.configJson, next),
                                  }),
                                next === ''
                                  ? `${s.key}: no request cap`
                                  : `${s.key}: ${next} requests a day`,
                              );
                          }}
                          style={{ width: '6em' }}
                        />
                      </td>
                      <td>
                        {takesToken(s) ? (
                          <input
                            type="password"
                            aria-label={`Token for ${s.key}`}
                            placeholder="no token"
                            value={tokenDraft[s.id] ?? tokenOf(s.configJson)}
                            onChange={(e) =>
                              setTokenDraft((cur) => ({ ...cur, [s.id]: e.target.value }))
                            }
                            onBlur={() => {
                              const next = (tokenDraft[s.id] ?? tokenOf(s.configJson)).trim();
                              if (next !== tokenOf(s.configJson))
                                void act(
                                  s.id,
                                  () =>
                                    patchMasiSource(s.id, {
                                      configJson: withToken(s.configJson, next),
                                    }),
                                  next === '' ? `${s.key}: token removed` : `${s.key}: token saved`,
                                );
                            }}
                            style={{ width: '10em', fontFamily: 'monospace' }}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={badgeClass(s.health)}>
                          {s.running ? 'running' : s.health.toLowerCase().replace('_', ' ')}
                        </span>
                        {s.running && progressOf(runs[s.id]?.[0], tick) && (
                          <div className="muted" data-testid={`progress-${s.key}`}>
                            {progressOf(runs[s.id]?.[0], tick)}
                          </div>
                        )}
                        {s.consecutiveFailures > 0 && (
                          <div className="muted">{s.consecutiveFailures} failure(s) in a row</div>
                        )}
                        {s.lastError && <div className="muted">{s.lastError}</div>}
                      </td>
                      <td>{formatDateTime(s.lastSuccessAt)}</td>
                      <td className="badge-group">
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
                          onClick={() =>
                            void act(s.id, () => runMasiSource(s.id), `${s.key}: run started`)
                          }
                          loading={busyId === s.id}
                          label="Run now"
                        />
                      </td>
                    </tr>
                    {openId === s.id && (
                      <tr>
                        <td colSpan={7}>
                          {!runs[s.id] && <div className="loading">Loading runs...</div>}
                          {runs[s.id]?.length === 0 && (
                            <div className="empty-state">No runs yet.</div>
                          )}
                          {runs[s.id] && runs[s.id].length > 0 && (
                            <table className="table masi-runs" data-testid={`runs-${s.key}`}>
                              <thead>
                                <tr>
                                  <th>Started</th>
                                  <th>Status</th>
                                  <th>Parsed</th>
                                  <th>New jobs</th>
                                  <th>Closed</th>
                                  <th>Companies</th>
                                  <th>Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runs[s.id].map((r) => (
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
                                    <td className="muted">{r.error ?? ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </MasiTable>
          </>
        )}
      </div>
    </div>
  );
}
