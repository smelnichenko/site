import { describe, it, expect } from 'vitest';
import { endOfDayIn, mapsUrl } from './format';

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

describe('mapsUrl', () => {
  it("is Google Maps' documented search URL for the address, encoded as a query parameter", () => {
    expect(mapsUrl('Harju maakond, Tallinn, Narva mnt 5, 10117')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Harju%20maakond%2C%20Tallinn%2C%20Narva%20mnt%205%2C%2010117',
    );
    expect(mapsUrl('Tööstuse 5 & Co, Tallinn')).toBe(
      'https://www.google.com/maps/search/?api=1&query=T%C3%B6%C3%B6stuse%205%20%26%20Co%2C%20Tallinn',
    );
  });
});
