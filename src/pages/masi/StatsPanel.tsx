import type { MasiStats } from '../../services/api';
import { formatDateTime, formatUsd } from './format';
import { formatAmount } from './salary';
import MasiTable from '../../components/MasiTable';
import FigureLink from './FigureLink';
import { counted, jobsLink, listingsLink, packagesLink } from './figureLinks';

interface BarRow {
  label: string;
  value: number;
  /** The list of the rows the value counts, and the link's name; a bar without one shows its value as text. */
  link?: { to: string; name: string };
}

function shown(value: number, unit?: string): string | number {
  return unit === 'usd' ? formatUsd(value) : value;
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
          <span className="masi-bar-value">
            {r.link ? (
              <FigureLink value={r.value} to={r.link.to} name={r.link.name} />
            ) : (
              shown(r.value, unit)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** `link`: where a row's value leads and what its link is called, or nothing for a bar of money. */
function entries(
  record: Record<string, number>,
  link?: (label: string, value: number) => BarRow['link'],
): BarRow[] {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value, link: link?.(label, value) }));
}

function newJobs(n: number): string {
  return counted(n, 'new job', 'new jobs');
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
function SalaryCard({
  salary,
  window,
}: Readonly<{ salary: MasiStats['salary']; window: { from: string; to: string } }>) {
  // != null: a live answer of the old masi has no `excluded`, a report it stored has `excluded: null`
  const fullTime = salary.excluded != null;
  const posted = `${salary.posted} new jobs`;
  const title = `${fullTime ? 'Salary in full-time monthly EUR' : 'Salary'} (posted on ${posted})`;
  return (
    // named by its title's words: named by the title element, it would take the link's name into its own
    <section className="card" aria-label={title}>
      <div className="card-title">
        {fullTime ? 'Salary in full-time monthly EUR' : 'Salary'} (posted on{' '}
        {fullTime ? (
          <FigureLink
            value={salary.posted}
            to={jobsLink(window, 'NEW', { salary: 'COUNTED' })}
            name={`${posted} with a salary counted`}
          >
            {posted}
          </FigureLink>
        ) : (
          // the old figure counted every posted salary, read or not: no list holds exactly those rows
          posted
        )}
        )
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
        <div className="muted">
          <FigureLink
            value={salary.excluded ?? 0}
            to={jobsLink(window, 'NEW', { salary: 'EXCLUDED' })}
            name={undefined}
          >
            {excludedLine(salary.excluded ?? 0)}
          </FigureLink>
        </div>
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
  const w = { from: stats.from, to: stats.to };
  const r = stats.registry;
  return (
    <div className="masi-stats">
      <div className="muted">
        {formatDateTime(stats.from)} – {formatDateTime(stats.to)}
      </div>
      <div className="grid masi-tiles">
        <div className="card masi-tile" data-testid="jobs-tile">
          <span className="stat-value">
            <FigureLink
              value={r.newJobs}
              to={jobsLink(w, 'NEW')}
              name={counted(r.newJobs, 'new job', 'new jobs')}
            />
          </span>
          <span className="stat-label">new jobs</span>
          <span className="muted">
            <FigureLink
              value={r.closedJobs}
              to={jobsLink(w, 'CLOSED')}
              name={counted(r.closedJobs, 'closed job', 'closed jobs')}
            >
              {r.closedJobs} closed
            </FigureLink>
            {r.repostedJobs > 0 && (
              <>
                {' · '}
                <FigureLink
                  value={r.repostedJobs}
                  to={jobsLink(w, 'REPOSTED')}
                  name={counted(r.repostedJobs, 'reposted job', 'reposted jobs')}
                >
                  {r.repostedJobs} reposted
                </FigureLink>
              </>
            )}
          </span>
        </div>
        <div className="card masi-tile" data-testid="listings-tile">
          <span className="stat-value">
            <FigureLink
              value={r.newListings}
              to={listingsLink(w, 'NEW')}
              name={counted(r.newListings, 'new listing', 'new listings')}
            />
          </span>
          <span className="stat-label">new listings</span>
          <span className="muted">
            <FigureLink
              value={r.closedListings}
              to={listingsLink(w, 'CLOSED')}
              name={counted(r.closedListings, 'closed listing', 'closed listings')}
            >
              {r.closedListings} closed
            </FigureLink>{' '}
            · median lifetime {hours(r.medianListingLifetimeHours)}
          </span>
        </div>
        <div className="card masi-tile" data-testid="funnel-tile">
          <span className="stat-value">
            <FigureLink
              value={stats.funnel.applied}
              to={packagesLink(w, 'APPLIED')}
              name={counted(stats.funnel.applied, 'applied package', 'applied packages')}
            />
          </span>
          <span className="stat-label">applied</span>
          <span className="muted">
            <FigureLink
              value={stats.funnel.requested}
              to={packagesLink(w, 'REQUESTED')}
              name={undefined}
            >
              {stats.funnel.requested} packages requested
            </FigureLink>
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
          rows={stats.topCompanies.map((c) => {
            const label = c.name ?? `company ${c.id}`;
            return {
              label,
              value: c.newJobs,
              link: {
                to: jobsLink(w, 'NEW', { company: c.id }),
                name: `${counted(c.newJobs, 'new job', 'new jobs')} at ${label}`,
              },
            };
          })}
        />
        <Bars
          title="Titles"
          rows={stats.titles.map((t) => ({
            label: t.value,
            value: t.count,
            link: {
              to: jobsLink(w, 'NEW', { titleNorm: t.value }),
              name: `${newJobs(t.count)} titled ${t.value}`,
            },
          }))}
        />
        <Bars
          title="Tech tags"
          rows={entries(stats.techTags, (tag, n) => ({
            to: jobsLink(w, 'NEW', { tag }),
            name: `${newJobs(n)} tagged ${tag}`,
          }))}
        />
        <Bars
          title="Remote"
          rows={entries(stats.remote, (remote, n) => ({
            to: jobsLink(w, 'NEW', { remote }),
            name: `${newJobs(n)}, remote ${remote === 'UNKNOWN' ? 'not stated' : remote}`,
          }))}
        />
        <Bars
          title="Seniority"
          rows={entries(stats.seniority, (seniority, n) => ({
            to: jobsLink(w, 'NEW', { seniority }),
            name: `${newJobs(n)} of seniority ${seniority}`,
          }))}
        />
        <Bars title="LLM cost by purpose" rows={entries(stats.llm.byPurpose)} unit="usd" />
        <Bars title="LLM cost by model" rows={entries(stats.llm.byModel)} unit="usd" />
        <Bars title="Runs per source" rows={runs} />
      </div>
      <SalaryCard salary={stats.salary} window={w} />
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
                <td>
                  <FigureLink
                    value={s.newListings}
                    to={listingsLink(w, 'NEW', s.key)}
                    name={`${counted(s.newListings, 'new listing', 'new listings')} on ${s.name}`}
                  />
                </td>
                <td>
                  <FigureLink
                    value={s.closedListings}
                    to={listingsLink(w, 'CLOSED', s.key)}
                    name={`${counted(s.closedListings, 'closed listing', 'closed listings')} on ${s.name}`}
                  />
                </td>
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
