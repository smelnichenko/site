import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiListings from './MasiListings';
import { renderAt } from './testUtils';
import { listings } from './fixtures';

vi.mock('../../services/api', () => ({ fetchMasiListings: vi.fn() }));
const api = await import('../../services/api');

const from = '2026-03-22T22:00:00Z';
const to = '2026-03-29T21:00:00Z';

beforeEach(() => {
  vi.mocked(api.fetchMasiListings).mockReset();
});

describe('MasiListings', () => {
  it("shows a source's listings closed in a report's period, each leading to its job and its board", async () => {
    vi.mocked(api.fetchMasiListings).mockResolvedValue({
      content: listings,
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt(
      `/masi/listings?event=CLOSED&source=cvee&from=${from}&to=${to}`,
      '/masi/listings',
      <MasiListings />,
    );
    expect(await screen.findByText('2 matching')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiListings).mock.calls[0][0]).toEqual({
      event: 'CLOSED',
      from,
      to,
      source: 'cvee',
      page: 0,
      size: 50,
    });
    expect(screen.getByRole('region', { name: 'Report filter' })).toHaveTextContent(
      'closed 23 Mar 2026 – 29 Mar 2026 · on cvee',
    );
    const table = screen.getByRole('table');
    const first = within(table).getAllByRole('row')[1];
    expect(within(first).getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
    const board = within(first).getByRole('link', { name: 'Senior Java Developer (Spring)' });
    expect(board).toHaveAttribute('href', 'https://cv.ee/vacancy/41');
    expect(board).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(first).getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/companies/3',
    );
    expect(first).toHaveTextContent('cv.ee');
    expect(first).toHaveTextContent('25 Mar 2026');
    // the listing still up says so, not a dash a reader takes for "unknown"
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('still listed');
  });

  it('clears the report filter back to every listing, newest first', async () => {
    vi.mocked(api.fetchMasiListings).mockResolvedValue({
      content: listings,
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt(
      `/masi/listings?event=NEW&source=cvee&from=${from}&to=${to}`,
      '/masi/listings',
      <MasiListings />,
    );
    const note = await screen.findByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent('first seen 23 Mar 2026 – 29 Mar 2026 · on cvee');
    await userEvent.click(within(note).getByRole('button', { name: 'clear the report filter' }));
    await waitFor(() =>
      expect(api.fetchMasiListings).toHaveBeenLastCalledWith(
        { page: 0, size: 50 },
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('region', { name: 'Report filter' })).not.toBeInTheDocument();
  });

  it('pages through a long list, keeping the filter', async () => {
    vi.mocked(api.fetchMasiListings).mockResolvedValue({
      content: listings,
      page: 0,
      size: 50,
      totalElements: 120,
    });
    renderAt(`/masi/listings?event=NEW&from=${from}&to=${to}`, '/masi/listings', <MasiListings />);
    expect(await screen.findByText('page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.fetchMasiListings).toHaveBeenLastCalledWith(
        { event: 'NEW', from, to, page: 1, size: 50 },
        expect.anything(),
      ),
    );
  });

  it('says so when a load fails', async () => {
    vi.mocked(api.fetchMasiListings).mockRejectedValue(
      new Error('event NEW needs both from and to'),
    );
    renderAt('/masi/listings', '/masi/listings', <MasiListings />);
    expect(await screen.findByRole('alert')).toHaveTextContent('event NEW needs both from and to');
  });
});
