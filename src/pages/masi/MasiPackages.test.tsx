import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiPackages from './MasiPackages';
import { prepared, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiPackages: vi.fn(),
  fetchMasiRetuneEstimate: vi.fn(),
  retuneMasi: vi.fn(),
}));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiPackages).mockReset();
  vi.mocked(api.fetchMasiRetuneEstimate).mockReset();
  vi.mocked(api.retuneMasi).mockReset();
});

describe('MasiPackages', () => {
  it('lists the queue by state and re-tunes only after the estimate', async () => {
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([prepared]);
    vi.mocked(api.fetchMasiRetuneEstimate).mockResolvedValue({ count: 254, estimatedUsd: 105.2 });
    vi.mocked(api.retuneMasi).mockResolvedValue({ count: 254, estimatedUsd: 105.2 });
    renderAt('/masi/packages', '/masi/packages', <MasiPackages />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
        'href',
        '/masi/jobs/7',
      ),
    );
    expect(vi.mocked(api.fetchMasiPackages).mock.calls[0][0]).toEqual({ status: 'PREPARED' });
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
      expect(vi.mocked(api.fetchMasiPackages).mock.calls[1][0]).toEqual({ status: 'APPLIED' }),
    );
  });
});
