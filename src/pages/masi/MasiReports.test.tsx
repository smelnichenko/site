import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiReports from './MasiReports';
import { defaultRange } from './format';
import { renderAt } from './testUtils';
import { report, stats } from './statsFixture';

vi.mock('../../services/api', () => ({
  fetchMasiReports: vi.fn(),
  fetchMasiStats: vi.fn(),
  generateMasiReport: vi.fn(),
}));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiReports).mockReset();
  vi.mocked(api.fetchMasiStats).mockReset();
  vi.mocked(api.generateMasiReport).mockReset();
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
