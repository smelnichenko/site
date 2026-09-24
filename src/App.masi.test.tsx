import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthProvider';
import { LoadingProvider } from './contexts/LoadingProvider';
import * as oidcClient from './services/oidcClient';

vi.mock('./services/oidcClient', () => ({
  trySilentAuth: vi.fn(),
  handleCallback: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(false),
  refreshAndGetUserInfo: vi.fn(),
}));
vi.mock('./services/keyStore', () => ({ clear: vi.fn() }));
vi.mock('./services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/api')>()),
  fetchMasiJobs: vi.fn().mockResolvedValue({ content: [], page: 0, size: 50, totalElements: 0 }),
  fetchMasiReports: vi.fn().mockResolvedValue([]),
  fetchMasiStats: vi.fn().mockRejectedValue(new Error('no stats in this test')),
  fetchMasiPersons: vi.fn().mockResolvedValue({ content: [], page: 0, size: 50, totalElements: 0 }),
  fetchMasiPerson: vi.fn().mockResolvedValue({
    id: 5,
    name: 'Kadri Kask',
    email: null,
    phone: null,
    title: null,
    doNotContact: false,
    userNote: null,
    firstSeenAt: '2026-09-18T08:00:00Z',
    lastSeenAt: '2026-09-18T08:00:00Z',
    ties: [],
  }),
  fetchMasiActivity: vi
    .fn()
    .mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 }),
}));

const originalLocation = globalThis.location;
beforeAll(() => {
  Object.defineProperty(globalThis, 'location', {
    value: { ...originalLocation, href: originalLocation.href },
    writable: true,
    configurable: true,
  });
});
afterAll(() => {
  Object.defineProperty(globalThis, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({ ok: false, status: 200, json: () => Promise.resolve({}) }),
);

function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** The PR9 invariant: the masi pages exist for JOBS holders only, and the nav shows them only to those. */
describe('masi routes and nav', () => {
  it('renders /masi/jobs and the Jobs link for a JOBS holder', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'me@example.com',
      uuid: 'u1',
      permissions: ['JOBS'],
    });
    renderApp('/masi/jobs');
    expect(await screen.findByText('No jobs match.')).toBeInTheDocument();
    // the header's link (the tab bar has a "Jobs" tab too, pointing at /masi/jobs)
    expect(
      screen.getAllByRole('link', { name: 'Jobs' }).map((l) => l.getAttribute('href')),
    ).toContain('/masi');
  });

  it('renders /masi/reports with its tab for a JOBS holder', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'me@example.com',
      uuid: 'u1',
      permissions: ['JOBS'],
    });
    renderApp('/masi/reports');
    expect(await screen.findByText(/No reports yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveClass('active');
  });

  /**
   * The page has to be reachable, not merely correct: every assertion about the calendar elsewhere renders the
   * component directly, so a missing route or a missing tab would leave that whole file green with no way in.
   */
  it('renders /masi/calendar and its tab for a JOBS holder', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'me@example.com',
      uuid: 'u1',
      permissions: ['JOBS'],
    });
    renderApp('/masi/calendar');
    // the page itself, not only its tab: "New event" belongs to no other masi page
    expect(await screen.findByRole('button', { name: 'New event' })).toBeInTheDocument();
    const tab = screen.getByRole('link', { name: 'Calendar' });
    expect(tab).toHaveAttribute('href', '/masi/calendar');
    expect(tab).toHaveClass('active');
  });

  /** The people list is reachable, and a saved link to the contacts list it replaced lands on it. */
  it.each(['/masi/persons', '/masi/contacts'])(
    'renders the people list at %s with its tab',
    async (route) => {
      vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
        email: 'me@example.com',
        uuid: 'u1',
        permissions: ['JOBS'],
      });
      renderApp(route);
      expect(await screen.findByText('Nobody matches.')).toBeInTheDocument();
      const tab = screen.getByRole('link', { name: 'People' });
      expect(tab).toHaveAttribute('href', '/masi/persons');
      expect(tab).toHaveClass('active');
    },
  );

  it("renders a person's page at /masi/persons/:id", async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'me@example.com',
      uuid: 'u1',
      permissions: ['JOBS'],
    });
    renderApp('/masi/persons/5');
    expect(await screen.findByText('Kadri Kask', { selector: '.card-title' })).toBeInTheDocument();
  });

  it('redirects /masi/jobs away and hides the Jobs link without JOBS', async () => {
    vi.mocked(oidcClient.trySilentAuth).mockResolvedValueOnce({
      email: 'me@example.com',
      uuid: 'u1',
      permissions: ['METRICS'],
    });
    renderApp('/masi/jobs');
    await screen.findByRole('navigation');
    expect(screen.queryByText('No jobs match.')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: 'Jobs' })).toHaveLength(0);
  });
});
