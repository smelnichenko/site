import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMasiDashboard, MasiDashboard as Dashboard } from '../../services/api';
import { dashboardSources } from '../../services/masiSourcesOld';
import MasiNav from '../../components/MasiNav';
import { badgeClass, errorMessage, formatDateTime, formatUsd, noteClass } from './format';
import MasiTable from '../../components/MasiTable';
import FigureLink, { Tied } from './FigureLink';
import { SEPARATOR } from './figureLinks';
import { countOf, sourcesLink, sourceState, stateWords } from './sourceStates';

/** The separator a figure link is tied to (Tied): the no-break space and the dot, the space after it outside. */
const DOT = SEPARATOR.trimEnd();

/**
 * The sources at a glance: how many there are, enabled, running and wanting a look - each a link to the Sources page
 * showing them - then the ones wanting a look, worst first, at most ten, and the way to every one of them when there
 * are more. A masi before paged sources sent every source: the same is made of them (masiSourcesOld).
 */
function SourcesCard({ data }: Readonly<{ data: Dashboard }>) {
  const { counts, attention } = dashboardSources(data);
  const needLook = countOf(counts, 'ATTENTION');
  const parts: Array<{ key: string; value: number; to: string; words: string }> = [
    { key: 'ALL', value: counts.ALL, to: sourcesLink(), words: `${counts.ALL} sources` },
    {
      key: 'ENABLED',
      value: countOf(counts, 'ENABLED'),
      to: sourcesLink('ENABLED'),
      words: `${countOf(counts, 'ENABLED')} enabled`,
    },
    {
      key: 'RUNNING',
      value: countOf(counts, 'RUNNING'),
      to: sourcesLink('RUNNING'),
      words: `${countOf(counts, 'RUNNING')} running`,
    },
    {
      key: 'ATTENTION',
      value: needLook,
      to: sourcesLink('ATTENTION'),
      words: `${needLook} ${needLook === 1 ? 'needs' : 'need'} a look`,
    },
  ];
  return (
    <section className="card" aria-label="Sources">
      <div className="card-header">
        <span className="card-title">Sources</span>
        <Link to="/masi/sources" className="muted">
          manage
        </Link>
      </div>
      <div className="muted" data-testid="source-counts">
        {parts.map((p, i) => (
          <span key={p.key}>
            {i < parts.length - 1 ? (
              <Tied after={DOT}>
                <FigureLink value={p.value} to={p.to}>
                  {p.words}
                </FigureLink>
              </Tied>
            ) : (
              <FigureLink value={p.value} to={p.to}>
                {p.words}
              </FigureLink>
            )}
            {i < parts.length - 1 && ' '}
          </span>
        ))}
      </div>
      {attention.length === 0 ? (
        <div className="empty-state">All enabled sources are well.</div>
      ) : (
        <MasiTable
          label="Sources that need a look"
          // the state column holds the widest badge ("auto-disabled", 146 px with its padding) at the narrowest
          columns={['20%', '19%', '12%', '15%', '34%']}
          minWidth={800}
        >
          <thead>
            <tr>
              <th>Source</th>
              <th>State</th>
              <th>Failures in a row</th>
              <th>Last success</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {attention.map((s) => {
              const state = sourceState(s);
              return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/masi/sources/${s.id}`}>{s.name}</Link>
                    <div className="muted">{s.key}</div>
                  </td>
                  <td className="badge-group">
                    <span className={badgeClass(state)}>{stateWords(state)}</span>
                    {s.running && <span className="status-badge">running</span>}
                  </td>
                  <td>{s.consecutiveFailures ?? ''}</td>
                  <td>{formatDateTime(s.lastSuccessAt)}</td>
                  <td>{s.lastError && <span className={noteClass(state)}>{s.lastError}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </MasiTable>
      )}
      {needLook > attention.length && (
        <Link to={sourcesLink('ATTENTION')} className="masi-see-all">
          See all {needLook}
        </Link>
      )}
    </section>
  );
}

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
            {data.packages.FAILED ?? 0} failed
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
          {(data.cv.actives?.length ?? 0) > 1 && (
            <span className="muted" data-testid="cv-actives">
              active: {data.cv.actives?.map((a) => `${a.language} v${a.version}`).join(' · ')}
            </span>
          )}
        </Link>
      </div>
      <SourcesCard data={data} />
    </div>
  );
}
