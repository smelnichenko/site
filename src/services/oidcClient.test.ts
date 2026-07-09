import { describe, it, expect } from 'vitest';
import { parseState } from './oidcClient';

const encode = (value: unknown) => btoa(JSON.stringify(value));

describe('parseState', () => {
  it('returns the round-tripped returnTo path', () => {
    expect(parseState(encode({ returnTo: '/monitors' }))).toEqual({ returnTo: '/monitors' });
  });

  it('defaults to / when there is no state', () => {
    expect(parseState(null)).toEqual({ returnTo: '/' });
  });

  // The state param comes back through the browser's URL, so it is attacker-influenced. Each of
  // these decodes successfully — a cast would have handed the value straight to navigate().
  it.each([
    ['protocol-relative host', encode({ returnTo: '//evil.example' })],
    ['absolute URL', encode({ returnTo: 'https://evil.example' })],
    ['a non-string returnTo', encode({ returnTo: 42 })],
    ['a missing returnTo', encode({ other: '/x' })],
    ['a JSON array', encode(['/monitors'])],
    ['a JSON null', encode(null)],
    ['a relative path with no leading slash', encode({ returnTo: 'monitors' })],
    ['undecodable base64', '!!!not-base64!!!'],
    ['valid base64 that is not JSON', btoa('not json at all')],
  ])('falls back to / for %s', (_label, state) => {
    expect(parseState(state)).toEqual({ returnTo: '/' });
  });
});
