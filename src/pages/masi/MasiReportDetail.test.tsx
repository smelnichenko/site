import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiReportDetail from './MasiReportDetail';
import { renderAt } from './testUtils';
import { report } from './statsFixture';

vi.mock('../../services/api', () => ({ fetchMasiReport: vi.fn(), mailMasiReportDigest: vi.fn() }));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiReport).mockReset();
  vi.mocked(api.mailMasiReportDigest).mockReset();
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

  it('mails the weekly digest to the one who asks, and says so', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue(report);
    vi.mocked(api.mailMasiReportDigest).mockResolvedValue(undefined);
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mail me this report' }));
    expect(api.mailMasiReportDigest).toHaveBeenCalledWith(5);
    expect(await screen.findByRole('status')).toHaveTextContent('The digest is on its way to you');
  });

  it('shows why a digest could not be mailed', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue(report);
    vi.mocked(api.mailMasiReportDigest).mockRejectedValue(
      new Error('mail is not switched on in this environment'),
    );
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mail me this report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'mail is not switched on in this environment',
    );
    // the report itself stays on the page: a mail that failed is not a report that failed
    expect(screen.getByTestId('snapshot-line')).toBeInTheDocument();
  });

  it('offers no digest for a monthly report: only a week has one', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue({ ...report, kind: 'MONTHLY' });
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    await screen.findByTestId('snapshot-line');
    expect(screen.queryByRole('button', { name: 'Mail me this report' })).not.toBeInTheDocument();
  });
});
