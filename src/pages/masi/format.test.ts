import { describe, it, expect } from 'vitest';
import { endOfDayIn } from './format';

describe('endOfDayIn', () => {
  it('is the last second of that day in Tallinn, in winter and in summer time', () => {
    expect(endOfDayIn('2026-10-31')).toBe('2026-10-31T21:59:59.000Z'); // EET, UTC+2
    expect(endOfDayIn('2026-07-01')).toBe('2026-07-01T20:59:59.000Z'); // EEST, UTC+3
  });

  it('follows the zone it is given, not the zone the browser is in', () => {
    expect(endOfDayIn('2026-07-01', 'UTC')).toBe('2026-07-01T23:59:59.000Z');
    expect(endOfDayIn('2026-07-01', 'America/New_York')).toBe('2026-07-02T03:59:59.000Z');
  });

  it('is null for what is not a date', () => {
    expect(endOfDayIn('')).toBeNull();
    expect(endOfDayIn('31.10.2026')).toBeNull();
  });
});
