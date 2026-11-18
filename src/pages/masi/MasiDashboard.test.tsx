import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import MasiDashboard from './MasiDashboard';
import { looseSeparators, renderAt } from './testUtils';
import type { MasiDashboard as Dashboard, MasiSource } from '../../services/api';

vi.mock('../../services/api', () => ({ fetchMasiDashboard: vi.fn() }));
// the old masi's answer is read through the real call: no login behind it
vi.mock('../../services/oidcClient', () => ({
  getAccessToken: vi.fn(() => Promise.resolve('token')),
  login: vi.fn(),
}));
const api = await import('../../services/api');
const real = await vi.importActual<typeof import('../../services/api')>('../../services/api');

/** masi answering GET /dashboard with `body`, read by the real fetchMasiDashboard. */
function answering(body: unknown) {
  vi.mocked(api.fetchMasiDashboard).mockImplementation(real.fetchMasiDashboard);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(body))));
}

/** A source wanting a look, as masi lists it under sourcesAttention. */
function unwell(id: number, key: string, over: Partial<MasiSource>): MasiSource {
  return {
    id,
    key,
    name: key,
    kind: 'ATS',
    scope: 'JOBS',
    baseUrl: null,
    cron: '0 0 * * * *',
    nextRunAt: null,
    enabled: true,
    configJson: null,
    termsNote: null,
    health: 'DEGRADED',
    consecutiveFailures: 1,
    lastRunAt: '2026-09-18T09:00:00Z',
    lastSuccessAt: '2026-09-17T09:00:00Z',
    lastError: null,
    running: false,
    ...over,
  };
}

/** The rest of a dashboard: the tiles' figures, none of them about sources. */
const tiles = {
  openJobs: 1,
  newJobs7d: 0,
  closedJobs7d: 0,
  companiesHiring: 1,
  packages: {},
  llm: {
    today: 0,
    dailyBudget: 1,
    month: 0,
    monthlyBudget: 20,
    enabled: true,
    monthByPurpose: {},
    averagePackageCostMonth: null,
  },
  cv: { activeVersion: 2, completeness: 86, gaps: [] },
  tuningPausedUntil: null,
};

const counts = {
  ALL: 225,
  ENABLED: 200,
  RUNNING: 2,
  ATTENTION: 5,
  OK: 196,
  DEGRADED: 3,
  FAILING: 1,
  DISABLED_AUTO: 1,
  OFF: 24,
};

/** Where a link leads, as the router wrote it. */
function href(name: string): string | null {
  return screen.getByRole('link', { name }).getAttribute('href');
}

async function sourcesCard(data: Dashboard) {
  vi.mocked(api.fetchMasiDashboard).mockResolvedValue(data);
  renderAt('/masi', '/masi', <MasiDashboard />);
  return screen.findByRole('region', { name: 'Sources' });
}

beforeEach(() => {
  vi.mocked(api.fetchMasiDashboard).mockReset(); // a body, not an expression: a returned mock would run as the test's cleanup
});

describe('MasiDashboard', () => {
  it('shows the week, the funnel, the cost tile against its budgets, the CV and the sources', async () => {
    vi.mocked(api.fetchMasiDashboard).mockResolvedValue({
      openJobs: 254,
      newJobs7d: 12,
      closedJobs7d: 3,
      companiesHiring: 41,
      packages: { NEW: 1, PREPARED: 4, APPLIED: 2, SKIPPED: 1, FAILED: 1 },
      llm: {
        today: 0.25,
        dailyBudget: 1,
        month: 3.5,
        monthlyBudget: 20,
        enabled: false,
        monthByPurpose: { EXTRACT: 0.5, TUNE: 3, LETTER: 0, SCORE: 0, ENRICH: 0 },
        averagePackageCostMonth: 0.75,
      },
      cv: {
        activeVersion: 2,
        completeness: 86,
        gaps: ['role 1 has no metric'],
        actives: [
          { language: 'en', version: 2 },
          { language: 'et', version: 5 },
        ],
      },
      sourceCounts: counts,
      sourcesAttention: [
        unwell(2, 'ats:bolt', { name: 'Bolt careers', health: 'FAILING', running: true }),
      ],
      tuningPausedUntil: '2026-09-19T00:00:00Z',
    });
    renderAt('/masi', '/masi', <MasiDashboard />);
    expect(await screen.findByText('254')).toBeInTheDocument();
    expect(screen.getByText('+12 new, 3 closed this week')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2 applied · 1 skipped · 1 failed')).toBeInTheDocument();
    const cost = screen.getByTestId('cost-tile');
    expect(cost).toHaveTextContent('$0.25');
    expect(cost).toHaveTextContent('25 % of $1.00 · month $3.50 (18 % of $20.00)');
    expect(screen.getByTestId('cost-breakdown')).toHaveTextContent(
      'extract $0.50 · tune $3.00 · $0.75 per package',
    );
    expect(cost).toHaveTextContent('AI disabled');
    expect(cost).toHaveTextContent('tuning paused until');
    expect(screen.getByText('86 %')).toBeInTheDocument();
    expect(screen.getByText('CV master v2 completeness')).toBeInTheDocument();
    expect(screen.getByText('1 gap(s)')).toBeInTheDocument();
    expect(screen.getByTestId('cv-actives')).toHaveTextContent('active: en v2 · et v5');
    expect(screen.getByRole('link', { name: 'Bolt careers' })).toHaveAttribute(
      'href',
      '/masi/sources/2',
    );
    expect(screen.getByText('running')).toBeInTheDocument(); // a running one says so beside its state
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'CV master' })).not.toHaveClass('active');
  });

  it('names no per-language CVs while there is one active CV', async () => {
    vi.mocked(api.fetchMasiDashboard).mockResolvedValue({
      openJobs: 1,
      newJobs7d: 0,
      closedJobs7d: 0,
      companiesHiring: 1,
      packages: {},
      llm: {
        today: 0,
        dailyBudget: 1,
        month: 0,
        monthlyBudget: 20,
        enabled: true,
        monthByPurpose: {},
        averagePackageCostMonth: null,
      },
      cv: {
        activeVersion: 2,
        completeness: 86,
        gaps: [],
        actives: [{ language: 'en', version: 2 }],
      },
      sourceCounts: { ...counts, ATTENTION: 0 },
      sourcesAttention: [],
      tuningPausedUntil: null,
    });
    renderAt('/masi', '/masi', <MasiDashboard />);
    expect(await screen.findByText('CV master v2 completeness')).toBeInTheDocument();
    expect(screen.queryByTestId('cv-actives')).not.toBeInTheDocument();
  });

  it('shows the error when the overview cannot load', async () => {
    // rejected at call time, when the page's own catch is already attached (an eager rejection is an unhandled one)
    vi.mocked(api.fetchMasiDashboard).mockRejectedValue(new Error('Failed to load the dashboard'));
    renderAt('/masi', '/masi', <MasiDashboard />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the dashboard'),
    );
  });
  it('counts the sources, each count a link to the Sources page showing them, and lists the ones wanting a look', async () => {
    const card = await sourcesCard({
      ...tiles,
      sourceCounts: counts,
      sourcesAttention: [
        unwell(9, 'ats:wise', {
          name: 'Wise (Greenhouse)',
          health: 'DISABLED_AUTO',
          enabled: false,
          consecutiveFailures: 12,
          lastError: 'returned 404',
        }),
        unwell(3, 'cvkeskus', { name: 'CV Keskus', health: 'FAILING', consecutiveFailures: 4 }),
        unwell(4, 'ats:bolt', { name: 'Bolt (Greenhouse)', lastError: 'guard aborted 1 request' }),
      ],
    });
    expect(within(card).getByTestId('source-counts')).toHaveTextContent(
      '225 sources · 200 enabled · 2 running · 5 need a look',
    );
    expect(looseSeparators(within(card).getByTestId('source-counts').textContent)).toEqual([]);
    expect(href('225 sources')).toBe('/masi/sources');
    expect(href('200 enabled')).toBe('/masi/sources?state=ENABLED');
    expect(href('2 running')).toBe('/masi/sources?state=RUNNING');
    expect(href('5 need a look')).toBe('/masi/sources?state=ATTENTION&sort=health,desc');
    // the rows in masi's order, worst first; each source a link to it alone
    const table = within(card).getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('link').textContent)).toEqual([
      'Wise (Greenhouse)',
      'CV Keskus',
      'Bolt (Greenhouse)',
    ]);
    expect(href('Wise (Greenhouse)')).toBe('/masi/sources/9');
    expect(within(rows[0]).getByText('auto-disabled')).toHaveClass('status-badge', 'error');
    expect(within(rows[0]).getByRole('cell', { name: '12' })).toBeInTheDocument();
    expect(within(rows[0]).getByText('returned 404')).toHaveClass('masi-note-error');
    expect(within(rows[1]).getByText('failing')).toHaveClass('status-badge', 'error');
    expect(within(rows[2]).getByText('degraded')).toHaveClass('status-badge', 'action');
    expect(within(rows[2]).getByText('guard aborted 1 request')).toHaveClass('masi-note-warning');
    // five want a look, three are listed: the way to all of them
    expect(href('See all 5')).toBe('/masi/sources?state=ATTENTION&sort=health,desc');
  });

  it('offers no "see all" when every source wanting a look is listed, and no link for a count of none', async () => {
    const card = await sourcesCard({
      ...tiles,
      sourceCounts: { ...counts, RUNNING: 0, ATTENTION: 1 },
      sourcesAttention: [unwell(4, 'ats:bolt', {})],
    });
    expect(within(card).getByTestId('source-counts')).toHaveTextContent(
      '225 sources · 200 enabled · 0 running · 1 needs a look',
    );
    expect(within(card).queryByRole('link', { name: /running/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: /See all/ })).not.toBeInTheDocument();
  });

  it('says all enabled sources are well when none wants a look', async () => {
    const card = await sourcesCard({
      ...tiles,
      sourceCounts: { ...counts, ATTENTION: 0, DEGRADED: 0, FAILING: 0, DISABLED_AUTO: 0 },
      sourcesAttention: [],
    });
    expect(within(card).getByText('All enabled sources are well.')).toBeInTheDocument();
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByTestId('source-counts')).toHaveTextContent('0 need a look');
  });

  /** The site deploys before masi: the old masi's dashboard lists every source, and counts none. */
  it("makes the counts and the ones wanting a look of the old masi's every source", async () => {
    vi.unstubAllGlobals();
    const old = (id: number, key: string, enabled: boolean, health: string, running = false) => ({
      id,
      key,
      name: key,
      enabled,
      health,
      lastRunAt: null,
      lastSuccessAt: '2026-09-17T09:00:00Z',
      running,
    });
    answering({
      ...tiles,
      sources: [
        old(1, 'cvee', true, 'OK', true),
        old(2, 'ats:bolt', true, 'DEGRADED'),
        old(3, 'ats:wise', false, 'DISABLED_AUTO'),
        old(4, 'linkedin', false, 'OK'),
        old(5, 'cvkeskus', true, 'FAILING'),
        old(6, 'ats:pipedrive', true, 'DEGRADED'),
      ],
    });
    renderAt('/masi', '/masi', <MasiDashboard />);
    const card = await screen.findByRole('region', { name: 'Sources' });
    expect(within(card).getByTestId('source-counts')).toHaveTextContent(
      '6 sources · 4 enabled · 1 running · 4 need a look',
    );
    // worst first - switched off by its failures, failing, degraded - and the newest first among equals
    const rows = within(within(card).getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('link').textContent)).toEqual([
      'ats:wise',
      'cvkeskus',
      'ats:pipedrive',
      'ats:bolt',
    ]);
    // the old masi sent no failures and no error: a dash, not a zero nor "undefined"
    expect(within(rows[0]).getAllByRole('cell')[2]).toHaveTextContent(/^—$/);
    expect(rows[0]).not.toHaveTextContent('undefined');
    vi.unstubAllGlobals();
  });

  it('refuses a dashboard with no sources at all, rather than saying every source is well', async () => {
    answering({ ...tiles });
    renderAt('/masi', '/masi', <MasiDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The dashboard sent no sources: neither their counts nor a list of them',
    );
    expect(screen.queryByText('All enabled sources are well.')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
