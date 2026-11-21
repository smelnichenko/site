import { useEffect, useState } from 'react';
import {
  fetchMasiLanes,
  patchMasiLanes,
  type MasiLaneName,
  type MasiLanes,
} from '../../services/api';
import { errorMessage, laneStatus, noteClass } from './format';

/** The lanes the web UI switches, in the order shown, each with what it spends on. */
const LANES: ReadonlyArray<{ name: MasiLaneName; label: string }> = [
  {
    name: 'analysis',
    label: 'Analysis lane (reads new postings with the cheap model, to rank them)',
  },
  {
    name: 'matching',
    label: 'Matching lane (matches analysed postings against your CV with the AI)',
  },
];

/**
 * The AI lanes' switches: switched off here a lane starts no further call, on every pod; switched on, it starts at its
 * next tick - no restart. Until a lane is first switched here, masi runs it as its deployment says (not shown).
 */
export default function LaneSwitches() {
  const [lanes, setLanes] = useState<MasiLanes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLanes(await fetchMasiLanes(controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted) {
          setError(errorMessage(e, 'Failed to load the AI lanes'));
        }
      }
    })();
    return () => controller.abort();
  }, []);

  async function flip(name: MasiLaneName, on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setLanes(await patchMasiLanes({ [name]: on }));
    } catch (e: unknown) {
      setError(errorMessage(e, 'The switch failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lane-switches">
      {LANES.map(({ name, label }) => {
        const lane = lanes?.[name];
        const status = lanes ? laneStatus(lanes[name], lanes.aiReady) : '';
        return (
          <div className="assistant-switch" key={name}>
            <label>
              <input
                type="checkbox"
                // not read (yet, or it failed): no state to switch from - an unchecked box would say "off"
                disabled={!lane || busy}
                checked={lane?.on ?? false}
                onChange={(e) => void flip(name, e.target.checked)}
              />{' '}
              {label}
            </label>
            {status && (
              <span className="muted" data-testid={`lane-status-${name}`}>
                {status}
              </span>
            )}
          </div>
        );
      })}
      <div className="assistant-switch muted">
        Switched off, a lane stops before its next call; switched on, it starts within five minutes.
      </div>
      {error && <span className={noteClass('ERROR')}>{error}</span>}
    </div>
  );
}
