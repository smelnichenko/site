import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiBookings from './MasiBookings';
import { renderAt } from './testUtils';
import { bookings } from './fixtures';

vi.mock('../../services/api', () => ({ fetchMasiBookings: vi.fn() }));
const api = await import('../../services/api');

const from = '2026-03-22T22:00:00Z';
const to = '2026-03-29T21:00:00Z';

beforeEach(() => {
  vi.mocked(api.fetchMasiBookings).mockReset();
});

describe('MasiBookings', () => {
  it("shows a report's interviews held in its period, in one language, each leading to its job", async () => {
    vi.mocked(api.fetchMasiBookings).mockResolvedValue({
      content: bookings,
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt(
      `/masi/bookings?event=INTERVIEW_HELD&language=et&from=${from}&to=${to}`,
      '/masi/bookings',
      <MasiBookings />,
    );
    expect(await screen.findByText('2 matching')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiBookings).mock.calls[0][0]).toEqual({
      event: 'INTERVIEW_HELD',
      from,
      to,
      language: 'et',
      page: 0,
      size: 50,
    });
    expect(screen.getByRole('region', { name: 'Report filter' })).toHaveTextContent(
      'interviews held 23 Mar 2026 – 29 Mar 2026 · applied in et',
    );
    const first = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(first).getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
    expect(first).toHaveTextContent('done');
  });

  it('names the interviews whose language is not known, and clears back to every booking', async () => {
    vi.mocked(api.fetchMasiBookings).mockResolvedValue({
      content: bookings,
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt(
      `/masi/bookings?event=INTERVIEW_HELD&language=none&from=${from}&to=${to}`,
      '/masi/bookings',
      <MasiBookings />,
    );
    const note = await screen.findByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent(
      'interviews held 23 Mar 2026 – 29 Mar 2026 · language not known',
    );
    await userEvent.click(within(note).getByRole('button', { name: 'clear the report filter' }));
    await waitFor(() =>
      expect(api.fetchMasiBookings).toHaveBeenLastCalledWith(
        { page: 0, size: 50 },
        expect.anything(),
      ),
    );
  });

  it('says so when a load fails', async () => {
    vi.mocked(api.fetchMasiBookings).mockRejectedValue(
      new Error('event INTERVIEW_HELD needs both from and to'),
    );
    renderAt('/masi/bookings', '/masi/bookings', <MasiBookings />);
    expect(await screen.findByRole('alert')).toHaveTextContent('needs both from and to');
  });
});
