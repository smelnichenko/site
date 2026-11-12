import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiPackages from './MasiPackages';
import { prepared, renderAt } from './testUtils';
import type { MasiPackageRow } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiPackagePage: vi.fn(),
  fetchMasiRetuneEstimate: vi.fn(),
  retuneMasi: vi.fn(),
}));
const api = await import('../../services/api');

/** A page of packages as the server gives it: these rows, of {@code total} matching. */
function pageOf(rows: MasiPackageRow[], total = rows.length, page = 0) {
  return { content: rows, page, size: 50, totalElements: total };
}

/** The first page asked for, the default order: what every call carries besides its filter. */
const FIRST = { page: 0, size: 50, sort: 'updatedAt,desc' };

beforeEach(() => {
  vi.mocked(api.fetchMasiPackagePage).mockReset();
  vi.mocked(api.fetchMasiRetuneEstimate).mockReset();
  vi.mocked(api.retuneMasi).mockReset();
});

describe('MasiPackages', () => {
  it('lists the queue by state and re-tunes only after the estimate', async () => {
    vi.mocked(api.fetchMasiPackagePage).mockResolvedValue(pageOf([prepared]));
    vi.mocked(api.fetchMasiRetuneEstimate).mockResolvedValue({ count: 254, estimatedUsd: 105.2 });
    vi.mocked(api.retuneMasi).mockResolvedValue({ count: 254, estimatedUsd: 105.2 });
    renderAt('/masi/packages', '/masi/packages', <MasiPackages />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
        'href',
        '/masi/jobs/7',
      ),
    );
    expect(vi.mocked(api.fetchMasiPackagePage).mock.calls[0][0]).toEqual({
      status: 'PREPARED',
      ...FIRST,
    });
    expect(screen.getByText('$0.12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-tune/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Estimate' }));
    await waitFor(() =>
      expect(screen.getByTestId('retune-estimate')).toHaveTextContent('254 job(s) · about $105.20'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Re-tune 254 jobs (~$105.20)' }));
    await waitFor(() => expect(api.retuneMasi).toHaveBeenCalled());
    expect(
      screen.getByText('254 package(s) queued (reservation estimate $105.20)'),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('State'), 'APPLIED');
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPackagePage).mock.calls[1][0]).toEqual({
        status: 'APPLIED',
        ...FIRST,
      }),
    );
  });

  it("shows a report's funnel figure: the packages applied in the period, of every state, and clears back to the queue", async () => {
    vi.mocked(api.fetchMasiPackagePage).mockResolvedValue(pageOf([prepared]));
    const from = '2026-03-22T22:00:00Z';
    const to = '2026-03-29T21:00:00Z';
    renderAt(
      `/masi/packages?event=APPLIED&from=${from}&to=${to}`,
      '/masi/packages',
      <MasiPackages />,
    );
    expect(await screen.findByRole('link', { name: 'Senior Java Developer' })).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiPackagePage).mock.calls[0][0]).toEqual({
      event: 'APPLIED',
      from,
      to,
      ...FIRST,
    });
    expect(screen.getByLabelText('State')).toHaveValue('ALL');
    const note = screen.getByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent('applied 23 Mar 2026 – 29 Mar 2026');
    // a state narrows the figure's packages and keeps the period
    await userEvent.selectOptions(screen.getByLabelText('State'), 'PREPARED');
    await waitFor(() =>
      expect(api.fetchMasiPackagePage).toHaveBeenLastCalledWith(
        { status: 'PREPARED', event: 'APPLIED', from, to, ...FIRST },
        expect.anything(),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'clear the report filter' }));
    await waitFor(() =>
      expect(api.fetchMasiPackagePage).toHaveBeenLastCalledWith(
        { status: 'PREPARED', ...FIRST },
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('region', { name: 'Report filter' })).not.toBeInTheDocument();
  });

  it('pages on the server: the next page asked for, a new state back at the first, a column sorted by the server', async () => {
    vi.mocked(api.fetchMasiPackagePage).mockResolvedValue(pageOf([prepared], 137));
    renderAt('/masi/packages', '/masi/packages', <MasiPackages />);
    expect(await screen.findByText('137 matching')).toBeInTheDocument();
    expect(screen.getByText('page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.fetchMasiPackagePage).toHaveBeenLastCalledWith(
        { status: 'PREPARED', ...FIRST, page: 1 },
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /Company/ }));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPackagePage).mock.lastCall?.[0].sort).toMatch(/^company,/),
    );

    await userEvent.selectOptions(screen.getByLabelText('State'), 'APPLIED');
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPackagePage).mock.lastCall?.[0]).toMatchObject({
        status: 'APPLIED',
        page: 0,
      }),
    );
  });
});
