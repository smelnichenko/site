import { describe, expect, it } from 'vitest';
import {
  formatEuros,
  formatEurosExact,
  employeeAxis,
  formatTick,
  latest,
  quarterRows,
  quarterTick,
  yearLabel,
  yearRows,
  yearTicks,
} from './figures';

const q = (year: number, quarter: number, rest: Record<string, number> = {}) => ({
  year,
  quarter,
  published: '2026-07-10',
  ...rest,
});

describe('quarterRows', () => {
  it('puts every quarter from the first to the last on the axis, in order, a missing one as a gap', () => {
    const rows = quarterRows([
      q(2026, 2, { employees: 5 }),
      q(2025, 3, { employees: 3 }),
      q(2026, 1, { employees: 4 }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(['2025 Q3', '2025 Q4', '2026 Q1', '2026 Q2']);
    expect(rows[1]).toEqual({
      label: '2025 Q4',
      turnover: null,
      employees: null,
      stateTaxes: null,
      labourTaxes: null,
      annualEmployees: null,
    });
    expect(rows.map((r) => r.employees)).toEqual([3, null, 4, 5]);
  });

  it('keeps a figure the board left empty as null, never zero, and a real zero as zero', () => {
    const [bank, idle] = quarterRows([
      q(2025, 1, { employees: 1443 }),
      q(2025, 2, { turnover: 0 }),
    ]);
    expect(bank.turnover).toBeNull();
    expect(idle.turnover).toBe(0);
  });

  it('is empty for no quarters', () => {
    expect(quarterRows([])).toEqual([]);
  });
});

describe('latest', () => {
  it('is the last quarter that carries the figure, not the last quarter', () => {
    const rows = quarterRows([
      q(2025, 4, { turnover: 400, employees: 4 }),
      q(2026, 1, { employees: 5 }),
    ]);
    expect(latest(rows, (r) => r.employees)).toEqual({ label: '2026 Q1', value: 5 });
    expect(latest(rows, (r) => r.turnover)).toEqual({ label: '2025 Q4', value: 400 });
    expect(latest(rows, (r) => r.stateTaxes)).toBeNull();
  });
});

describe('formatEuros', () => {
  it('is compact, keeps a negative, and dashes a figure not published', () => {
    expect(formatEuros(64_852_805)).toBe('64.9M €');
    expect(formatEuros(-23_032)).toBe('-23K €');
    expect(formatEuros(0)).toBe('0 €');
    expect(formatEuros(null)).toBe('—');
  });
});

describe('the x axis', () => {
  it("names each year's first quarter, as the year", () => {
    const rows = quarterRows([q(2024, 3), q(2026, 2)]);
    expect(yearTicks(rows)).toEqual(['2025 Q1', '2026 Q1']);
    expect(quarterTick('2025 Q1')).toBe('2025');
  });

  it('names every quarter when the span holds no first quarter', () => {
    const rows = quarterRows([q(2025, 2), q(2025, 4)]);
    expect(yearTicks(rows)).toEqual(['2025 Q2', '2025 Q3', '2025 Q4']);
    expect(quarterTick('2025 Q3')).toBe('2025 Q3');
  });
});

describe('the figures themselves', () => {
  it('are to the euro where a reader looks for them, and a tick keeps two places', () => {
    expect(formatEurosExact(28_966_602)).toBe('28,966,602 €');
    expect(formatEurosExact(-23_032)).toBe('-23,032 €');
    expect(formatEurosExact(undefined)).toBe('—');
    expect(formatTick(1_162_500)).toBe('1.16M');
  });
});

describe('employeeAxis', () => {
  it('reaches a little over the most, in even steps, whatever the size of the company', () => {
    expect(employeeAxis(403)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(employeeAxis(449)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(employeeAxis(3)).toEqual([0, 1, 2, 3, 4]);
    expect(employeeAxis(1)).toEqual([0, 1, 2]);
  });

  it('puts a company without employees on the baseline, not halfway up', () => {
    expect(employeeAxis(0)).toEqual([0, 1]);
  });
});

const fy = (year: number, periodEnd: string, rest: Record<string, number> = {}) => ({
  year,
  periodEnd,
  submitted: '2025-06-20',
  ...rest,
});

describe('the annual reports', () => {
  it("place a year's headcount at the quarter its financial year ends in, on the quarters' own axis", () => {
    const rows = quarterRows(
      [q(2025, 1, { employees: 40 })],
      [fy(2024, '2024-07-31', { avgEmployees: 38.5 })],
    );
    expect(rows.map((r) => r.label)).toEqual(['2024 Q3', '2024 Q4', '2025 Q1']);
    expect(rows.map((r) => r.annualEmployees)).toEqual([38.5, null, null]);
    expect(rows.map((r) => r.employees)).toEqual([null, null, 40]);
  });

  it('name a year by when it ends, not by the register label', () => {
    expect(yearLabel(fy(2024, '2024-12-31'))).toBe('2024');
    expect(yearLabel(fy(2023, '2024-07-31'))).toBe('Jul 2024');
  });

  it('are in the order their years end, a figure not reported a gap', () => {
    const rows = yearRows([
      fy(2025, '2025-12-31', { revenue: 3, profit: -1 }),
      fy(2024, '2024-07-31', { revenue: 2, avgEmployees: 4 }),
    ]);
    expect(rows).toEqual([
      { label: 'Jul 2024', revenue: 2, operatingProfit: null, profit: null, avgEmployees: 4 },
      { label: '2025', revenue: 3, operatingProfit: null, profit: -1, avgEmployees: null },
    ]);
    expect(latest(rows, (r) => r.profit)).toEqual({ label: '2025', value: -1 });
  });
});
