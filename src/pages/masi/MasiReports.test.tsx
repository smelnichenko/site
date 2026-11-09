import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiReports from './MasiReports';
import { defaultRange } from './format';
import { renderAt } from './testUtils';
import { report, stats } from './statsFixture';

vi.mock('../../services/api', () => ({
  fetchMasiReports: vi.fn(),
  fetchMasiStats: vi.fn(),
  fetchMasiStatsDaily: vi.fn(),
  generateMasiReport: vi.fn(),
}));
const api = await import('../../services/api');

/** The fixture week day by day: two new jobs on its Wednesday, one closed on its Friday, one application. */
const week = ['23', '24', '25', '26', '27', '28', '29'].map((d) => ({
  day: `2026-03-${d}`,
  newJobs: d === '25' ? 2 : 0,
  closedJobs: d === '27' ? 1 : 0,
  repostedJobs: 0,
  newListings: d === '25' ? 3 : 0,
  closedListings: 0,
  applied: d === '27' ? 1 : 0,
  llmUsd: d === '25' ? 0.42 : 0,
  llmCalls: {},
}));

beforeEach(() => {
  vi.mocked(api.fetchMasiReports).mockReset();
  vi.mocked(api.fetchMasiStats).mockReset();
  vi.mocked(api.generateMasiReport).mockReset();
  vi.mocked(api.fetchMasiStatsDaily).mockReset().mockResolvedValue(week);
});

describe('MasiReports', () => {
  it('lists the stored reports, shows live stats for the range in the URL, and re-queries on Show', async () => {
    vi.mocked(api.fetchMasiReports).mockResolvedValue([report]);
    vi.mocked(api.fetchMasiStats).mockResolvedValue(stats);
    renderAt('/masi/reports?from=2026-03-23&to=2026-03-29', '/masi/reports', <MasiReports />);
    expect(await screen.findByRole('link', { name: '23 Mar 2026 – 29 Mar 2026' })).toHaveAttribute(
      'href',
      '/masi/reports/5',
    );
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(await screen.findByTestId('funnel-tile')).toHaveTextContent('2 packages requested');
    expect(vi.mocked(api.fetchMasiStats).mock.calls[0].slice(0, 2)).toEqual([
      '2026-03-23',
      '2026-03-29',
    ]);
    const user = userEvent.setup();
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-03-01');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    await waitFor(() =>
      expect(
        vi
          .mocked(api.fetchMasiStats)
          .mock.calls[vi.mocked(api.fetchMasiStats).mock.calls.length - 1].slice(0, 2),
      ).toEqual(['2026-03-01', '2026-03-29']),
    );
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveClass('active');
  });

  it('charts the range day by day, its days also a table', async () => {
    vi.mocked(api.fetchMasiReports).mockResolvedValue([report]);
    vi.mocked(api.fetchMasiStats).mockResolvedValue(stats);
    renderAt('/masi/reports?from=2026-03-23&to=2026-03-29', '/masi/reports', <MasiReports />);
    for (const chart of ['Jobs', 'Listings', 'Your applications', 'LLM spend']) {
      expect(await screen.findByRole('region', { name: `${chart} per day` })).toBeInTheDocument();
    }
    expect(vi.mocked(api.fetchMasiStatsDaily).mock.calls[0].slice(0, 2)).toEqual([
      '2026-03-23',
      '2026-03-29',
    ]);
    const user = userEvent.setup();
    await user.click(screen.getByText('The days as a table'));
    const wednesday = screen.getByRole('row', { name: /25 Mar/ });
    expect(wednesday).toHaveTextContent('25 Mar' + '2' + '0' + '0' + '3' + '0' + '0' + '$0.42');
    const table = screen.getByRole('table', { name: 'The live stats day by day' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 7); // its header and the seven days
  });

  it('generates last week on request, reloads the list and reports the period', async () => {
    vi.mocked(api.fetchMasiReports).mockResolvedValueOnce([]).mockResolvedValue([report]);
    vi.mocked(api.fetchMasiStats).mockResolvedValue(stats);
    vi.mocked(api.generateMasiReport).mockResolvedValue(report);
    renderAt('/masi/reports', '/masi/reports', <MasiReports />);
    expect(await screen.findByText(/No reports yet/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Generate last week' }));
    expect(
      await screen.findByText('weekly report for 23 Mar 2026 – 29 Mar 2026 ready'),
    ).toBeInTheDocument();
    expect(api.generateMasiReport).toHaveBeenCalledWith('WEEKLY');
    expect(screen.getByRole('link', { name: '23 Mar 2026 – 29 Mar 2026' })).toBeInTheDocument();
  });

  it('shows the errors of the list and of the stats separately', async () => {
    vi.mocked(api.fetchMasiReports).mockRejectedValue(new Error('reports down'));
    vi.mocked(api.fetchMasiStats).mockRejectedValue(
      new Error('a stats window covers at most 366 days'),
    );
    renderAt('/masi/reports', '/masi/reports', <MasiReports />);
    expect(await screen.findByText('reports down')).toBeInTheDocument();
    expect(await screen.findByText('a stats window covers at most 366 days')).toBeInTheDocument();
  });

  it('defaults to the last seven days', () => {
    expect(defaultRange(new Date('2026-09-19T01:00:00Z'))).toEqual({
      from: '2026-09-13',
      to: '2026-09-19',
    });
  });
});
