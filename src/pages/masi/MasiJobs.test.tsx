import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

  it('marks every row with the sources that list the job, and a merged job as merged', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, sources: ['cvee', 'meetfrank'], reopenedCount: 2 },
        { ...job, id: 8, title: 'Go Engineer', sources: [] },
        {
          ...job,
          id: 9,
          title: 'Java Developer | EE',
          status: 'MERGED',
          mergedIntoId: 7,
          sources: [],
        },
      ],
      page: 0,
      size: 50,
      totalElements: 3,
    });
    renderAt('/masi/jobs?status=ALL', '/masi/jobs', <MasiJobs />);
    const listed = await screen.findByRole('row', { name: /^Senior Java Developer/ });
    const sourcesColumn = screen
      .getAllByRole('columnheader')
      .findIndex((h) => h.textContent?.trim() === 'Sources');
    expect(sourcesColumn).toBeGreaterThan(-1);
    expect(within(listed).getByText('reposted ×2')).toBeInTheDocument();
    const marks = within(listed).getAllByRole('cell')[sourcesColumn];
    expect(within(marks).getByText('cvee')).toBeInTheDocument();
    expect(within(marks).getByText('meetfrank')).toBeInTheDocument();
    const unlisted = screen.getByRole('row', { name: /Go Engineer/ });
    expect(within(unlisted).queryByText(/reposted/)).not.toBeInTheDocument();
    expect(within(unlisted).getAllByRole('cell')[sourcesColumn]).toHaveTextContent('—');
    const merged = screen.getByRole('row', { name: /^Java Developer \| EE/ });
    expect(merged).toHaveTextContent('(merged)');
    expect(within(merged).getByRole('link', { name: 'merged into job 7' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
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
  it('shows the match score, and sorts by it through the URL', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, matchScore: 86 },
        { ...job, id: 8, title: 'Go Engineer', matchScore: null },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    const scored = await screen.findByRole('row', { name: /Senior Java Developer/ });
    const matchColumn = screen
      .getAllByRole('columnheader')
      .findIndex((h) => h.textContent?.trim() === 'Match');
    expect(matchColumn).toBeGreaterThan(-1);
    expect(within(scored).getAllByRole('cell')[matchColumn]).toHaveTextContent('86');
    const unscored = screen.getByRole('row', { name: /Go Engineer/ });
    expect(within(unscored).getAllByRole('cell')[matchColumn]).toHaveTextContent('not scored');
    expect(
      screen.getByText(/how much of what the posting asks for your CV shows/),
    ).toBeInTheDocument();
    // newest first until asked: no sort is sent at all
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBeUndefined();
    await userEvent.selectOptions(screen.getByLabelText('Order'), 'match,desc');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'match,desc', page: 0 }),
        expect.anything(),
      ),
    );
  });

  it('takes the order from the URL, and ignores one it does not offer', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs?sort=match,desc', '/masi/jobs', <MasiJobs />);
    await screen.findByText('No jobs match.');
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBe('match,desc');
    expect(screen.getByLabelText('Order')).toHaveValue('match,desc');
  });

  it('does not pass on an order the page does not offer', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs?sort=salary,asc', '/masi/jobs', <MasiJobs />);
    await screen.findByText('No jobs match.');
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBeUndefined();
  });
});
