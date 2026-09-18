import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiJobDetail from './MasiJobDetail';
import { job, prepared, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchCvMaster: vi.fn(),
  fetchMasiJob: vi.fn(),
  fetchMasiPackages: vi.fn(),
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
  vi.mocked(api.requestMasiPackage).mockReset();
  vi.mocked(api.reviewMasiPackage).mockReset();
  vi.mocked(api.regenerateMasiPackage).mockReset();
});

describe('MasiJobDetail', () => {
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
    vi.mocked(api.reviewMasiPackage).mockResolvedValue({
      ...prepared,
      status: 'APPLIED',
      appliedAt: '2026-09-18T10:00:00Z',
    });
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <MasiJobDetail />);
    expect(await screen.findByTestId('package-panel')).toBeInTheDocument();
    expect(screen.getByTestId('claims-clean')).toHaveTextContent('0 claims violations');
    expect(screen.getByTestId('lint')).toHaveTextContent('1 lint warning(s)');
    expect(screen.getByText('Cut p99 latency from 800 ms to 120 ms')).toBeInTheDocument();
    expect(screen.getByText('(collapsed)')).toBeInTheDocument();
    expect(screen.getByText('Dear Nortal team, token-LETTER')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open CV PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download letter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepare package' })).not.toBeInTheDocument(); // a package for the active version exists
    await userEvent.type(screen.getByLabelText('Notes'), 'sent via their form');
    await userEvent.click(screen.getByRole('button', { name: 'Mark applied' }));
    await waitFor(() =>
      expect(api.reviewMasiPackage).toHaveBeenCalledWith(11, 'APPLIED', 'sent via their form'),
    );
    expect(screen.getByText('Marked applied — you sent it, masi never does')).toBeInTheDocument();
    expect(screen.getByLabelText('Employer response')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
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
