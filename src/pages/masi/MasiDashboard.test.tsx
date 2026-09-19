import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MasiDashboard from './MasiDashboard';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({ fetchMasiDashboard: vi.fn() }));
const api = await import('../../services/api');

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
      packages: { NEW: 1, PREPARED: 4, APPLIED: 2, SKIPPED: 1, FAILED: 0, FAILED_GUARD: 1 },
      llm: {
        today: 0.25,
        dailyBudget: 1,
        month: 3.5,
        monthlyBudget: 20,
        enabled: false,
        monthByPurpose: { EXTRACT: 0.5, TUNE: 3, LETTER: 0, SCORE: 0, ENRICH: 0 },
        averagePackageCostMonth: 0.75,
      },
      cv: { activeVersion: 2, completeness: 86, gaps: ['role 1 has no metric'] },
      sources: [
        {
          id: 1,
          key: 'cvee',
          name: 'cv.ee',
          enabled: true,
          health: 'OK',
          lastRunAt: '2026-09-18T09:00:00Z',
          lastSuccessAt: '2026-09-18T09:00:00Z',
          running: false,
        },
        {
          id: 2,
          key: 'bolt',
          name: 'Bolt careers',
          enabled: false,
          health: 'DEGRADED',
          lastRunAt: null,
          lastSuccessAt: null,
          running: true,
        },
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
    expect(screen.getByText('cv.ee')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument(); // a running source shows running, not its health
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'CV master' })).not.toHaveClass('active');
  });

  it('shows the error when the overview cannot load', async () => {
    // rejected at call time, when the page's own catch is already attached (an eager rejection is an unhandled one)
    vi.mocked(api.fetchMasiDashboard).mockRejectedValue(new Error('Failed to load the dashboard'));
    renderAt('/masi', '/masi', <MasiDashboard />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the dashboard'),
    );
  });
});
