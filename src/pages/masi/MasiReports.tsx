import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchMasiReports,
  fetchMasiStats,
  generateMasiReport,
  MasiReportSummary,
  MasiStats,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import StatsPanel from './StatsPanel';
import { defaultRange, errorMessage, formatDateTime, periodLabel } from './format';

/** Stored weekly and monthly reports, and live stats over any range of days. */
export default function MasiReports() {
  const [params, setParams] = useSearchParams();
  const initial = defaultRange();
  const from = params.get('from') ?? initial.from;
  const to = params.get('to') ?? initial.to;
  const [reports, setReports] = useState<MasiReportSummary[] | null>(null);
  // the stats carry the range they answer: a range change shows "loading" without a reset in the effect
  const [loaded, setLoaded] = useState<{ range: string; stats?: MasiStats; error?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ from, to });

  const reload = useCallback(async (signal?: AbortSignal) => {
    setReports(await fetchMasiReports(undefined, signal));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load reports'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    const range = `${from}..${to}`;
    void (async () => {
      try {
        const stats = await fetchMasiStats(from, to, controller.signal);
        setLoaded({ range, stats });
      } catch (e: unknown) {
        if (!controller.signal.aborted)
          setLoaded({ range, error: errorMessage(e, 'Failed to load stats') });
      }
    })();
    return () => controller.abort();
  }, [from, to]);
  const current = loaded?.range === `${from}..${to}` ? loaded : null;

  async function generate(kind: 'WEEKLY' | 'MONTHLY') {
    setBusy(kind);
    setMessage(null);
    try {
      const r = await generateMasiReport(kind);
      await reload();
      setMessage(
        `${kind.toLowerCase()} report for ${periodLabel(r.periodStart, r.periodEnd)} ready`,
      );
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The report could not be generated'));
    } finally {
      setBusy(null);
    }
  }

  function apply() {
    const next = new URLSearchParams(params);
    next.set('from', draft.from);
    next.set('to', draft.to);
    setParams(next);
  }

  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Reports</span>
          <span className="badge-group">
            <LoadingButton
              className="status-badge action"
              onClick={() => void generate('WEEKLY')}
              loading={busy === 'WEEKLY'}
              label="Generate last week"
            />
            <LoadingButton
              className="status-badge action"
              onClick={() => void generate('MONTHLY')}
              loading={busy === 'MONTHLY'}
              label="Generate last month"
            />
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        {!reports && !error && <div className="loading">Loading reports...</div>}
        {reports && reports.length === 0 && (
          <div className="empty-state">
            No reports yet: the first weekly one is written Monday 06:00.
          </div>
        )}
        {reports && reports.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Period</th>
                <th>Generated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.kind.toLowerCase()}</td>
                  <td>
                    <Link to={`/masi/reports/${r.id}`}>
                      {periodLabel(r.periodStart, r.periodEnd)}
                    </Link>
                  </td>
                  <td>{formatDateTime(r.generatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Live stats</span>
        </div>
        <form
          className="masi-filters"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label>
            From{' '}
            <input
              type="date"
              value={draft.from}
              max={draft.to}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            To{' '}
            <input
              type="date"
              value={draft.to}
              min={draft.from}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <button type="submit" className="status-badge action">
            Show
          </button>
        </form>
        {current?.error && (
          <div className="error" role="alert">
            {current.error}
          </div>
        )}
        {!current && <div className="loading">Loading stats...</div>}
        {current?.stats && <StatsPanel stats={current.stats} />}
      </div>
    </div>
  );
}
