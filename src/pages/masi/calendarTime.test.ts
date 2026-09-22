import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clockOf,
  dayOf,
  fromLocalInput,
  instantOf,
  minuteOfDay,
  mondayOf,
  monthGrid,
  startOf,
  toLocalInput,
  weekOf,
} from './calendarTime';

describe('the calendar reads Tallinn wall clocks', () => {
  it('cuts days in Tallinn, not UTC', () => {
    // 22:30 UTC on the 21st is 01:30 on the 22nd in Tallinn (UTC+3 in summer)
    expect(dayOf('2026-09-21T22:30:00Z')).toBe('2026-09-22');
    expect(dayOf('2026-09-21T20:59:00Z')).toBe('2026-09-21');
    expect(startOf('2026-09-22')).toBe('2026-09-21T21:00:00.000Z');
  });

  it('keeps the offset right on both sides of the autumn change (2026-10-25, 04:00 EEST → 03:00 EET)', () => {
    expect(startOf('2026-10-25')).toBe('2026-10-24T21:00:00.000Z');
    expect(startOf('2026-10-26')).toBe('2026-10-25T22:00:00.000Z');
    // the day is 25 hours long
    expect(Date.parse(startOf('2026-10-26')) - Date.parse(startOf('2026-10-25'))).toBe(
      25 * 3600_000,
    );
    expect(instantOf({ year: 2026, month: 10, day: 25, hour: 12, minute: 0 })).toBe(
      '2026-10-25T10:00:00.000Z',
    );
  });

  it('keeps the offset right on the spring change (2026-03-29, 03:00 EET → 04:00 EEST): a 23-hour day', () => {
    expect(Date.parse(startOf('2026-03-30')) - Date.parse(startOf('2026-03-29'))).toBe(
      23 * 3600_000,
    );
    expect(instantOf({ year: 2026, month: 3, day: 29, hour: 12, minute: 0 })).toBe(
      '2026-03-29T09:00:00.000Z',
    );
  });

  /**
   * The offset is read twice, not once. A single pass reads the offset at the naive guess, which is the wrong side of
   * the change for any wall time within the offset of it: 02:30 on 29 March 2026 EXISTS (00:30 UTC), and one pass puts
   * it at 23:30 the night before — an hour early, on the previous day. The suite pins the three shapes the second pass
   * decides: a time that exists, a time that exists twice, and a time that does not exist at all.
   */
  it('reads the offset twice, so a wall time beside a clock change lands right', () => {
    // exists: 02:30 EET is 00:30 UTC. One pass answers 2026-03-28T23:30Z, which is 01:30 Tallinn.
    expect(instantOf({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 })).toBe(
      '2026-03-29T00:30:00.000Z',
    );
    // exists twice (the autumn repeat): the FIRST occurrence, 01:30 EEST, not the second at 01:30 EET
    expect(instantOf({ year: 2026, month: 10, day: 25, hour: 1, minute: 30 })).toBe(
      '2026-10-24T22:30:00.000Z',
    );
    // does not exist (the spring gap, 03:00–03:59): an hour later, as the doc comment says — never an hour earlier
    expect(clockOf(instantOf({ year: 2026, month: 3, day: 29, hour: 3, minute: 30 }))).toBe(
      '04:30',
    );
    // and the same through the form's own reader
    expect(fromLocalInput('2026-03-29T02:30')).toBe('2026-03-29T00:30:00.000Z');
  });

  /**
   * The zone argument is what is read, not the machine's. The suite pins TZ=Europe/Tallinn (src/test/setup.ts), so a
   * function that quietly used the system zone would agree with every Tallinn assertion above and be wrong on any
   * other machine: asking for a second zone is what separates the two.
   */
  it('reads the zone it is given, not the machine the test runs on', () => {
    expect(toLocalInput('2026-09-22T07:30:00Z', 'UTC')).toBe('2026-09-22T07:30');
    expect(clockOf('2026-09-22T07:30:00Z', 'UTC')).toBe('07:30');
    expect(minuteOfDay('2026-09-22T07:30:00Z', 'UTC')).toBe(7 * 60 + 30);
    expect(fromLocalInput('2026-09-22T10:30', 'UTC')).toBe('2026-09-22T10:30:00.000Z');
    expect(startOf('2026-09-22', 'UTC')).toBe('2026-09-22T00:00:00.000Z');
  });

  it('places an event on the hour grid and on the clock by Tallinn time', () => {
    expect(minuteOfDay('2026-09-22T07:30:00Z')).toBe(10 * 60 + 30);
    expect(clockOf('2026-09-22T07:30:00Z')).toBe('10:30');
    expect(clockOf('2026-12-01T07:30:00Z')).toBe('09:30');
  });

  it('round-trips a datetime-local value as Tallinn time, whatever the browser zone', () => {
    expect(toLocalInput('2026-09-22T07:30:00Z')).toBe('2026-09-22T10:30');
    expect(fromLocalInput('2026-09-22T10:30')).toBe('2026-09-22T07:30:00.000Z');
    expect(fromLocalInput('2026-12-01T09:30')).toBe('2026-12-01T07:30:00.000Z');
    expect(fromLocalInput('not a time')).toBeNull();
  });

  it('builds weeks from Monday and a six-week month grid', () => {
    expect(mondayOf('2026-09-22')).toBe('2026-09-21');
    expect(mondayOf('2026-09-27')).toBe('2026-09-21'); // Sunday belongs to the week before
    expect(weekOf('2026-09-22')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    const grid = monthGrid('2026-09-15');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-08-31'); // the Monday on or before 1 September
    expect(grid).toContain('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });
});
