import { useEffect, useState } from 'react';
import { fetchMasiSourceHistory, fetchMasiSwitches } from '../../services/api';
import type { MasiSourceChange } from '../../services/api';
import { errorMessage, formatDateTime } from './format';
import { readable } from './pictureRate';

/**
 * Nothing about a source is invisible (ops plan 110 PR 4; the operator, 2026-11-08: "what kind of invisible configs we
 * have else?"): its whole config as masi holds it (a secret masked), and every change of its config, switch or schedule
 * with who made it - a migration, the operator, or masi itself.
 */
export function SourceConfig({
  id,
  configJson,
}: Readonly<{ id: number; configJson: string | null }>) {
  const [changes, setChanges] = useState<MasiSourceChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMasiSourceHistory(id, controller.signal)
      .then(setChanges)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the changes'));
      });
    return () => controller.abort();
  }, [id]);
  return (
    <div className="masi-source-config">
      <h3 className="masi-subtitle">Config</h3>
      {configJson ? (
        <pre className="masi-config" data-testid={`config-${id}`}>
          {pretty(configJson)}
        </pre>
      ) : (
        <div className="muted">No config: the collector's defaults.</div>
      )}
      <h3 className="masi-subtitle">Changes</h3>
      {error && <div className="error">{error}</div>}
      {!changes && !error && <div className="loading">Loading changes...</div>}
      {changes?.length === 0 && <div className="empty-state">No change recorded.</div>}
      {changes && changes.length > 0 && (
        <ul className="masi-changes" aria-label="Changes">
          {changes.map((c) => (
            // a change is one field at one instant (masi stamps it to the microsecond)
            <li key={`${c.changedAt}|${c.field}`}>
              <span className="muted">{formatDateTime(c.changedAt)}</span>{' '}
              <strong>{FIELD[c.field] ?? c.field}</strong> by {c.changedBy}
              {c.field === 'config' || c.field === 'created' ? (
                <details>
                  <summary>{c.field === 'created' ? 'what it started with' : 'the config before and after'}</summary>
                  {c.oldValue !== null && <pre className="masi-config">{pretty(c.oldValue)}</pre>}
                  <pre className="masi-config">{pretty(c.newValue)}</pre>
                </details>
              ) : (
                <span>
                  : {c.oldValue ?? '—'} → {c.newValue ?? '—'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A field as the page says it. */
const FIELD: Record<string, string> = {
  created: 'created',
  config: 'config',
  enabled: 'enabled',
  cron: 'schedule',
};

/** JSON indented to read; anything else as it came. */
function pretty(json: string | null): string {
  if (json === null) return '';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/** A switch's value in words: on or off, a duration readably, a list joined, a number as it is. */
function shown(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'string' && /^P/.test(value)) return readable(value);
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'none';
  return String(value);
}

/** A switch's name as the page says it: camelCase into words. */
function words(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/**
 * The deployment's own switches - what no source row holds and the chart sets - as the running masi has them: read-only
 * here, changed in the chart's values.
 */
export function DeploymentSwitches() {
  const [switches, setSwitches] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMasiSwitches(controller.signal)
      .then(setSwitches)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the switches'));
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="card masi-switches" aria-label="Deployment switches">
      <div className="card-title">Deployment switches</div>
      <div className="muted">Set in the chart, as the running masi has them.</div>
      {error && <div className="error">{error}</div>}
      {switches && (
        <div className="masi-switch-groups">
          {Object.entries(switches).map(([group, value]) => (
            <dl key={group} className="masi-switch-group">
              <dt className="masi-switch-group-name">{words(group)}</dt>
              {value !== null && typeof value === 'object' && !Array.isArray(value) ? (
                Object.entries(value as Record<string, unknown>).map(([name, v]) => (
                  <dd key={name}>
                    {words(name)}: <strong>{shown(v)}</strong>
                  </dd>
                ))
              ) : (
                <dd>
                  <strong>{shown(value)}</strong>
                </dd>
              )}
            </dl>
          ))}
        </div>
      )}
    </section>
  );
}
