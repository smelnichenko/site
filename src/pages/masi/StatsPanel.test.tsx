import { describe, it, expect } from 'vitest';
import { render as renderBare, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import StatsPanel, { Bars } from './StatsPanel';
import { stats } from './statsFixture';

/** The panel's figures are links: it renders under a router, as every page that shows it does. */
function render(ui: ReactElement) {
  return renderBare(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('StatsPanel', () => {
  it('says nothing about reposts in a week without one', () => {
    render(<StatsPanel stats={{ ...stats, registry: { ...stats.registry, repostedJobs: 0 } }} />);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('2new jobs1 closed');
    expect(screen.getByTestId('jobs-tile')).not.toHaveTextContent('reposted');
  });

  it('shows the tiles, the bars scaled to the largest, the salary line and the sources', () => {
    render(<StatsPanel stats={stats} />);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('2new jobs1 closed · 1 reposted');
    expect(screen.getByTestId('listings-tile')).toHaveTextContent(
      '2new listings1 closed · median lifetime 5.0 days',
    );
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
    expect(screen.getByTestId('listings-tile')).toHaveTextContent(
      '1 closed · median lifetime 36 h',
    );
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

describe('StatsPanel figures are links to their rows', () => {
  const salary = { posted: 2, lowest: 2500, medianMin: 2750, medianMax: 4500, highest: 12000 };
  const window = { from: stats.from, to: stats.to };
  /** Where a link leads: its path and its query, as one object. */
  function target(name: string) {
    const href = screen.getByRole('link', { name }).getAttribute('href') ?? '';
    const url = new URL(href, 'https://pmon.dev');
    return { path: url.pathname, ...Object.fromEntries(url.searchParams) };
  }

  it('leads every count to the list of exactly its rows, with the report period in the URL', () => {
    render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: 3 } }} />);
    expect(target('2 new jobs')).toEqual({ path: '/masi/jobs', event: 'NEW', ...window });
    expect(target('1 closed job')).toEqual({ path: '/masi/jobs', event: 'CLOSED', ...window });
    expect(target('1 reposted job')).toEqual({ path: '/masi/jobs', event: 'REPOSTED', ...window });
    expect(target('2 new listings')).toEqual({ path: '/masi/listings', event: 'NEW', ...window });
    expect(target('1 closed listing')).toEqual({
      path: '/masi/listings',
      event: 'CLOSED',
      ...window,
    });
    expect(target('1 applied package')).toEqual({
      path: '/masi/packages',
      event: 'APPLIED',
      ...window,
    });
    expect(target('2 packages requested')).toEqual({
      path: '/masi/packages',
      event: 'REQUESTED',
      ...window,
    });
    expect(target('2 new listings on cv.ee')).toEqual({
      path: '/masi/listings',
      event: 'NEW',
      source: 'cvee',
      ...window,
    });
    expect(target('1 closed listing on cv.ee')).toEqual({
      path: '/masi/listings',
      event: 'CLOSED',
      source: 'cvee',
      ...window,
    });
    expect(target('2 new jobs at Nortal AS')).toEqual({
      path: '/masi/jobs',
      event: 'NEW',
      company: '3',
      ...window,
    });
    expect(target('1 new job at company 4')).toEqual({
      path: '/masi/jobs',
      event: 'NEW',
      company: '4',
      ...window,
    });
    const card = screen.getByRole('region', { name: /^Salary in full-time monthly EUR/ });
    const posted = within(card).getByRole('link', { name: '2 new jobs with a salary counted' });
    expect(new URL(posted.getAttribute('href') ?? '', 'https://pmon.dev').search).toBe(
      `?event=NEW&from=${encodeURIComponent(stats.from)}&to=${encodeURIComponent(stats.to)}&salary=COUNTED`,
    );
    expect(target('3 postings in other currencies or with no period, not counted')).toEqual({
      path: '/masi/jobs',
      event: 'NEW',
      salary: 'EXCLUDED',
      ...window,
    });
  });

  it('leaves a zero as plain text: a link to an empty list leads nowhere', () => {
    render(
      <StatsPanel
        stats={{
          ...stats,
          registry: { ...stats.registry, closedJobs: 0, repostedJobs: 0 },
          funnel: { requested: 0, applied: 0, averagePackageCostUsd: null },
          salary: { ...salary, excluded: 0 },
        }}
      />,
    );
    // the source with no listings in the period: its two zeros are text in its row, not links
    const bolt = screen.getByRole('row', { name: /Bolt careers/ });
    expect(within(bolt).queryByRole('link')).not.toBeInTheDocument();
    expect(within(bolt).getAllByRole('cell', { name: '0' })).toHaveLength(2);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('0 closed');
    expect(screen.queryByRole('link', { name: /closed job/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /package/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('funnel-tile')).toHaveTextContent('0applied0 packages requested');
    // the counts that are not zero still lead somewhere
    expect(screen.getByRole('link', { name: '2 new jobs at Nortal AS' })).toBeInTheDocument();
  });

  it("does not link the salary count of a report stored before masi read the unit: no list holds that count's rows", () => {
    render(<StatsPanel stats={{ ...stats, salary: { ...salary, excluded: null } }} />);
    const card = screen.getByRole('region', { name: /^Salary \(posted on 2 new jobs\)$/ });
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('reaches the figures from the keyboard, in the order they are read', async () => {
    render(<StatsPanel stats={stats} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('link', { name: '2 new jobs' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: '1 closed job' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: '1 reposted job' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: '2 new listings' })).toHaveFocus();
  });
});
