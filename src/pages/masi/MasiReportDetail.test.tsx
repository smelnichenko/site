import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import MasiReportDetail from './MasiReportDetail';
import { renderAt } from './testUtils';
import { report } from './statsFixture';

vi.mock('../../services/api', () => ({ fetchMasiReport: vi.fn() }));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiReport).mockReset();
});

describe('MasiReportDetail', () => {
  it('shows the frozen snapshot, the source health and the stats of the period', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue(report);
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    expect(await screen.findByText('weekly report 23 Mar 2026 – 29 Mar 2026')).toBeInTheDocument();
    expect(api.fetchMasiReport).toHaveBeenCalledWith(5, expect.any(AbortSignal));
    expect(screen.getByTestId('snapshot-line')).toHaveTextContent(
      '254 open jobs, 86 companies hiring · my queue: 2 prepared, 1 applied',
    );
    expect(screen.getByTestId('source-health')).toHaveTextContent('cvee: ok');
    expect(screen.getByTestId('source-health')).toHaveTextContent('bolt: disabled');
    expect(screen.getByTestId('funnel-tile')).toHaveTextContent('2 packages requested');
    expect(screen.getByRole('link', { name: 'all reports' })).toHaveAttribute(
      'href',
      '/masi/reports',
    );
  });

  it('shows the error when the report cannot load', async () => {
    vi.mocked(api.fetchMasiReport).mockRejectedValue(new Error('Not found'));
    renderAt('/masi/reports/99', '/masi/reports/:id', <MasiReportDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });
});
