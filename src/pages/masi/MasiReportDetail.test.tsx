import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiReportDetail from './MasiReportDetail';
import { looseSeparators, renderAt } from './testUtils';
import { oldReport, report } from './statsFixture';

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
    expect(looseSeparators(screen.getByTestId('snapshot-line').textContent)).toEqual([]);
    expect(screen.getByTestId('source-counts')).toHaveTextContent(
      '225 sources · 200 enabled · 4 needed a look',
    );
    expect(looseSeparators(screen.getByTestId('source-counts').textContent)).toEqual([]);
    // the ones that wanted a look, worst first, each a link to it on the Sources page today
    const badges = within(screen.getByTestId('source-health')).getAllByRole('link');
    expect(badges.map((b) => b.textContent)).toEqual([
      'ats:wise: auto-disabled',
      'cvkeskus: failing',
      'ats:pipedrive: degraded',
      'bolt: degraded',
    ]);
    expect(badges[0]).toHaveAttribute('href', '/masi/sources?q=ats%3Awise');
    expect(badges[0]).toHaveClass('status-badge', 'error');
    expect(badges[2]).toHaveClass('status-badge', 'action');
    expect(screen.queryByRole('link', { name: /more/ })).not.toBeInTheDocument();
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
  it('says how many more wanted a look than the report names, and leads to them', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue({
      ...report,
      snapshot: {
        ...report.snapshot,
        sourceCounts: { ...report.snapshot.sourceCounts!, ATTENTION: 57 },
      },
    });
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    expect(await screen.findByTestId('source-counts')).toHaveTextContent('57 needed a look');
    expect(screen.getByRole('link', { name: 'and 53 more' })).toHaveAttribute(
      'href',
      '/masi/sources?state=ATTENTION&sort=health,desc',
    );
  });

  it('names no source when none wanted a look', async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue({
      ...report,
      snapshot: {
        ...report.snapshot,
        sourceHealth: {},
        sourceCounts: { ...report.snapshot.sourceCounts!, ATTENTION: 0 },
      },
    });
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    expect(await screen.findByTestId('source-counts')).toHaveTextContent(
      '225 sources · 200 enabled · none needed a look',
    );
    expect(screen.queryByTestId('source-health')).not.toBeInTheDocument();
  });

  /** The site deploys before masi: a report the old masi stored, or answers, holds every source's health and no counts. */
  it("counts an old report's every source, and names only the ones that wanted a look", async () => {
    vi.mocked(api.fetchMasiReport).mockResolvedValue(oldReport);
    renderAt('/masi/reports/5', '/masi/reports/:id', <MasiReportDetail />);
    // six sources, one switched off ("DISABLED"), three unwell
    expect(await screen.findByTestId('source-counts')).toHaveTextContent(
      '6 sources · 5 enabled · 3 needed a look',
    );
    const badges = within(screen.getByTestId('source-health')).getAllByRole('link');
    expect(badges.map((b) => b.textContent)).toEqual([
      'cvkeskus: failing',
      'ats:pipedrive: degraded',
      'bolt: degraded',
    ]);
    expect(screen.getByTestId('source-health')).not.toHaveTextContent('cvee');
    expect(screen.getByTestId('source-health')).not.toHaveTextContent('ats:wise');
  });
});
