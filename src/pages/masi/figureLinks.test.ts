import { describe, it, expect } from 'vitest';
import { figureParams, JOB_EVENTS, windowLabel } from './figureLinks';

describe('windowLabel', () => {
  it("names a period of whole masi days by its days, the last one before the exclusive end - in masi's zone", () => {
    // the DST week: Monday 00:00 is 22:00Z the day before, the next Monday 00:00 is 21:00Z
    expect(windowLabel('2026-03-22T22:00:00Z', '2026-03-29T21:00:00Z')).toBe(
      '23 Mar 2026 – 29 Mar 2026',
    );
    // one day
    expect(windowLabel('2026-10-11T21:00:00Z', '2026-10-12T21:00:00Z')).toBe(
      '12 Oct 2026 – 12 Oct 2026',
    );
  });

  it('shows both instants of a window that is not whole days, the end as it is (exclusive)', () => {
    expect(windowLabel('2026-03-23T08:00:00Z', '2026-03-23T12:00:00Z')).toBe(
      '23 Mar 2026, 10:00 – 23 Mar 2026, 14:00',
    );
    // UTC midnights are not Tallinn ones
    expect(windowLabel('2026-03-23T00:00:00Z', '2026-03-30T00:00:00Z')).toBe(
      '23 Mar 2026, 02:00 – 30 Mar 2026, 03:00',
    );
  });
});

describe('figureParams', () => {
  it('reads an event with both ends, and nothing of a part', () => {
    const p = (q: string) => figureParams(new URLSearchParams(q), JOB_EVENTS);
    expect(p('event=CLOSED&from=a&to=b')).toEqual({ event: 'CLOSED', from: 'a', to: 'b' });
    expect(p('event=CLOSED&from=a')).toBeNull();
    expect(p('from=a&to=b')).toBeNull();
    expect(p('event=APPLIED&from=a&to=b')).toBeNull();
  });
});
