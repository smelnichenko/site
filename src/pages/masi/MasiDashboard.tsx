import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMasiDashboard, MasiDashboard as Dashboard } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import { badgeClass, errorMessage, formatDateTime, formatUsd } from './format';
import MasiTable from '../../components/MasiTable';

/** The overview: the registry this week, the review funnel, the LLM spend against its budgets, the CV master, the sources. */
export default function MasiDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setData(await fetchMasiDashboard(controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the dashboard'));
      }
    })();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="error" role="alert">
          {error}
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading overview...</div>
      </div>
    );
  }
  const awaiting = data.packages.PREPARED ?? 0;
  const dayPct =
    data.llm.dailyBudget > 0 ? Math.round((data.llm.today / data.llm.dailyBudget) * 100) : 0;
  const monthPct =
    data.llm.monthlyBudget > 0 ? Math.round((data.llm.month / data.llm.monthlyBudget) * 100) : 0;
  return (
    <div className="masi">
      <MasiNav />
      <div className="grid masi-tiles">
        <Link to="/masi/jobs" className="card masi-tile">
          <span className="stat-value">{data.openJobs}</span>
          <span className="stat-label">open jobs</span>
          <span className="muted">
            +{data.newJobs7d} new, {data.closedJobs7d} closed this week
          </span>
        </Link>
        <Link to="/masi/companies?hiring=true" className="card masi-tile">
          <span className="stat-value">{data.companiesHiring}</span>
          <span className="stat-label">companies hiring now</span>
        </Link>
        <Link to="/masi/packages?status=PREPARED" className="card masi-tile">
          <span className="stat-value">{awaiting}</span>
          <span className="stat-label">packages awaiting review</span>
          <span className="muted">
            {data.packages.APPLIED ?? 0} applied · {data.packages.SKIPPED ?? 0} skipped ·{' '}
            {(data.packages.FAILED ?? 0) + (data.packages.FAILED_GUARD ?? 0)} failed
          </span>
        </Link>
        <div className="card masi-tile" data-testid="cost-tile">
          <span className="stat-value">{formatUsd(data.llm.today)}</span>
          <span className="stat-label">LLM cost today (UTC day)</span>
          <span className="muted">
            {dayPct} % of {formatUsd(data.llm.dailyBudget)} · month {formatUsd(data.llm.month)} (
            {monthPct} % of {formatUsd(data.llm.monthlyBudget)})
          </span>
          <span className="muted" data-testid="cost-breakdown">
            {Object.entries(data.llm.monthByPurpose)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k.toLowerCase()} ${formatUsd(v)}`)
              .join(' · ') || 'nothing spent this month'}
            {data.llm.averagePackageCostMonth !== null &&
              ` · ${formatUsd(data.llm.averagePackageCostMonth)} per package`}
          </span>
          {!data.llm.enabled && <span className="status-badge error">AI disabled</span>}
          {data.tuningPausedUntil && (
            <span className="status-badge action">
              tuning paused until {formatDateTime(data.tuningPausedUntil)}
            </span>
          )}
        </div>
        <Link to="/masi/cv" className="card masi-tile">
          <span className="stat-value">
            {data.cv.completeness === null ? '—' : `${data.cv.completeness} %`}
          </span>
          <span className="stat-label">
            {data.cv.activeVersion === null
              ? 'no active CV master'
              : `CV master v${data.cv.activeVersion} completeness`}
          </span>
          {data.cv.gaps.length > 0 && <span className="muted">{data.cv.gaps.length} gap(s)</span>}
        </Link>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sources</span>
          <Link to="/masi/sources" className="muted">
            manage
          </Link>
        </div>
        <MasiTable label="Sources">
          <thead>
            <tr>
              <th>Source</th>
              <th>Enabled</th>
              <th>Health</th>
              <th>Last run</th>
              <th>Last success</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.enabled ? 'yes' : 'no'}</td>
                <td>
                  <span className={badgeClass(s.health)}>{s.running ? 'running' : s.health}</span>
                </td>
                <td>{formatDateTime(s.lastRunAt)}</td>
                <td>{formatDateTime(s.lastSuccessAt)}</td>
              </tr>
            ))}
          </tbody>
        </MasiTable>
      </div>
    </div>
  );
}
