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
