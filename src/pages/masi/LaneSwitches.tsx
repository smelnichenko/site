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
    label: 'Analysis lane (ranks new postings)',
    short: 'Analysis lane',
  },
  {
    name: 'matching',
    label: 'Matching lane (matches postings to your CV)',
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
  /** A failure: a switch's own (shown in its row), or the lanes' read (no row's: shown under them all). */
  const [error, setError] = useState<{ lane: MasiLaneName | null; text: string } | null>(null);
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
          setError({ lane: null, text: errorMessage(e, 'Failed to load the AI lanes') });
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

  async function flip(name: MasiLaneName, on: boolean) {
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
      setError({ lane: name, text: errorMessage(e, 'the switch failed') });
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
        const failed = error?.lane === name ? error.text : null;
        const errorId = `${ids}-${name}-error`;
        return (
          <div className="masi-switch-row" key={name}>
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
                aria-describedby={
                  [failed && errorId, status && statusId].filter(Boolean).join(' ') || undefined
                }
                onChange={(e) => void flip(name, e.target.checked)}
              />
              {label}
            </label>
            {/* the switch's failure in its own row, before what the lane says of itself: the row names the lane, a
                screen reader is told it */}
            {failed && (
              <span className={noteClass('ERROR')} role="alert" id={errorId}>
                {/* the space outside the hidden name: inside, a screen reader ran the two together */}
                <span className="sr-only">{short}:</span> {failed}
              </span>
            )}
            {status && (
              <span className="muted" id={statusId} data-testid={`lane-status-${name}`}>
                {status}
              </span>
            )}
          </div>
        );
      })}
      {/* the lanes not read: no one switch's failure - under them all, above the hint, from their left edge */}
      {error?.lane === null && (
        <div>
          <span className={noteClass('ERROR')} role="alert">
            {error.text}
          </span>
        </div>
      )}
      <div className="lane-hint muted">
        Switched off, a lane stops before its next call; switched on, it starts within five minutes.
      </div>
      {/* an <output>: the status role and its polite live region by the element itself */}
      <output className="sr-only">{said}</output>
    </div>
  );
}
