import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiJobDetail from './MasiJobDetail';
import { job, prepared, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchCvMaster: vi.fn(),
  fetchMasiJob: vi.fn(),
  fetchMasiPackages: vi.fn(),
  fetchMasiSimilarJobs: vi.fn(),
  requestMasiPackage: vi.fn(),
  saveMasiJobNote: vi.fn(),
  reviewMasiPackage: vi.fn(),
  regenerateMasiPackage: vi.fn(),
  fetchMasiArtifact: vi.fn(),
}));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchCvMaster).mockReset();
  vi.mocked(api.fetchCvMaster).mockResolvedValue({
    active: {
      version: 2,
      note: null,
      active: true,
      activatedAt: null,
      createdAt: '2026-09-18T00:00:00Z',
      schemaVersion: '1',
    },
    yaml: 'x',
    completeness: null,
  });
  vi.mocked(api.fetchMasiJob).mockReset();
  vi.mocked(api.fetchMasiPackages).mockReset();
  vi.mocked(api.fetchMasiSimilarJobs).mockReset();
  vi.mocked(api.fetchMasiSimilarJobs).mockResolvedValue([]);
  vi.mocked(api.requestMasiPackage).mockReset();
  vi.mocked(api.reviewMasiPackage).mockReset();
  vi.mocked(api.regenerateMasiPackage).mockReset();
});

describe('MasiJobDetail', () => {
  it('hints at open jobs of the same company that read like this one, and says nothing when there are none', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    vi.mocked(api.fetchMasiSimilarJobs).mockResolvedValue([
      {
        id: 9,
        title: 'Senior Java Developer (Payments)',
        similarity: 0.71,
        firstSeenAt: '2026-09-10T08:00:00Z',
      },
    ]);
    const view = renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    const hint = await screen.findByRole('note');
    expect(hint).toHaveTextContent('Looks like');
    const link = screen.getByRole('link', { name: 'Senior Java Developer (Payments)' });
    expect(link).toHaveAttribute('href', '/masi/jobs/9');
    expect(hint).toHaveTextContent('71% similar title');
    expect(api.fetchMasiSimilarJobs).toHaveBeenCalledWith(7, expect.anything());
    view.unmount();
    vi.mocked(api.fetchMasiSimilarJobs).mockResolvedValue([]);
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    await screen.findByText('Senior Java Developer');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('says where a merged job went, and names the boards a job is on', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue({
      ...job,
      status: 'MERGED',
      mergedIntoId: 12,
      sources: [],
    });
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    const view = renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    const note = await screen.findByRole('note', { name: /merged/i });
    expect(note).toHaveTextContent('the same posting');
    expect(screen.getByText('merged', { selector: '.card-header .muted' })).toBeInTheDocument();
    expect(within(note).getByRole('link', { name: /job 12/ })).toHaveAttribute(
      'href',
      '/masi/jobs/12',
    );
    view.unmount();
    vi.mocked(api.fetchMasiJob).mockResolvedValue({ ...job, sources: ['cvee', 'meetfrank'] });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    await screen.findByText('Senior Java Developer');
    expect(screen.queryByRole('note', { name: /merged/i })).not.toBeInTheDocument();
    expect(screen.getByText('open', { selector: '.card-header .muted' })).toBeInTheDocument();
    const listedOn = screen.getByRole('list', { name: 'Listed on' });
    expect(within(listedOn).getByText('cvee')).toBeInTheDocument();
    expect(within(listedOn).getByText('meetfrank')).toBeInTheDocument();
  });

  it('lists several look-alikes one per line, and shows the job only once the hint has settled', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    let release: (v: Awaited<ReturnType<typeof api.fetchMasiSimilarJobs>>) => void = () => {};
    vi.mocked(api.fetchMasiSimilarJobs).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    // the hint sits above the note and the buttons: painting the job first and the hint later moves them under the finger
    await waitFor(() => expect(api.fetchMasiSimilarJobs).toHaveBeenCalled());
    expect(screen.queryByText('Senior Java Developer')).not.toBeInTheDocument();
    release([
      {
        id: 9,
        title: 'Senior Java Developer (Payments)',
        similarity: 0.71,
        firstSeenAt: '2026-09-10T08:00:00Z',
      },
      {
        id: 10,
        title: 'Senior Java Developer II',
        similarity: 0.64,
        firstSeenAt: '2026-09-11T08:00:00Z',
      },
    ]);
    const hint = await screen.findByRole('note');
    expect(within(hint).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Senior Java Developer')).toBeInTheDocument();
  });

  it('shows how the job matches the CV, and nothing about it for a job that was never analysed', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue({
      ...job,
      matchScore: 50,
      match: {
        score: 50,
        supportedMustHave: ['Java'],
        missingMustHave: ['Rust'],
        notScored: [],
        unscored: null,
      },
    });
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    const view = renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    const region = await screen.findByRole('region', { name: 'Match with your CV' });
    expect(region).toHaveTextContent('50');
    expect(region).toHaveTextContent('Rust');
    view.unmount();
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    await screen.findByText(/first seen/);
    expect(screen.queryByRole('region', { name: 'Match with your CV' })).not.toBeInTheDocument();
  });

  it('still shows the job when the hint cannot be loaded', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    vi.mocked(api.fetchMasiSimilarJobs).mockRejectedValue(new Error('boom'));
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    expect(await screen.findByText('Senior Java Developer')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the job, its listings and description, and prepares a package on request', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([]);
    vi.mocked(api.requestMasiPackage).mockResolvedValue({
      ...prepared,
      status: 'NEW',
      tunedCv: null,
      coverLetter: null,
      claims: null,
      lint: null,
      artifacts: [],
    });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    expect(await screen.findByText('Senior Java Developer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cvee' })).toHaveAttribute('href', 'https://cv.ee/x');
    expect(screen.getByText('We are hiring. token-POSTING')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/companies/3',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Prepare package' }));
    await waitFor(() => expect(api.requestMasiPackage).toHaveBeenCalledWith(7));
    expect(screen.getByText('Package queued; it prepares in the background')).toBeInTheDocument();
    expect(screen.getByTestId('package-panel')).toHaveTextContent('new');
    expect(screen.queryByRole('button', { name: 'Prepare package' })).not.toBeInTheDocument();
  });

  it('shows a prepared package with 0 violations, lint, the letter, and marks it applied through the API', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue({
      ...job,
      packageId: 11,
      packageStatus: 'PREPARED',
    });
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([prepared]);
    vi.mocked(api.reviewMasiPackage)
      .mockResolvedValueOnce({ ...prepared, status: 'REVIEWED' })
      .mockResolvedValue({ ...prepared, status: 'APPLIED', appliedAt: '2026-09-18T10:00:00Z' });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    expect(await screen.findByTestId('package-panel')).toBeInTheDocument();
    expect(screen.getByTestId('claims-clean')).toHaveTextContent('0 claims violations');
    expect(screen.getByTestId('lint')).toHaveTextContent('1 lint warning(s)');
    expect(screen.getByText('Cut p99 latency from 800 ms to 120 ms')).toBeInTheDocument();
    expect(screen.getByText('(collapsed)')).toBeInTheDocument();
    expect(screen.getByText('Dear Nortal team, token-LETTER')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jobs' })).toHaveClass('active'); // the nested path keeps its tab
    vi.mocked(api.fetchMasiArtifact).mockResolvedValue(
      new Blob(['%PDF-'], { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open CV PDF' }));
    await waitFor(() => expect(api.fetchMasiArtifact).toHaveBeenCalledWith(11, 'CV_PDF'));
    await userEvent.click(screen.getByRole('button', { name: 'Download letter' }));
    await waitFor(() => expect(api.fetchMasiArtifact).toHaveBeenLastCalledWith(11, 'LETTER_TXT'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await userEvent.click(screen.getByRole('button', { name: 'Copy letter' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Dear Nortal team, token-LETTER'));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    vi.mocked(api.saveMasiJobNote).mockResolvedValue({ ...job, userNote: 'call Kati' });
    await userEvent.type(screen.getByLabelText('Your note'), 'call Kati');
    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(api.saveMasiJobNote).toHaveBeenCalledWith(7, 'call Kati'));
    await userEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));
    await waitFor(() => expect(api.reviewMasiPackage).toHaveBeenCalledWith(11, 'REVIEWED', ''));
    expect(screen.queryByRole('button', { name: 'Prepare package' })).not.toBeInTheDocument(); // a package for the active version exists
    await userEvent.type(screen.getByLabelText('Notes'), 'sent via their form');
    await userEvent.click(screen.getByRole('button', { name: 'Mark applied' })); // from REVIEWED
    await waitFor(() =>
      expect(api.reviewMasiPackage).toHaveBeenCalledWith(11, 'APPLIED', 'sent via their form'),
    );
    expect(screen.getByText('Marked applied — you sent it, masi never does')).toBeInTheDocument();
    expect(screen.getByLabelText('Employer response')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
  });

  it('polls a queued package until it settles and stops polling when the page goes away', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
      const queued = {
        ...prepared,
        status: 'NEW',
        tunedCv: null,
        coverLetter: null,
        claims: null,
        lint: null,
        artifacts: [],
      };
      vi.mocked(api.fetchMasiPackages)
        .mockResolvedValueOnce([queued])
        .mockResolvedValueOnce([queued])
        .mockResolvedValue([prepared]);
      const view = renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByTestId('package-panel')).toHaveTextContent('new');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(api.fetchMasiPackages).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(api.fetchMasiPackages).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('package-panel')).toHaveTextContent('prepared'); // settled: polling ends
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(api.fetchMasiPackages).toHaveBeenCalledTimes(3);
      // a page that goes away while a package is still queued takes its timer with it
      vi.mocked(api.fetchMasiPackages).mockResolvedValue([queued]);
      const utils = renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
      await act(async () => {
        await Promise.resolve();
      });
      const before = vi.mocked(api.fetchMasiPackages).mock.calls.length;
      utils.unmount();
      view.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(api.fetchMasiPackages).toHaveBeenCalledTimes(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers Prepare again once a newer CV version is active, and never for a closed job', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([{ ...prepared, cvVersion: 1 }]); // an older version's package
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    expect(await screen.findByRole('button', { name: 'Prepare package' })).toBeInTheDocument();
    vi.mocked(api.fetchMasiJob).mockResolvedValue({
      ...job,
      status: 'CLOSED',
      closedAt: '2026-09-18T11:00:00Z',
    });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    await screen.findAllByText(/closed/);
    expect(screen.getAllByRole('button', { name: 'Regenerate' })).toHaveLength(1); // the open job's panel only
  });

  it('shows the refused claims of a guard failure and offers regenerate', async () => {
    vi.mocked(api.fetchMasiJob).mockResolvedValue(job);
    vi.mocked(api.fetchMasiPackages).mockResolvedValue([
      {
        ...prepared,
        status: 'FAILED_GUARD',
        claims: [{ rule: 'skills', detail: "'Rust' is not in the master" }],
        artifacts: [],
        error: 'refused twice: skills',
      },
    ]);
    vi.mocked(api.regenerateMasiPackage).mockResolvedValue({
      ...prepared,
      status: 'NEW',
      claims: null,
      tunedCv: null,
      artifacts: [],
    });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    await waitFor(() =>
      expect(screen.getByTestId('claims')).toHaveTextContent("'Rust' is not in the master"),
    );
    expect(screen.queryByRole('button', { name: 'Open CV PDF' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(api.regenerateMasiPackage).toHaveBeenCalledWith(11));
    expect(screen.getByTestId('package-panel')).toHaveTextContent('new');
  });
});
