import { describe, it, expect } from 'vitest';
import { formatAmount, formatRange, jobSalary } from './salary';

describe('formatAmount', () => {
  it('groups thousands and keeps cents only where there are some', () => {
    expect(formatAmount(110000)).toBe('110,000');
    expect(formatAmount(60.5)).toBe('60.50');
    expect(formatAmount(1234567.25)).toBe('1,234,567.25');
    expect(formatAmount(0)).toBe('0');
  });
});

describe('formatRange', () => {
  it('reads a range, one end of one, and a single figure', () => {
    expect(formatRange(3000, 4000)).toBe('3,000–4,000');
    expect(formatRange(3000, null)).toBe('from 3,000');
    expect(formatRange(null, 4000)).toBe('up to 4,000');
    expect(formatRange(3000, 3000)).toBe('3,000');
    expect(formatRange(null, null)).toBeNull();
    expect(formatRange(undefined, undefined)).toBeNull();
  });
});

describe('jobSalary', () => {
  const stated = {
    salaryMin: 50,
    salaryMax: 70,
    salaryCurrency: 'EUR',
    salaryPeriod: 'DAY' as const,
    salaryMonthlyEurFteMin: 1083,
    salaryMonthlyEurFteMax: 1517,
  };

  it('gives the figures in their own unit and the full-time month beside a day rate', () => {
    expect(jobSalary(stated)).toEqual({
      figures: '50–70 EUR / day',
      fullTime: '≈ 1,083–1,517 EUR / month full-time',
    });
  });

  it('gives no full-time line for a monthly figure, and none without a euro figure', () => {
    expect(jobSalary({ ...stated, salaryPeriod: 'MONTH' })?.fullTime).toBeNull();
    expect(
      jobSalary({ ...stated, salaryMonthlyEurFteMin: null, salaryMonthlyEurFteMax: null })
        ?.fullTime,
    ).toBeNull();
  });

  it('names what is missing of the unit, and a currency only where masi stated one', () => {
    expect(jobSalary({ ...stated, salaryCurrency: null })?.figures).toBe(
      '50–70 (currency not stated)',
    );
    expect(jobSalary({ ...stated, salaryPeriod: null })?.figures).toBe(
      '50–70 EUR (period not stated)',
    );
    expect(jobSalary({ ...stated, salaryCurrency: 'GBP', salaryPeriod: null })?.figures).toBe(
      '50–70 GBP (period not stated)',
    );
    expect(jobSalary({ ...stated, salaryCurrency: null, salaryPeriod: null })?.figures).toBe(
      '50–70 (unit not stated)',
    );
    for (const half of [{ salaryCurrency: null }, { salaryPeriod: null }]) {
      expect(jobSalary({ ...stated, ...half })?.fullTime).toBeNull();
    }
  });

  it('keeps the old figures in EUR when masi sends no unit field at all, and has nothing for no figure', () => {
    expect(jobSalary({ salaryMin: 3000, salaryMax: null })).toEqual({
      figures: '3000–? EUR',
      fullTime: null,
    });
    expect(jobSalary({ salaryMin: null, salaryMax: null })).toBeNull();
    expect(jobSalary({ ...stated, salaryMin: null, salaryMax: null })).toBeNull();
  });
});
