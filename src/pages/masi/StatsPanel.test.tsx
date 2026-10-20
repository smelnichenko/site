import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatsPanel, { Bars } from './StatsPanel';
import { stats } from './statsFixture';

describe('StatsPanel', () => {
  it('says nothing about reposts in a week without one', () => {
    render(<StatsPanel stats={{ ...stats, registry: { ...stats.registry, repostedJobs: 0 } }} />);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('2new jobs1 closed');
    expect(screen.getByTestId('jobs-tile')).not.toHaveTextContent('reposted');
  });

  it('shows the tiles, the bars scaled to the largest, the salary line and the sources', () => {
    render(<StatsPanel stats={stats} />);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('2new jobs1 closed · 1 reposted');
    expect(screen.getByText('1 closed · median lifetime 5.0 days')).toBeInTheDocument();
    const funnel = screen.getByTestId('funnel-tile');
    expect(funnel).toHaveTextContent('2 packages requested · $0.20 per package');
    expect(screen.getByTestId('llm-tile')).toHaveTextContent('$0.60');
    expect(screen.getByTestId('llm-tile')).toHaveTextContent('1 ok · 1 error');
    const companies = screen.getByTestId('bars-Top hiring companies');
    const fills = within(companies).getAllByTestId('bar-fill');
    expect(fills).toHaveLength(2);
    expect(fills[0]).toHaveStyle({ width: '100%' });
    expect(fills[1]).toHaveStyle({ width: '50%' });
    expect(within(companies).getByText('company 4')).toBeInTheDocument(); // a company without a name
    const purposes = screen.getByTestId('bars-LLM cost by purpose');
    expect(within(purposes).queryByText('LETTER')).not.toBeInTheDocument(); // zero rows are dropped
    expect(within(purposes).getByText('$0.50')).toBeInTheDocument();
    expect(screen.getByTestId('salary-line')).toHaveTextContent(
      '2500 – 4500 · median 2750 to 4500',
    );
    expect(screen.getByText('1 ok, 1 error')).toBeInTheDocument(); // the source row's runs
    expect(screen.getByTestId('tokens-line')).toHaveTextContent(
      '1050 in · 200 cache read · 300 cache write · 400 out',
    );
  });

  it('says so when a period has nothing, and shows hours under two days', () => {
    render(
      <StatsPanel
        stats={{
          ...stats,
          registry: { ...stats.registry, medianListingLifetimeHours: 36 },
          topCompanies: [],
          salary: { posted: 0, lowest: null, medianMin: null, medianMax: null, highest: null },
          llm: { ...stats.llm, calls: { OK: 0 } },
          funnel: { requested: 0, applied: 0, averagePackageCostUsd: null },
        }}
      />,
    );
    expect(screen.getByText('1 closed · median lifetime 36 h')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('bars-Top hiring companies')).getByText('Nothing in this period.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No new job posted a salary.')).toBeInTheDocument();
    expect(screen.getByTestId('llm-tile')).toHaveTextContent('no calls');
    expect(screen.getByTestId('funnel-tile')).not.toHaveTextContent('per package');
  });

  it('Bars formats USD rows and an empty set', () => {
    render(<Bars title="t" rows={[{ label: 'a', value: 1.5 }]} unit="usd" />);
    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });
});

describe('StatsPanel salary', () => {
  /** masi since it reads a posting's currency and period: full-time monthly euros, and the count it left out. */
  const salary = { posted: 2, lowest: 2500, medianMin: 2750, medianMax: 4500, highest: 12000 };
  const region = (name: RegExp) => screen.getByRole('region', { name });

  it('labels the figures full-time monthly EUR and counts the postings it left out', () => {
    render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: 3 } }} />);
    const card = region(/^Salary in full-time monthly EUR \(posted on 2 new jobs\)$/);
    expect(card).toHaveTextContent('2,500 – 12,000 EUR · median 2,750 to 4,500');
    expect(card).toHaveTextContent('3 postings in other currencies or with no period, not counted');
  });

  it('says one posting left out in the singular, and nothing when none was', () => {
    const view = render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: 1 } }} />);
    expect(region(/full-time monthly EUR/)).toHaveTextContent(
      '1 posting in another currency or with no period, not counted',
    );
    view.unmount();
    render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: 0 } }} />);
    expect(region(/full-time monthly EUR/)).not.toHaveTextContent('not counted');
  });

  it('says no posting had a euro salary of a stated period when every one was left out', () => {
    const none = { posted: 0, lowest: null, medianMin: null, medianMax: null, highest: null };
    render(<StatsPanel stats={{ ...stats, salary: { ...none, excluded: 2 } }} />);
    const card = region(/full-time monthly EUR/);
    expect(card).toHaveTextContent('No new job posted a salary in euros of a stated period.');
    expect(card).toHaveTextContent('2 postings in other currencies or with no period, not counted');
  });

  it('reads a report stored before masi read the unit (excluded: null) as the old figures, with no EUR', () => {
    render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: null } }} />);
    const card = region(/^Salary \(posted on 2 new jobs\)$/);
    expect(card).toHaveTextContent('2500 – 12000 · median 2750 to 4500');
    expect(card).not.toHaveTextContent('EUR');
    expect(card).not.toHaveTextContent('not counted');
  });

  it("keeps today's line for the old masi, whose figures are no full-time euros and which counts none out", () => {
    render(<StatsPanel stats={{ ...stats, salary }} />);
    const card = region(/^Salary \(posted on 2 new jobs\)$/);
    expect(card).toHaveTextContent('2500 – 12000 · median 2750 to 4500');
    expect(card).not.toHaveTextContent('EUR');
    expect(card).not.toHaveTextContent('not counted');
  });
});

describe('periodLabel', () => {
  it('shows the last day of a half-open period in Europe/Tallinn', async () => {
    const { periodLabel } = await import('./format');
    expect(periodLabel('2026-03-22T22:00:00Z', '2026-03-29T21:00:00Z')).toBe(
      '23 Mar 2026 – 29 Mar 2026',
    );
    expect(periodLabel('2026-09-30T21:00:00Z', '2026-10-31T22:00:00Z')).toBe(
      '1 Oct 2026 – 31 Oct 2026',
    );
  });
});
