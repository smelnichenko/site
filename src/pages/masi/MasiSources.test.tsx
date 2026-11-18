import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import MasiSources from './MasiSources';
import MasiSourceDetail, { MasiSourceByKey } from './MasiSourceDetail';
import { renderAt } from './testUtils';
import type { MasiSource, MasiSourceCounts, Paged } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiSourceList: vi.fn(),
  fetchMasiSourcePage: vi.fn(),
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
const api = await import('../../services/api');

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

/**
 * Lets an answer the test held go - `release` - inside act, and waits for the page to have taken it up (the answer's
 * own continuation runs before the act's promise settles).
 */
async function letGo(release: () => void) {
  await act(() => {
    release();
    return Promise.resolve();
  });
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
  vi.mocked(api.fetchMasiSourcePage).mockReset();
  vi.mocked(api.fetchMasiSource).mockReset();
  vi.mocked(api.fetchMasiSourceRuns).mockReset();
  vi.mocked(api.patchMasiSource).mockReset();
  vi.mocked(api.runMasiSource).mockReset();
  vi.mocked(api.fetchMasiAssistant).mockResolvedValue({
    enabled: false,
    gmailReady: false,
    linkedinReady: false,
  });
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
    expect(await screen.findByText('0 of 1 enabled · 1 match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledWith(1, { enabled: true }));
    // an action reads the page and the counts again, with the same filter
    expect(await screen.findByText('1 of 1 enabled · 1 match')).toBeInTheDocument();
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
    expect(await screen.findByText('0 of 2 enabled · 2 match')).toBeInTheDocument();
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
    expect(await screen.findByText('200 of 225 enabled · 120 match')).toBeInTheDocument();
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
    await userEvent.type(screen.getByRole('searchbox', { name: 'Key or name' }), ' wise ');
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

  it("takes a page change to the list's top: the window there, the focus on the list", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee], { total: 120 }));
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    const list = screen.getByRole('region', { name: 'Source list' });
    expect(list).toHaveFocus();
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled.mock.contexts[0]).toBe(list);
    // a filter is used up there already: no jump
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'OFF');
    expect(scrolled).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView'); // jsdom has none: as it was
  });

  it('lists every source again as soon as the search box is emptied, the focus kept in it', async () => {
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee]));
    renderAt('/masi/sources?q=wise', '/masi/sources', <MasiSources />);
    const box = await screen.findByRole('searchbox', { name: 'Key or name' });
    expect(box).toHaveValue('wise');
    await userEvent.clear(box);
    await waitFor(() => expect(lastAsked()?.q).toBeUndefined());
    expect(box).toHaveFocus();
    await userEvent.type(box, 'bolt');
    // typed is not searched until asked
    expect(lastAsked()?.q).toBeUndefined();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(lastAsked()?.q).toBe('bolt'));
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
    expect(screen.getByRole('searchbox', { name: 'Key or name' })).toHaveValue('nothing');
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
    expect(screen.getByRole('link', { name: 'Sources' })).toHaveClass('active');
    // one record read down, not a row of a table: its health, failures and actions on a phone's first screen
    const record = screen.getAllByRole('term').map((t) => t.textContent);
    expect(record).toEqual(['Key', 'Kind', 'Health', 'Cron', 'Requests/day', 'Last success']);
    const health = screen.getAllByRole('definition')[2];
    expect(health).toHaveTextContent('running');
    expect(health).toHaveTextContent('5 failure(s) in a row');
    expect(screen.getByLabelText('Cron for ats:wise')).toHaveValue('0 17 * * * *');
    expect(screen.getByLabelText('Requests per day for ats:wise')).toBeInTheDocument();
    // its name is the page's title, no button: pressed, it closed the source and left the page empty
    expect(screen.getByText('Wise (Greenhouse)', { selector: '.card-title' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wise (Greenhouse)' })).not.toBeInTheDocument();
    // its actions work here too: the source is read again after
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(api.patchMasiSource).toHaveBeenCalledWith(8, { enabled: false }));
    await waitFor(() => expect(api.fetchMasiSource).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('ats:wise: disabled')).toBeInTheDocument();
  });

  it("keeps the assistant's failure beside its switch, through the list's loads and a filter change", async () => {
    vi.mocked(api.fetchMasiAssistant).mockRejectedValueOnce(new Error('assistant is unreachable'));
    vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([cvee]));
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    expect(await screen.findByText('assistant is unreachable')).toHaveClass('masi-note-error');
    await screen.findByText('cv.ee');
    // no state read: the switch says nothing, rather than "off"
    const toggle = screen.getByRole('checkbox', { name: /Assistant/ });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    // the list is not the assistant: its load is not an alert, and a new filter does not clear the assistant's
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'OFF');
    await waitFor(() => expect(lastAsked()?.state).toBe('OFF'));
    await waitFor(() => expect(api.fetchMasiSourceList).toHaveBeenCalledTimes(2));
    expect(screen.getByText('assistant is unreachable')).toBeInTheDocument();
  });

  it('shows the page of the filters in the URL after an action, never the one in view when it was pressed', async () => {
    // an action still at masi while the operator moves on: its reload must be of where they are now
    let finish: (s: MasiSource) => void = () => {};
    vi.mocked(api.patchMasiSource).mockReturnValue(
      new Promise<MasiSource>((resolve) => {
        finish = resolve;
      }),
    );
    vi.mocked(api.fetchMasiSourceList).mockImplementation((filter) =>
      Promise.resolve(filter.state === 'OFF' ? listed([wise]) : listed([cvee])),
    );
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'OFF');
    await screen.findByText('Wise (Greenhouse)');
    finish({ ...cvee, enabled: true });
    expect(await screen.findByText('cvee: enabled')).toBeInTheDocument();
    await waitFor(() => expect(api.fetchMasiSourceList).toHaveBeenCalledTimes(3));
    expect(lastAsked()?.state).toBe('OFF');
    expect(rowNames()).toEqual(['Wise (Greenhouse)']);
  });

  it("says an action done when masi did it, and a failed reload after it as the page's failure", async () => {
    vi.mocked(api.fetchMasiSourceList)
      .mockResolvedValueOnce(listed([cvee]))
      .mockRejectedValueOnce(new Error('masi is restarting'));
    vi.mocked(api.patchMasiSource).mockResolvedValue({ ...cvee, enabled: true });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('masi is restarting');
    expect(screen.getByText('cvee: enabled')).toBeInTheDocument();
    expect(screen.queryByText('The action failed')).not.toBeInTheDocument();
  });

  it('goes to the last page from a page past it: one asked for, or emptied by an action', async () => {
    vi.mocked(api.fetchMasiSourceList).mockImplementation((filter) =>
      Promise.resolve(
        filter.page < 3
          ? listed([cvee], { total: 120, page: filter.page })
          : listed([], { total: 120, page: filter.page }),
      ),
    );
    renderAt('/masi/sources?state=OFF&page=9', '/masi/sources', <MasiSources />);
    // the last page's rows, once its answer is in (the URL, and so the pager, move first)
    expect(await screen.findByText('cv.ee')).toBeInTheDocument();
    expect(screen.getByText('page 3 of 3')).toBeInTheDocument();
    expect(lastAsked()).toMatchObject({ state: 'OFF', page: 2 });
    expect(screen.queryByText('No sources match.')).not.toBeInTheDocument();
  });

  it("drops a read's answer that lands after the filters moved on: an older page never shows under a newer URL", async () => {
    let release: (answer: ReturnType<typeof listed>) => void = () => {};
    vi.mocked(api.fetchMasiSourceList).mockImplementation((filter) => {
      if (filter.state === 'ATTENTION') {
        // masi slow with this one: answered only when the test says
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(filter.state === 'OFF' ? listed([wise]) : listed([cvee]));
    });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await screen.findByText('cv.ee');
    const show = screen.getByRole('combobox', { name: 'Show' });
    await userEvent.selectOptions(show, 'ATTENTION');
    await userEvent.selectOptions(show, 'OFF');
    await screen.findByText('Wise (Greenhouse)');
    // the slow read lands last: it is of a filter left behind
    await letGo(() => release(listed([bolt])));
    expect(rowNames()).toEqual(['Wise (Greenhouse)']);
    expect(show).toHaveValue('OFF');
  });

  it("clears the page's failure once a later read works", async () => {
    vi.mocked(api.fetchMasiSourceList)
      .mockResolvedValueOnce(listed([cvee]))
      .mockRejectedValueOnce(new Error('masi is restarting'))
      .mockResolvedValue(listed([wise]));
    vi.mocked(api.patchMasiSource).mockResolvedValue({ ...cvee, enabled: true });
    renderAt('/masi/sources', '/masi/sources', <MasiSources />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('masi is restarting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'OFF');
    expect(await screen.findByText('Wise (Greenhouse)')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("reads a running source's runs every 15 seconds while the page is open, and never after it is left", async () => {
    // only the interval is faked: the page's reads and the queries' waits keep their own clocks
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      vi.mocked(api.fetchMasiSourceList).mockResolvedValue(listed([{ ...cvee, running: true }]));
      vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
      });
      const view = renderAt('/masi/sources', '/masi/sources', <MasiSources />);
      await screen.findByText('cv.ee');
      // once at once: a run that started while the page was closed is part way already
      expect(api.fetchMasiSourceRuns).toHaveBeenCalledTimes(1);
      await act(() => vi.advanceTimersByTimeAsync(14_999));
      expect(api.fetchMasiSourceRuns).toHaveBeenCalledTimes(1);
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(api.fetchMasiSourceRuns).toHaveBeenCalledTimes(2);
      view.unmount();
      await vi.advanceTimersByTimeAsync(45_000);
      expect(api.fetchMasiSourceRuns).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says why a source alone could not be read', async () => {
    vi.mocked(api.fetchMasiSource).mockRejectedValue(new Error('Not found'));
    vi.mocked(api.fetchMasiSourceRuns).mockRejectedValue(new Error('Not found'));
    renderAt('/masi/sources/99', '/masi/sources/:id', <MasiSourceDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  /** An id is plain digits from 1, as masi writes them: anything Number() would also read (1e3, 1.5) is no id. */
  it.each(['abc', '0', '-3', '1.5', '1e3', '012'])(
    'says %s is no source, asking masi nothing',
    (id) => {
      // a page that did ask would wait on masi, never fail on a missing answer
      vi.mocked(api.fetchMasiSource).mockReturnValue(new Promise(() => {}));
      vi.mocked(api.fetchMasiSourceRuns).mockReturnValue(new Promise(() => {}));
      renderAt(`/masi/sources/${id}`, '/masi/sources/:id', <MasiSourceDetail />);
      expect(screen.getByText('No such source')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'all sources' })).toHaveAttribute(
        'href',
        '/masi/sources',
      );
      // nothing to wait for: a page that asks masi asks as it mounts, inside render's act
      expect(api.fetchMasiSource).not.toHaveBeenCalled();
      expect(api.fetchMasiSourceRuns).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('reads a plain id as that source', async () => {
    vi.mocked(api.fetchMasiSource).mockResolvedValue(wise);
    vi.mocked(api.fetchMasiSourceRuns).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/sources/8', '/masi/sources/:id', <MasiSourceDetail />);
    expect(
      await screen.findByText('Wise (Greenhouse)', { selector: '.card-title' }),
    ).toBeInTheDocument();
    expect(api.fetchMasiSource).toHaveBeenCalledWith(8, expect.any(AbortSignal));
  });

  /** A report names its sources by key: its badge leads to that one source, never to a search listing others too. */
  describe('one source by its key', () => {
    function SourcePage() {
      const navigate = useNavigate();
      return (
        <div data-testid="source-page">
          {useParams().id}
          <button type="button" onClick={() => void navigate(-1)}>
            Back
          </button>
        </div>
      );
    }
    /** Another key, as a second badge pressed would ask while the first is still being found. */
    function Elsewhere() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => void navigate('/masi/sources/key/ats%3Awise')}>
          another key
        </button>
      );
    }
    function at(path: string, before: string[] = []) {
      render(
        <MemoryRouter initialEntries={[...before, path]} initialIndex={before.length}>
          <Elsewhere />
          <Routes>
            <Route path="/masi/sources/key/:key" element={<MasiSourceByKey />} />
            <Route path="/masi/sources/:id" element={<SourcePage />} />
            <Route path="/masi/reports/:id" element={<div data-testid="report-page" />} />
          </Routes>
        </MemoryRouter>,
      );
    }
    /** masi's answers to the key searches, each held until the test lets it go. */
    function held() {
      const pending = new Map<
        string,
        { ok: (page: Paged<MasiSource>) => void; fail: (e: Error) => void }
      >();
      vi.mocked(api.fetchMasiSourcePage).mockImplementation(
        (filter) =>
          new Promise((ok, fail) => {
            pending.set(filter.q ?? '', { ok, fail });
          }),
      );
      return pending;
    }
    /** masi's page of sources holding `rows`. */
    const paged = (rows: MasiSource[]) => listed(rows).page;
    const people = { ...cvee, id: 31, key: 'meetfrankpeople', name: 'MeetFrank people' };
    const jobs = { ...cvee, id: 30, key: 'meetfrank', name: 'MeetFrank (Estonia)' };

    it('opens the source whose key is exactly the one named, not another containing it', async () => {
      vi.mocked(api.fetchMasiSourcePage).mockResolvedValue(paged([people, jobs]));
      at('/masi/sources/key/meetfrank');
      expect(await screen.findByTestId('source-page')).toHaveTextContent('30');
      // as many rows as masi gives at most: the one key is among every key and name containing it
      expect(vi.mocked(api.fetchMasiSourcePage).mock.lastCall?.[0]).toEqual({
        q: 'meetfrank',
        page: 0,
        size: 200,
      });
    });

    it('takes the key search out of the history: Back from the source returns to the report', async () => {
      vi.mocked(api.fetchMasiSourcePage).mockResolvedValue(paged([jobs]));
      at('/masi/sources/key/meetfrank', ['/masi/reports/5']);
      expect(await screen.findByTestId('source-page')).toHaveTextContent('30');
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(await screen.findByTestId('report-page')).toBeInTheDocument();
      expect(screen.queryByTestId('source-page')).not.toBeInTheDocument();
    });

    it("never opens the first key's source once another key is asked for, however late its answer", async () => {
      const pending = held();
      at('/masi/sources/key/meetfrank');
      await waitFor(() => expect(pending.has('meetfrank')).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'another key' }));
      await waitFor(() => expect(pending.has('ats:wise')).toBe(true));
      await letGo(() => pending.get('meetfrank')?.ok(paged([jobs])));
      expect(screen.queryByTestId('source-page')).not.toBeInTheDocument();
      await letGo(() => pending.get('ats:wise')?.ok(paged([wise])));
      expect(await screen.findByTestId('source-page')).toHaveTextContent('8');
    });

    it("shows no failure of a search left behind: the first key's search failing late", async () => {
      const pending = held();
      at('/masi/sources/key/meetfrank');
      await waitFor(() => expect(pending.has('meetfrank')).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'another key' }));
      await waitFor(() => expect(pending.has('ats:wise')).toBe(true));
      await letGo(() => pending.get('meetfrank')?.fail(new Error('masi is restarting')));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await letGo(() => pending.get('ats:wise')?.ok(paged([wise])));
      expect(await screen.findByTestId('source-page')).toHaveTextContent('8');
    });

    it('finds a key with a colon in it', async () => {
      vi.mocked(api.fetchMasiSourcePage).mockResolvedValue(paged([wise]));
      at(`/masi/sources/key/${encodeURIComponent('ats:wise')}`);
      expect(await screen.findByTestId('source-page')).toHaveTextContent('8');
    });

    it('says no source has a key masi does not know', async () => {
      vi.mocked(api.fetchMasiSourcePage).mockResolvedValue(paged([people]));
      at('/masi/sources/key/meetfrank');
      expect(await screen.findByText('No source has the key "meetfrank".')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'all sources' })).toHaveAttribute(
        'href',
        '/masi/sources',
      );
      expect(screen.queryByTestId('source-page')).not.toBeInTheDocument();
    });

    it('asks masi for the page alone: the counts say nothing of one key, and their failure is no failure here', async () => {
      vi.mocked(api.fetchMasiSourcePage).mockResolvedValue(paged([jobs]));
      vi.mocked(api.fetchMasiSourceList).mockRejectedValue(new Error('counting failed'));
      at('/masi/sources/key/meetfrank');
      expect(await screen.findByTestId('source-page')).toHaveTextContent('30');
      expect(api.fetchMasiSourceList).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
