import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatsPanel, { Bars } from './StatsPanel';
import { stats } from './statsFixture';

describe('StatsPanel', () => {
  it('shows the tiles, the bars scaled to the largest, the salary line and the sources', () => {
    render(<StatsPanel stats={stats} />);
    expect(screen.getByTestId('jobs-tile')).toHaveTextContent('2new jobs1 closed');
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
