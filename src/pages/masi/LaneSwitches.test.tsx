import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MasiLane, MasiLanes } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiLanes: vi.fn(),
  patchMasiLanes: vi.fn(),
}));
const api = await import('../../services/api');
const { default: LaneSwitches, LANES_REFRESH_MS } = await import('./LaneSwitches');
const { formatDateTime, laneStatus } = await import('./format');

const running: MasiLane = { on: true, deployed: true, set: null, pausedUntil: null, pause: null };
const off: MasiLane = { on: false, deployed: true, set: false, pausedUntil: null, pause: null };

/** The lanes as masi's /lanes answers: both running, the AI callable, unless given. */
function lanes(over: Partial<MasiLanes> = {}): MasiLanes {
  return { analysis: running, matching: running, aiReady: true, ...over };
}

// exact names: the status beside a box is its description, never part of its name
const ANALYSIS = 'Analysis lane (ranks new postings)';
const MATCHING = 'Matching lane (matches postings to your CV)';
const analysisBox = () => screen.getByRole('checkbox', { name: ANALYSIS });
const matchingBox = () => screen.getByRole('checkbox', { name: MATCHING });
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
    expect(await screen.findByRole('checkbox', { name: ANALYSIS, checked: true })).toBeEnabled();
    expect(matchingBox()).toBeChecked();
    // running and off are the box's: nothing beside it
    expect(screen.queryByTestId('lane-status-analysis')).toBeNull();
    expect(screen.queryByTestId('lane-status-matching')).toBeNull();
  });

  it('switches a lane off: masi is asked for that lane alone, a second switch ignored while it saves, the focus kept', async () => {
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(lanes());
    let saved: (l: MasiLanes) => void = () => {};
    vi.mocked(api.patchMasiLanes).mockReturnValue(new Promise((resolve) => (saved = resolve)));
    render(<LaneSwitches />);
    await userEvent.click(await screen.findByRole('checkbox', { name: ANALYSIS, checked: true }));
    // while masi saves it the boxes stay enabled (a disabled box drops the keyboard's focus) - a second switch is ignored
    expect(analysisBox()).toBeEnabled();
    expect(analysisBox()).toHaveFocus();
    await userEvent.click(matchingBox());
    expect(api.patchMasiLanes).toHaveBeenCalledTimes(1);
    saved(lanes({ analysis: off }));
    expect(await screen.findByRole('checkbox', { name: ANALYSIS, checked: false })).toBeEnabled();
    expect(matchingBox()).toBeEnabled();
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
    // the status is the box's description: a screen reader on the box hears it
    expect(
      screen.getByRole('checkbox', { name: MATCHING, description: /no credit on the account/ }),
    ).toBeInTheDocument();
    expect(analysisBox()).toHaveAccessibleDescription(/daily limit reached until/);
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
    expect(await screen.findByRole('alert')).toHaveTextContent('masi is down');
    // the lanes not read: no one switch's failure - no box described by it
    expect(analysisBox()).not.toHaveAccessibleDescription(/masi is down/);
    expect(matchingBox()).not.toHaveAccessibleDescription(/masi is down/);
    expect(analysisBox()).toBeDisabled();
    // a state never read is shown neither on nor off
    expect((analysisBox() as HTMLInputElement).indeterminate).toBe(true);
    unmount();
    // the matching lane switched on, out of credit: something said beside it for the failure to stand before
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(
      lanes({
        matching: { ...running, pausedUntil: '2026-11-22T00:00:00Z', pause: 'NO_CREDIT' },
      }),
    );
    vi.mocked(api.patchMasiLanes).mockRejectedValue(new Error('refused'));
    render(<LaneSwitches />);
    await userEvent.click(await screen.findByRole('checkbox', { name: MATCHING, checked: true }));
    // the failure is its own lane's - named for a screen reader, as an alert - and describes its box before what the
    // lane says of itself (where it stands in the row: the layout harness)
    expect(await screen.findByRole('alert')).toHaveTextContent('Matching lane: refused');
    expect(matchingBox()).toHaveAccessibleDescription(
      /^Matching lane: refused no credit on the account/,
    );
    expect(analysisBox()).not.toHaveAccessibleDescription(/refused/);
    expect(matchingBox()).toBeChecked();
    // the next switch that saves clears it: no stale refusal beside a box that works
    vi.mocked(api.patchMasiLanes).mockResolvedValueOnce(lanes({ matching: off }));
    await userEvent.click(matchingBox());
    expect(
      await screen.findByRole('checkbox', { name: MATCHING, checked: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/refused/)).toBeNull();
  });

  it("tells a screen reader why a lane it switched on does not run - the operator's own switch, only", async () => {
    const until = '2026-11-22T00:00:00Z';
    vi.mocked(api.fetchMasiLanes).mockResolvedValue(
      lanes({ analysis: off, matching: { ...running, pausedUntil: until, pause: 'NO_CREDIT' } }),
    );
    vi.mocked(api.patchMasiLanes).mockResolvedValue(
      lanes({
        analysis: { ...running, pausedUntil: until, pause: 'DAY_LIMIT' },
        matching: { ...running, pausedUntil: until, pause: 'NO_CREDIT' },
      }),
    );
    render(<LaneSwitches />);
    await screen.findByTestId('lane-status-matching');
    // the page's own load is not announced
    expect(screen.getByRole('status')).toHaveTextContent('');
    await userEvent.click(analysisBox());
    expect(await screen.findByRole('status')).toHaveTextContent(
      `daily limit reached until ${formatDateTime(until)}`,
    );
  });

  it('reads the lanes again while the page is open: a pause that starts shows without a reload', async () => {
    vi.useFakeTimers();
    try {
      const until = '2026-11-22T00:00:00Z';
      vi.mocked(api.fetchMasiLanes)
        .mockResolvedValueOnce(lanes())
        .mockResolvedValueOnce(
          lanes({ matching: { ...running, pausedUntil: until, pause: 'NO_CREDIT' } }),
        );
      render(<LaneSwitches />);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(screen.queryByTestId('lane-status-matching')).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(LANES_REFRESH_MS));
      expect(api.fetchMasiLanes).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('lane-status-matching')).toHaveTextContent(
        /no credit on the account/,
      );
      // a read in the background is not announced
      expect(screen.getByRole('status')).toHaveTextContent('');
      // a read in the background that fails keeps what is shown, unsaid
      vi.mocked(api.fetchMasiLanes).mockRejectedValueOnce(new Error('masi blinked'));
      await act(() => vi.advanceTimersByTimeAsync(LANES_REFRESH_MS));
      expect(api.fetchMasiLanes).toHaveBeenCalledTimes(3);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByTestId('lane-status-matching')).toHaveTextContent(
        /no credit on the account/,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing of a load a remount aborted (React StrictMode in dev): no error for a request it dropped', async () => {
    vi.mocked(api.fetchMasiLanes).mockImplementation(
      (signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error('aborted'));
            return;
          }
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
          setTimeout(() => resolve(lanes()), 0);
        }),
    );
    render(
      <StrictMode>
        <LaneSwitches />
      </StrictMode>,
    );
    expect(await screen.findByRole('checkbox', { name: ANALYSIS, checked: true })).toBeEnabled();
    expect(screen.queryByText('aborted')).toBeNull();
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
    // a stale pause never hides the real cause: without a key, nothing runs whatever paused it
    expect(laneStatus(paused('DAY_LIMIT'), false)).toBe('not running: no AI key');
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
