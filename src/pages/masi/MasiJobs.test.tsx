import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiJobs from './MasiJobs';
import { job, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({ fetchMasiJobs: vi.fn() }));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiJobs).mockReset(); // a body, not an expression: a returned mock would run as the test's cleanup
});

describe('MasiJobs', () => {
  it('lists jobs with the package state and puts the filters in the URL', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, packageId: 11, packageStatus: 'PREPARED' },
        { ...job, id: 8, title: 'Go Engineer', status: 'CLOSED' },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/jobs?status=ALL', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('2 matching')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
      status: 'ALL',
      page: 0,
      size: 50,
    });
    expect(screen.getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
    expect(screen.getByRole('link', { name: 'prepared' })).toHaveAttribute(
      'href',
      '/masi/packages/11',
    );
    expect(screen.getByText('(closed)')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Package'), 'NONE');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ packageStatus: 'NONE' }),
        expect.anything(),
      ),
    );
    await userEvent.type(screen.getByLabelText('Search title'), 'java{enter}');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: 'java',
          packageStatus: 'NONE',
        }),
        expect.anything(),
      ),
    );
  });

  it('pages through a long registry', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 120,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.anything(),
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText('Remote'), 'REMOTE');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ remote: 'REMOTE', page: 0 }),
        expect.anything(),
      ),
    ); // a new filter starts over
  });

  it('shows the empty state', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('No jobs match.')).toBeInTheDocument();
  });
});
