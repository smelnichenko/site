import { useEffect, useId, useRef, useState } from 'react';
import {
  fetchMasiLanes,
  patchMasiLanes,
  type MasiLaneName,
  type MasiLanes,
} from '../../services/api';
import { errorMessage, laneStatus, noteClass } from './format';

/** The lanes the web UI switches, in the order shown: what each spends on, and its name in a failure. */
const LANES: ReadonlyArray<{ name: MasiLaneName; label: string; short: string }> = [
  {
    name: 'analysis',
    label: 'Analysis lane (reads new postings with the cheap model, to rank them)',
    short: 'Analysis lane',
  },
  {
    name: 'matching',
    label: 'Matching lane (matches analysed postings against your CV with the AI)',
    short: 'Matching lane',
  },
];

/** How often the lanes are read again while the page is open: a pause that starts, or passes, shows without a reload. */
export const LANES_REFRESH_MS = 30_000;

/**
 * The AI lanes' switches: switched off here a lane starts no further call, on every pod; switched on, it starts at its
 * next tick - no restart. Until a lane is first switched here, masi runs it as its deployment says (not shown).
 */
export default function LaneSwitches() {
  const [lanes, setLanes] = useState<MasiLanes | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What a screen reader is told after the operator's own switch: why the lane does not run, if it does not. */
  const [said, setSaid] = useState('');
  // a switch in flight: a second one is ignored, never the boxes disabled - a disabled box drops the keyboard's focus
  const busy = useRef(false);
  const ids = useId();

  useEffect(() => {
    const controller = new AbortController();
    const read = async (first: boolean) => {
      try {
        setLanes(await fetchMasiLanes(controller.signal));
      } catch (e: unknown) {
        // a later read that fails keeps what the page shows; a dropped one (a remount) says nothing
        if (first && !controller.signal.aborted) {
          setError(errorMessage(e, 'Failed to load the AI lanes'));
        }
      }
    };
    void read(true);
    const timer = setInterval(() => void read(false), LANES_REFRESH_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  async function flip(name: MasiLaneName, short: string, on: boolean) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const next = await patchMasiLanes({ [name]: on });
      setLanes(next);
      setSaid(laneStatus(next[name], next.aiReady));
    } catch (e: unknown) {
      setError(`${short}: ${errorMessage(e, 'the switch failed')}`);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="lane-switches">
      {LANES.map(({ name, label, short }) => {
        const lane = lanes?.[name];
        const status = lanes ? laneStatus(lanes[name], lanes.aiReady) : '';
        const statusId = `${ids}-${name}-status`;
        return (
          <div className="assistant-switch" key={name}>
            <label>
              <input
                type="checkbox"
                // not read (yet, or it failed): no state to switch from - shown neither on nor off
                ref={(box) => {
                  if (box) {
                    box.indeterminate = !lane;
                  }
                }}
                disabled={!lane}
                checked={lane?.on ?? false}
                aria-describedby={status ? statusId : undefined}
                onChange={(e) => void flip(name, short, e.target.checked)}
              />{' '}
              {label}
            </label>
            {status && (
              <span className="muted" id={statusId} data-testid={`lane-status-${name}`}>
                {status}
              </span>
            )}
          </div>
        );
      })}
      <div className="lane-hint muted">
        Switched off, a lane stops before its next call; switched on, it starts within five minutes.
      </div>
      <span className="sr-only" role="status">
        {said}
      </span>
      {error && (
        <div className="assistant-switch">
          <span className={noteClass('ERROR')} role="alert">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
