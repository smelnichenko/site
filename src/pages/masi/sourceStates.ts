import type { MasiSourceState } from '../../services/api';

/** The Sources page's "Show" choices after "all", in the select's order: the groups, then each state. */
export const SHOWS: readonly MasiSourceState[] = [
  'ATTENTION',
  'RUNNING',
  'ENABLED',
  'OK',
  'DEGRADED',
  'FAILING',
  'DISABLED_AUTO',
  'OFF',
];

/** What the "Show" select calls each choice. */
export const SHOW_WORDS: Record<MasiSourceState, string> = {
  ATTENTION: 'needs a look',
  RUNNING: 'running',
  ENABLED: 'enabled',
  OK: 'well',
  DEGRADED: 'degraded',
  FAILING: 'failing',
  DISABLED_AUTO: 'auto-disabled',
  OFF: 'off',
};

/** The "Show" a URL's `state` names, or undefined for none or one masi does not know (it would answer 400). */
export function showOf(value: string | null): MasiSourceState | undefined {
  return SHOWS.find((s) => s === value);
}

/** The Sources page listing one "Show"; the ones wanting a look worst first, as the dashboard lists their first rows. */
export function sourcesLink(show?: MasiSourceState): string {
  if (!show) return '/masi/sources';
  return show === 'ATTENTION'
    ? '/masi/sources?state=ATTENTION&sort=health,desc'
    : `/masi/sources?state=${show}`;
}

/**
 * One source's state as words (masi SourceState): switched off by its failures ("auto-disabled"), by hand ("off"), or
 * its health; a report names it by the state itself.
 */
export function stateWords(state: string): string {
  return state in SHOW_WORDS ? SHOW_WORDS[state as MasiSourceState] : state.toLowerCase();
}

/** One source's state (masi SourceState): its failures switched it off, the operator did, or its health. */
export function sourceState(s: { enabled: boolean; health: string }): string {
  if (s.health === 'DISABLED_AUTO') return 'DISABLED_AUTO';
  if (!s.enabled) return 'OFF';
  return s.health;
}
