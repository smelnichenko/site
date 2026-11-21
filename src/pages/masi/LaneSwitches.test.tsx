import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MasiLane, MasiLanes } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiLanes: vi.fn(),
  patchMasiLanes: vi.fn(),
}));
const api = await import('../../services/api');
const { default: LaneSwitches } = await import('./LaneSwitches');
const { formatDateTime, laneStatus } = await import('./format');

const running: MasiLane = { on: true, deployed: true, set: null, pausedUntil: null, pause: null };
const off: MasiLane = { on: false, deployed: true, set: false, pausedUntil: null, pause: null };

/** The lanes as masi's /lanes answers: both running, the AI callable, unless given. */
function lanes(over: Partial<MasiLanes> = {}): MasiLanes {
  return { analysis: running, matching: running, aiReady: true, ...over };
}

const analysisBox = () => screen.getByRole('checkbox', { name: /Analysis lane/ });
const matchingBox = () => screen.getByRole('checkbox', { name: /Matching lane/ });
const status = (name: string) => screen.getByTestId(`lane-status-${name}`);

describe('LaneSwitches', () => {
  beforeEach(() => {
    vi.mocked(api.fetchMasiLanes).mockReset();
    vi.mocked(api.patchMasiLanes).mockReset();
  });

  it('shows each lane as masi reads it, its box not to be switched before it is read, nothing beside a running one', async () => {
    let answer: (l: MasiLanes) => void = () => {};
    vi.mocked(api.fetchMasiLanes).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    render(<LaneSwitches />);
    expect(analysisBox()).toBeDisabled();
    answer(lanes());
    expect(
      await screen.findByRole('checkbox', { name: /Analysis lane/, checked: true }),
    ).toBeEnabled();
    expect(matchingBox()).toBeChecked();
    // running and off are the box's: nothing beside it
    expect(screen.queryByTestId('lane-status-analysis')).toBeNull();
    expect(screen.queryByTestId('lane-status-matching')).toBeNull();
    // the deployment's values are not the operator's concern: never named
    expect(screen.queryByText(/deployment/)).toBeNull();
  });

  it('switches a lane off: masi is asked for that lane alone', async () => {
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(lanes());
    vi.mocked(api.patchMasiLanes).mockResolvedValue(lanes({ analysis: off }));
    render(<LaneSwitches />);
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Analysis lane/, checked: true }),
    );
    expect(api.patchMasiLanes).toHaveBeenCalledExactlyOnceWith({ analysis: false });
    expect(analysisBox()).not.toBeChecked();
    expect(matchingBox()).toBeChecked();
  });

  it('says beside its box why a switched-on lane does not run: a limit reached, the account refused, no AI key', async () => {
    const until = '2026-11-21T14:05:00Z';
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(
      lanes({
        analysis: { ...running, pausedUntil: until, pause: 'DAY_LIMIT' },
        matching: { ...running, pausedUntil: until, pause: 'NO_CREDIT' },
      }),
    );
    render(<LaneSwitches />);
    expect(await screen.findByTestId('lane-status-analysis')).toHaveTextContent(
      `daily limit reached until ${formatDateTime(until)}`,
    );
    expect(status('matching')).toHaveTextContent(
      `no credit on the account, trying again at ${formatDateTime(until)}`,
    );
    // the label is the box's own, the status beside it
    expect(matchingBox()).toHaveAccessibleName(/^Matching lane/);
  });

  it('says a switched-on lane does not run without an AI key', async () => {
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(lanes({ analysis: off, aiReady: false }));
    render(<LaneSwitches />);
    expect(await screen.findByTestId('lane-status-matching')).toHaveTextContent(
      'not running: no AI key',
    );
    expect(screen.queryByTestId('lane-status-analysis')).toBeNull();
  });

  it('says a failed load and a failed switch, the lane as it was', async () => {
    vi.mocked(api.fetchMasiLanes).mockRejectedValue(new Error('masi is down'));
    const { unmount } = render(<LaneSwitches />);
    expect(await screen.findByText('masi is down')).toBeInTheDocument();
    expect(analysisBox()).toBeDisabled();
    unmount();
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(lanes());
    vi.mocked(api.patchMasiLanes).mockRejectedValue(new Error('refused'));
    render(<LaneSwitches />);
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Matching lane/, checked: true }),
    );
    expect(await screen.findByText('refused')).toBeInTheDocument();
    expect(matchingBox()).toBeChecked();
  });

  it('words only what the box cannot say: no AI key, each pause by why and until when', () => {
    const until = '2026-11-22T00:00:00Z';
    const at = formatDateTime(until);
    const paused = (pause: MasiLane['pause']): MasiLane => ({
      ...running,
      pausedUntil: until,
      pause,
    });
    expect(laneStatus(undefined, true)).toBe('');
    expect(laneStatus(off, true)).toBe('');
    // switched off, its pause and the key are nobody's concern; switched on without a key, nothing runs
    expect(laneStatus({ ...off, pausedUntil: until, pause: 'NO_CREDIT' }, true)).toBe('');
    expect(laneStatus(off, false)).toBe('');
    expect(laneStatus(running, false)).toBe('not running: no AI key');
    expect(laneStatus(paused('DAY_LIMIT'), true)).toBe(`daily limit reached until ${at}`);
    expect(laneStatus(paused('MONTH_LIMIT'), true)).toBe(`monthly limit reached until ${at}`);
    expect(laneStatus(paused('SHARE_LIMIT'), true)).toBe(
      `its share of the daily limit reached until ${at}`,
    );
    expect(laneStatus(paused('NO_CREDIT'), true)).toBe(
      `no credit on the account, trying again at ${at}`,
    );
    expect(laneStatus(paused('KEY_REFUSED'), true)).toBe(
      `the API key was refused, trying again at ${at}`,
    );
    expect(laneStatus(paused('NOT_PERMITTED'), true)).toBe(
      `the API refused access, trying again at ${at}`,
    );
    expect(laneStatus(paused('OTHER'), true)).toBe(`paused until ${at}`);
    expect(laneStatus(paused(null), true)).toBe(`paused until ${at}`);
    expect(laneStatus(running, true)).toBe('');
  });
});
