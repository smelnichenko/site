import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiSources from './MasiSources';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiSources: vi.fn(),
  fetchMasiSourceRuns: vi.fn(),
  patchMasiSource: vi.fn(),
  runMasiSource: vi.fn(),
}));
const api = await import('../../services/api');

const cvee = {
  id: 1,
  key: 'cvee',
  name: 'cv.ee',
  kind: 'DETERMINISTIC',
  scope: 'JOBS',
  baseUrl: 'https://cv.ee',
  cron: '0 17 * * * *',
  enabled: false,
  configJson: null,
  termsNote: null,
  health: 'OK',
  consecutiveFailures: 0,
  lastRunAt: '2026-09-18T09:26:45Z',
  lastSuccessAt: '2026-09-18T09:26:45Z',
  lastError: null,
  running: false,
};

beforeEach(() => {
  vi.mocked(api.fetchMasiSources).mockReset();
  vi.mocked(api.fetchMasiSourceRuns).mockReset();
  vi.mocked(api.patchMasiSource).mockReset();
  vi.mocked(api.runMasiSource).mockReset();
});

describe('MasiSources', () => {
  it('lists sources, enables one, runs it now and shows its runs', async () => {
    vi.mocked(api.fetchMasiSources)
      .mockResolvedValueOnce([cvee])
      .mockResolvedValue([{ ...cvee, enabled: true }]);
    vi.mocked(api.patchMasiSource).mockResolvedValue({ ...cvee, enabled: true });
    vi.mocked(api.runMasiSource).mockResolvedValue(undefined);
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [
        {
          id: 9,
          sourceId: 1,
          startedAt: '2026-09-18T09:26:00Z',
          finishedAt: '2026-09-18T09:26:45Z',
          status: 'OK',
          complete: true,
          fetched: 1,
          parsed: 247,
          newJobs: 12,
          updatedListings: 235,
          closedListings: 3,
          newCompanies: 4,
          newContacts: 0,
          error: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
    });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('0 of 1 enabled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledWith(1, { enabled: true }));
    expect(await screen.findByText('1 of 1 enabled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(api.runMasiSource).toHaveBeenCalledWith(1));
    expect(screen.getByText('cvee: run started')).toBeInTheDocument();
    // an edited cron is saved on blur, and the edit survives the reload every action triggers
    await userEvent.clear(screen.getByLabelText('Cron for cvee'));
    await userEvent.type(screen.getByLabelText('Cron for cvee'), '0 5 * * * *');
    await userEvent.tab();
    await waitFor(() =>
      expect(api.patchMasiSource).toHaveBeenCalledWith(1, { cron: '0 5 * * * *' }),
    );
    expect(await screen.findByText('cvee: cron saved')).toBeInTheDocument();
    expect(screen.getByLabelText('Cron for cvee')).toHaveValue('0 5 * * * *');
    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(api.runMasiSource).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole('button', { name: 'cv.ee' }));
    expect(await screen.findByTestId('runs-cvee')).toHaveTextContent('247');
    expect(screen.getByTestId('runs-cvee')).toHaveTextContent('12');
  });
});
