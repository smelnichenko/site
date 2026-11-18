import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiSources from './MasiSources';
import MasiSourceDetail from './MasiSourceDetail';
import { renderAt } from './testUtils';
import type { MasiSource, MasiSourceCounts } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiSourceList: vi.fn(),
  fetchMasiSource: vi.fn(),
  fetchMasiSourceRuns: vi.fn(),
  patchMasiSource: vi.fn(),
  runMasiSource: vi.fn(),
  fetchMasiAssistant: vi.fn(() =>
    Promise.resolve({ enabled: false, gmailReady: false, linkedinReady: false }),
  ),
  patchMasiAssistant: vi.fn(),
  fetchMasiPictureStatus: vi.fn(() => new Promise(() => {})),
  collectMasiPictures: vi.fn(),
  fetchMasiSwitches: vi.fn(() => Promise.resolve({})),
  fetchMasiSourceHistory: vi.fn(() => Promise.resolve([])),
}));
// the old masi's fallback reads a real answer through the real call: no login behind it
vi.mock('../../services/oidcClient', () => ({
  getAccessToken: vi.fn(() => Promise.resolve('token')),
  login: vi.fn(),
}));
const api = await import('../../services/api');
const real = await vi.importActual<typeof import('../../services/api')>('../../services/api');

/** Every "Show" counted, as masi's /sources/counts answers. */
function countsOf(over: Partial<MasiSourceCounts> = {}): MasiSourceCounts {
  return {
    ALL: 1,
    ENABLED: 0,
    RUNNING: 0,
    ATTENTION: 0,
    OK: 0,
    DEGRADED: 0,
    FAILING: 0,
    DISABLED_AUTO: 0,
    OFF: 1,
    ...over,
  };
}

/** What fetchMasiSourceList answers: the first page of `rows`, as many as `total` in all, and the counts. */
function listed(
  rows: MasiSource[],
  over: { total?: number; page?: number; counts?: Partial<MasiSourceCounts> } = {},
) {
  return {
    page: {
      content: rows,
      page: over.page ?? 0,
      size: 50,
      totalElements: over.total ?? rows.length,
    },
    counts: countsOf({ ALL: rows.length, ...over.counts }),
  };
}

/** The filter the page last asked masi for. */
function lastAsked() {
  return vi.mocked(api.fetchMasiSourceList).mock.lastCall?.[0];
}

/** A finished run of cv.ee. */
function run(id: number, startedAt: string, parsed: number) {
  return {
    id,
    sourceId: 1,
    startedAt,
    finishedAt: startedAt,
    status: 'OK',
    complete: true,
    fetched: 1,
    parsed,
    newJobs: 0,
    updatedListings: 0,
    closedListings: 0,
    newCompanies: 0,
    newContacts: 0,
    error: null,
  };
}

/** The sources' names, top to bottom: each row's first button. */
function rowNames(): string[] {
  return within(screen.getAllByRole('table')[0])
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('button')[0].textContent);
}

const cvee = {
  id: 1,
  key: 'cvee',
  name: 'cv.ee',
  kind: 'DETERMINISTIC',
  scope: 'JOBS',
  baseUrl: 'https://cv.ee',
  cron: '0 17 * * * *',
  nextRunAt: '2026-11-09T00:17:00Z',
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
const bolt: MasiSource = {
  ...cvee,
  id: 7,
  key: 'ats:bolt',
  name: 'Bolt (Greenhouse)',
  kind: 'ATS',
  enabled: true,
  health: 'DEGRADED',
  consecutiveFailures: 2,
};
const wise: MasiSource = {
  ...cvee,
  id: 8,
  key: 'ats:wise',
  name: 'Wise (Greenhouse)',
  kind: 'ATS',
  enabled: true,
  health: 'FAILING',
  consecutiveFailures: 5,
};

beforeEach(() => {
  vi.mocked(api.fetchMasiSourceList).mockReset();
  vi.mocked(api.fetchMasiSource).mockReset();
  vi.mocked(api.fetchMasiSourceRuns).mockReset();
  vi.mocked(api.patchMasiSource).mockReset();
  vi.mocked(api.runMasiSource).mockReset();
  vi.unstubAllGlobals();
});

describe('MasiSources', () => {
  it('lists sources, enables one, runs it now and shows its runs', async () => {
    vi.mocked(api.fetchMasiSourceList)
      .mockResolvedValueOnce(listed([cvee]))
      .mockResolvedValue(listed([{ ...cvee, enabled: true }], { counts: { ENABLED: 1, OFF: 0 } }));
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
    expect(await screen.findByText('0 of 1 enabled · 1 shown')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledWith(1, { enabled: true }));
    // an action reads the page and the counts again, with the same filter
    expect(await screen.findByText('1 of 1 enabled · 1 shown')).toBeInTheDocument();
    expect(api.fetchMasiSourceList).toHaveBeenCalledTimes(2);
    expect(lastAsked()).toEqual({
      q: undefined,
      state: undefined,
      sort: 'name,asc',
      page: 0,
      size: 50,
    });
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

  it("shows a source's daily request cap, saves an edit into its config with the rest untouched, and clears it", async () => {
    const meetfrank = {
      ...cvee,
      id: 9,
      key: 'meetfrank',
      name: 'MeetFrank (Estonia)',
      configJson: '{"countryId":"5a08cc451b7ce3b929d4128b","pageSize":12,"dailyRequestCap":100}',
    };
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee, meetfrank]));
    vi.mocked(api.patchMasiSource).mockImplementation((_id, patch) =>
      Promise.resolve({ ...meetfrank, configJson: patch.configJson ?? meetfrank.configJson }),
    );
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    const cap = await screen.findByLabelText('Requests per day for meetfrank');
    expect(cap).toHaveValue(100);
    // a source without a cap shows an empty field: no cap, not zero
    expect(screen.getByLabelText('Requests per day for cvee')).toHaveValue(null);

    await userEvent.clear(cap);
    await userEvent.type(cap, '40');
    await userEvent.tab();
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledTimes(1));
    const [id, patch] = vi.mocked(api.patchMasiSource).mock.calls[0];
    expect(id).toBe(9);
    const saved: unknown = JSON.parse(patch.configJson as string);
    expect(saved).toEqual({
      countryId: '5a08cc451b7ce3b929d4128b',
      pageSize: 12,
      dailyRequestCap: 40,
    });
    expect(patch.cron).toBeUndefined();

    // emptied, the cap is removed from the config: the source is no longer budgeted
    const again = await screen.findByLabelText('Requests per day for meetfrank');
    await userEvent.clear(again);
    await userEvent.tab();
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledTimes(2));
    const second: unknown = JSON.parse(
      vi.mocked(api.patchMasiSource).mock.calls[1][1].configJson as string,
    );
    expect(second).toEqual({ countryId: '5a08cc451b7ce3b929d4128b', pageSize: 12 });
  });

  /**
   * A running source says how far it has got, from figures the collector writes as it goes.
   *
   * Until those were written mid-run the row could only say "running" for two hours while several thousand people had
   * already been read.
   */
  it('shows a running source its calls and people, from the newest run', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([{ ...cvee, running: true }]));
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [
        {
          id: 9,
          sourceId: 1,
          startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          finishedAt: null,
          status: 'RUNNING',
          complete: false,
          fetched: 1267,
          parsed: 0,
          newJobs: 0,
          updatedListings: 0,
          closedListings: 0,
          newCompanies: 0,
          newContacts: 369,
          error: null,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
    } as never);

    renderAt('/masi/sources', '/masi/sources', <MasiSources />);

    const line = await screen.findByTestId('progress-cvee', {}, { timeout: 3000 });
    expect(line).toHaveTextContent('1,267 calls');
    expect(line).toHaveTextContent('369 people');
  });

  /** Nothing running: nothing polls, so an idle page costs no requests. */
  it('shows no token field: tokens live in Vault, not on the page - not even for a source whose config holds one', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(
      listed(
        [
          {
            ...cvee,
            id: 2,
            key: 'github',
            name: 'GitHub',
            configJson: '{"token":"********","perPage":100}',
          },
          {
            ...cvee,
            id: 3,
            key: 'meetfrankpeople',
            name: 'MeetFrank people',
            configJson: '{"token":"********"}',
          },
        ],
        { counts: { OFF: 2 } },
      ),
    );
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('0 of 2 enabled · 2 shown')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Token' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Token for/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('no token')).not.toBeInTheDocument();
  });

  it('does not poll the runs of a source that is not running', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee]));

    renderAt('/masi/sources', '/masi/sources', <MasiSources />);

    await screen.findByText('cv.ee');
    await new Promise((r) => setTimeout(r, 300));
    expect(api.fetchMasiSourceRuns).not.toHaveBeenCalled();
  });

  it('does not save a cap that is not a whole number of requests', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee]));
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    const cap = await screen.findByLabelText('Requests per day for cvee');
    await userEvent.type(cap, '-5');
    await userEvent.tab();
    expect(api.patchMasiSource).not.toHaveBeenCalled();
    expect(cap).toBeInvalid();
  });

  it('shows a run that worked its note as a warning, a run that failed its error as an error', async () => {
    const guard = 'guard aborted 1 request(s) to www.googletagmanager.com';
    const run = {
      sourceId: 1,
      finishedAt: '2026-09-18T09:26:45Z',
      complete: true,
      fetched: 1,
      parsed: 15,
      newJobs: 0,
      updatedListings: 15,
      closedListings: 0,
      newCompanies: 0,
      newContacts: 0,
    };
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(
      listed([
        { ...cvee, health: 'OK', lastError: guard },
        {
          ...cvee,
          id: 2,
          key: 'ibkr',
          name: 'IBKR',
          health: 'FAILING',
          consecutiveFailures: 3,
          lastError: 'returned 404',
        },
      ]),
    );
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [
        { ...run, id: 1, startedAt: '2026-09-18T09:26:00Z', status: 'OK', error: guard },
        {
          ...run,
          id: 2,
          startedAt: '2026-09-18T08:26:00Z',
          status: 'SKIPPED_BUDGET',
          error: 'the budget is spent',
        },
        {
          ...run,
          id: 3,
          startedAt: '2026-09-18T07:26:00Z',
          status: 'ERROR',
          error: 'returned 500',
        },
        {
          ...run,
          id: 4,
          startedAt: '2026-09-18T06:26:00Z',
          status: 'TIMEOUT',
          error: 'deadline exceeded',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 4,
    });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    // the health column: a healthy source's last note is a warning, a failing one's an error
    const health = await screen.findAllByText(guard);
    expect(health[0]).toHaveClass('masi-note', 'masi-note-warning');
    expect(screen.getByText('returned 404')).toHaveClass('masi-note', 'masi-note-error');
    await userEvent.click(screen.getByRole('button', { name: 'cv.ee' }));
    const runs = await screen.findByTestId('runs-cvee');
    const note = (text: string) => within(runs).getByText(text);
    expect(note(guard)).toHaveClass('masi-note-warning');
    expect(note('the budget is spent')).toHaveClass('masi-note-warning');
    expect(note('returned 500')).toHaveClass('masi-note-error');
    expect(note('deadline exceeded')).toHaveClass('masi-note-error');
    expect(note(guard)).not.toHaveClass('masi-note-error');
    expect(note('returned 500')).not.toHaveClass('masi-note-warning');
  });
  it('asks masi for the page in the URL, its Show choices say their counts, and a new Show starts at page one', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(
      listed([bolt, wise], {
        total: 120,
        page: 2,
        counts: {
          ALL: 225,
          ENABLED: 200,
          RUNNING: 2,
          ATTENTION: 5,
          OK: 196,
          DEGRADED: 3,
          FAILING: 1,
          DISABLED_AUTO: 1,
          OFF: 24,
        },
      }),
    );
    renderAt('/masi/sources?q=ats&sort=kind,desc&page=2', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('200 of 225 enabled · 120 shown')).toBeInTheDocument();
    expect(lastAsked()).toEqual({
      q: 'ats',
      state: undefined,
      sort: 'kind,desc',
      page: 2,
      size: 50,
    });
    const show = screen.getByRole('combobox', { name: 'Show' });
    expect(
      within(show)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'all (225)',
      'needs a look (5)',
      'running (2)',
      'enabled (200)',
      'well (196)',
      'degraded (3)',
      'failing (1)',
      'auto-disabled (1)',
      'off (24)',
    ]);
    await userEvent.selectOptions(show, 'needs a look (5)');
    await waitFor(() =>
      expect(lastAsked()).toEqual({
        q: 'ats',
        state: 'ATTENTION',
        sort: 'kind,desc',
        page: 0,
        size: 50,
      }),
    );
    expect(show).toHaveValue('ATTENTION');
  });

  it('asks for no Show masi does not know: a state typed into the URL lists every source', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee]));
    renderAt('/masi/sources?state=BROKEN', '/masi/sources', <MasiSources />);
    await screen.findByText('cv.ee');
    expect(lastAsked()?.state).toBeUndefined();
    expect(screen.getByRole('combobox', { name: 'Show' })).toHaveValue('');
  });

  it('searches a key or a name from the first page', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([bolt, wise], { total: 51 }));
    renderAt('/masi/sources?page=1', '/masi/sources', <MasiSources />);
    await screen.findByText('page 2 of 2');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search key or name' }), ' wise ');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ q: 'wise', page: 0 }));
  });

  it("sorts by masi: a header press asks for the sort, and the rows stay in masi's order", async () => {
    // masi's answer, worst health first: the page shows it as it came, never sorted again by name
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([wise, cvee, bolt]));
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await screen.findByText('Wise (Greenhouse)');
    expect(rowNames()).toEqual(['Wise (Greenhouse)', 'cv.ee', 'Bolt (Greenhouse)']);
    await userEvent.click(screen.getByRole('button', { name: 'Health' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ sort: 'health,asc', page: 0 }));
    expect(rowNames()).toEqual(['Wise (Greenhouse)', 'cv.ee', 'Bolt (Greenhouse)']);
    await userEvent.click(screen.getByRole('button', { name: 'Health' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ sort: 'health,desc' }));
  });

  it('pages with Next and Previous, the filters kept', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(
      listed([cvee], { total: 120, counts: { ALL: 225 } }),
    );
    renderAt('/masi/sources?state=OFF', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ state: 'OFF', page: 1 }));
    expect(await screen.findByText('page 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ page: 2 }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(lastAsked()).toMatchObject({ state: 'OFF', page: 1 }));
  });

  it("keeps the page when an opened source's runs are sorted: they are no part of the pager", async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee], { total: 120 }));
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [run(9, '2026-09-18T09:26:00Z', 247), run(10, '2026-09-18T10:26:00Z', 12)],
      page: 0,
      size: 20,
      totalElements: 2,
    });
    renderAt('/masi/sources?page=1', '/masi/sources', <MasiSources />);
    await userEvent.click(await screen.findByRole('button', { name: 'cv.ee' }));
    const runs = await screen.findByTestId('runs-cvee');
    await userEvent.click(within(runs).getByRole('button', { name: 'Parsed' }));
    expect(screen.getByText('page 2 of 3')).toBeInTheDocument();
    expect(lastAsked()).toMatchObject({ page: 1 });
    expect(api.fetchMasiSourceList).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing matches', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([], { counts: { ALL: 225 } }));
    renderAt('/masi/sources?q=nothing', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('No sources match.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search key or name' })).toHaveValue('nothing');
  });

  it('shows one source alone at /masi/sources/:id, opened, with the way back to every source', async () => {
    vi.mocked(api.fetchMasiSource).mockResolvedValue({ ...wise, running: true });
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [run(9, '2026-09-18T09:26:00Z', 247)],
      page: 0,
      size: 20,
      totalElements: 1,
    });
    vi.mocked(api.patchMasiSource).mockResolvedValue({ ...wise, enabled: false });
    renderAt('/masi/sources/8', '/masi/sources/:id', <MasiSourceDetail />);
    expect(await screen.findByTestId('runs-ats:wise')).toHaveTextContent('247');
    expect(api.fetchMasiSource).toHaveBeenCalledWith(8, expect.any(AbortSignal));
    expect(screen.getByRole('link', { name: 'all sources' })).toHaveAttribute(
      'href',
      '/masi/sources',
    );
    expect(screen.getByRole('heading', { name: 'Config' })).toBeInTheDocument();
    // the source alone: no list, no filters, no pager, no sorting
    expect(api.fetchMasiSourceList).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Show' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Health' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Health' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sources' })).toHaveClass('active');
    // its actions work here too: the source is read again after
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledWith(8, { enabled: false }));
    await waitFor(() => expect(api.fetchMasiSource).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('ats:wise: disabled')).toBeInTheDocument();
  });

  it('says why a source alone could not be read', async () => {
    vi.mocked(api.fetchMasiSource).mockRejectedValue(new Error('Not found'));
    vi.mocked(api.fetchMasiSourceRuns).mockRejectedValue(new Error('Not found'));
    renderAt('/masi/sources/99', '/masi/sources/:id', <MasiSourceDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  /** The site deploys before masi: the old masi answers every source as an array and has no counts. */
  it("pages and counts the old masi's whole list in the browser, as the new one would", async () => {
    vi.mocked(api.fetchMasiSourceList).mockImplementation(real.fetchMasiSourceList);
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith('/api/masi/sources/counts')
          ? new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
          : new Response(
              JSON.stringify([
                wise,
                cvee,
                bolt,
                { ...cvee, id: 9, key: 'cvkeskus', name: 'CV Keskus' },
              ]),
            ),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderAt('/masi/sources?state=ATTENTION&sort=health,desc', '/masi/sources', <MasiSources />);
    // the worst first: failing before degraded; the two off ones not listed
    await screen.findByText('Wise (Greenhouse)');
    expect(rowNames()).toEqual(['Wise (Greenhouse)', 'Bolt (Greenhouse)']);
    expect(screen.getByText('2 of 4 enabled · 2 shown')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'needs a look (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'off (2)' })).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/masi/sources?state=ATTENTION&sort=health%2Cdesc&page=0&size=50',
    );
  });
});
