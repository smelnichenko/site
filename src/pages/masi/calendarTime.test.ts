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
