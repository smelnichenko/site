import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMasiSourceRuns,
  fetchMasiSources,
  MasiSource,
  MasiSourceRun,
  patchMasiSource,
  runMasiSource,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDateTime } from './format';

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

/** Every collector agent: enable, cron, run now, and its last runs; a source without a bean (FAILING) cannot be enabled. */
export default function MasiSources() {
  const [sources, setSources] = useState<MasiSource[] | null>(null);
  const [runs, setRuns] = useState<Record<number, MasiSourceRun[]>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [cronDraft, setCronDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load sources'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

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
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Kind</th>
                <th>Cron</th>
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
                      <span className={badgeClass(s.health)}>
                        {s.running ? 'running' : s.health.toLowerCase().replace('_', ' ')}
                      </span>
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
                      <td colSpan={6}>
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
          </table>
        )}
      </div>
    </div>
  );
}
