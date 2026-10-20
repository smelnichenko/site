import { useId } from 'react';
import type { MasiStats } from '../../services/api';
import { formatDateTime, formatUsd } from './format';
import { formatAmount } from './salary';
import MasiTable from '../../components/MasiTable';

interface BarRow {
  label: string;
  value: number;
}

/** A horizontal bar per row, scaled to the largest; plain CSS so the tests can read the widths. */
export function Bars({
  title,
  rows,
  unit,
}: Readonly<{ title: string; rows: BarRow[]; unit?: string }>) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="card masi-bars" data-testid={`bars-${title}`}>
      <div className="card-title">{title}</div>
      {rows.length === 0 && <div className="empty-state">Nothing in this period.</div>}
      {rows.map((r) => (
        <div key={r.label} className="masi-bar">
          <span className="masi-bar-label">{r.label}</span>
          <span className="masi-bar-track">
            <span
              className="masi-bar-fill"
              data-testid="bar-fill"
              style={{ width: max > 0 ? `${Math.round((r.value / max) * 100)}%` : '0%' }}
            />
          </span>
          <span className="masi-bar-value">{unit === 'usd' ? formatUsd(r.value) : r.value}</span>
        </div>
      ))}
    </div>
  );
}

function entries(record: Record<string, number>, dropZero = true): BarRow[] {
  return Object.entries(record)
    .filter(([, v]) => !dropZero || v > 0)
    .map(([label, value]) => ({ label, value }));
}

function hours(h: number | null): string {
  if (h === null) return '—';
  return h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h} h`;
}

/** "2,500"; a missing figure is a dash. */
function amount(n: number | null): string {
  return n === null ? '—' : formatAmount(n);
}

/** "3 postings in other currencies or with no period, not counted". */
function excludedLine(n: number): string {
  return n === 1
    ? '1 posting in another currency or with no period, not counted'
    : `${n} postings in other currencies or with no period, not counted`;
}

/**
 * The period's salary figures. A masi that reads the unit sends `excluded` and its figures are euros a full-time month
 * (the postings in another currency or of no stated period counted apart). An older one sends no `excluded`, and a
 * report stored before the unit was read has `excluded: null`: in both the figures are the sources' own numbers in
 * whatever unit they had, shown as they always were, with no unit.
 */
function SalaryCard({ salary }: Readonly<{ salary: MasiStats['salary'] }>) {
  const titleId = useId();
  // != null: a live answer of the old masi has no `excluded`, a report it stored has `excluded: null`
  const fullTime = salary.excluded != null;
  return (
    <section className="card" aria-labelledby={titleId}>
      <div className="card-title" id={titleId}>
        {fullTime ? 'Salary in full-time monthly EUR' : 'Salary'} (posted on {salary.posted} new
        jobs)
      </div>
      {salary.posted === 0 && (
        <div className="empty-state">
          {fullTime
            ? 'No new job posted a salary in euros of a stated period.'
            : 'No new job posted a salary.'}
        </div>
      )}
      {salary.posted > 0 && fullTime && (
        <div className="muted" data-testid="salary-line">
          {amount(salary.lowest)} – {amount(salary.highest)} EUR · median {amount(salary.medianMin)}{' '}
          to {amount(salary.medianMax)}
        </div>
      )}
      {salary.posted > 0 && !fullTime && (
        <div className="muted" data-testid="salary-line">
          {salary.lowest} – {salary.highest} · median {salary.medianMin ?? '—'} to{' '}
          {salary.medianMax ?? '—'}
        </div>
      )}
      {(salary.excluded ?? 0) > 0 && (
        <div className="muted">{excludedLine(salary.excluded ?? 0)}</div>
      )}
    </section>
  );
}

/** The figures of one period, live or stored: registry, sources, market, the caller's funnel, the LLM spend. */
export default function StatsPanel({ stats }: Readonly<{ stats: MasiStats }>) {
  const runs = stats.sources.map((s) => ({
    label: s.name,
    value: Object.values(s.runs).reduce((a, b) => a + b, 0),
  }));
  return (
    <div className="masi-stats">
      <div className="muted">
        {formatDateTime(stats.from)} – {formatDateTime(stats.to)}
      </div>
      <div className="grid masi-tiles">
        <div className="card masi-tile" data-testid="jobs-tile">
          <span className="stat-value">{stats.registry.newJobs}</span>
          <span className="stat-label">new jobs</span>
          <span className="muted">
            {stats.registry.closedJobs} closed
            {stats.registry.repostedJobs > 0 ? ` · ${stats.registry.repostedJobs} reposted` : ''}
          </span>
        </div>
        <div className="card masi-tile">
          <span className="stat-value">{stats.registry.newListings}</span>
          <span className="stat-label">new listings</span>
          <span className="muted">
            {stats.registry.closedListings} closed · median lifetime{' '}
            {hours(stats.registry.medianListingLifetimeHours)}
          </span>
        </div>
        <div className="card masi-tile" data-testid="funnel-tile">
          <span className="stat-value">{stats.funnel.applied}</span>
          <span className="stat-label">applied</span>
          <span className="muted">
            {stats.funnel.requested} packages requested
            {stats.funnel.averagePackageCostUsd !== null &&
              ` · ${formatUsd(stats.funnel.averagePackageCostUsd)} per package`}
          </span>
        </div>
        <div className="card masi-tile" data-testid="llm-tile">
          <span className="stat-value">{formatUsd(stats.llm.totalUsd)}</span>
          <span className="stat-label">LLM spend</span>
          <span className="muted">
            {Object.entries(stats.llm.calls)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${k.toLowerCase()}`)
              .join(' · ') || 'no calls'}
          </span>
        </div>
      </div>
      <div className="grid masi-stats-grid">
        <Bars
          title="Top hiring companies"
          rows={stats.topCompanies.map((c) => ({
            label: c.name ?? `company ${c.id}`,
            value: c.newJobs,
          }))}
        />
        <Bars title="Titles" rows={stats.titles.map((t) => ({ label: t.value, value: t.count }))} />
        <Bars title="Tech tags" rows={entries(stats.techTags)} />
        <Bars title="Remote" rows={entries(stats.remote)} />
        <Bars title="Seniority" rows={entries(stats.seniority)} />
        <Bars title="LLM cost by purpose" rows={entries(stats.llm.byPurpose)} unit="usd" />
        <Bars title="LLM cost by model" rows={entries(stats.llm.byModel)} unit="usd" />
        <Bars title="Runs per source" rows={runs} />
      </div>
      <SalaryCard salary={stats.salary} />
      <div className="card">
        <div className="card-title">Sources</div>
        <MasiTable label="Sources in the period">
          <thead>
            <tr>
              <th>Source</th>
              <th>New listings</th>
              <th>Closed</th>
              <th>Runs</th>
            </tr>
          </thead>
          <tbody>
            {stats.sources.map((s) => (
              <tr key={s.key}>
                <td>{s.name}</td>
                <td>{s.newListings}</td>
                <td>{s.closedListings}</td>
                <td>
                  {Object.entries(s.runs)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k.toLowerCase().replace('_', ' ')}`)
                    .join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </MasiTable>
      </div>
      <div className="muted" data-testid="tokens-line">
        Tokens: {stats.llm.tokens.input} in · {stats.llm.tokens.cacheRead} cache read ·{' '}
        {stats.llm.tokens.cacheWrite} cache write · {stats.llm.tokens.output} out
      </div>
    </div>
  );
}
