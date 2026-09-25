import { describe, expect, it } from 'vitest';
import {
  formatEuros,
  formatEurosExact,
  employeeAxis,
  employeeScale,
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
  it("hold a year's headcount across the four quarters of its financial year, on the board's own axis", () => {
    const board = [q(2024, 1, { employees: 40 }), q(2024, 4, { employees: 41 })];
    const rows = quarterRows(board, [fy(2024, '2024-07-31', { avgEmployees: 38.5 })]);
    // the year Aug 2023 – Jul 2024: 2023 Q3 to 2024 Q3; the axis stays the board's, 2024 Q1 to Q4
    expect(rows.map((r) => r.label)).toEqual(['2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4']);
    expect(rows.map((r) => r.annualEmployees)).toEqual([38.5, 38.5, 38.5, null]);
  });

  it("never stretch the board's axis: years before its quarters are the chart by year's", () => {
    const rows = quarterRows(
      [q(2025, 1, { turnover: 1 }), q(2025, 2, { turnover: 2 })],
      [fy(2019, '2019-12-31', { avgEmployees: 3 }), fy(2020, '2020-12-31', { avgEmployees: 4 })],
    );
    expect(rows.map((r) => r.label)).toEqual(['2025 Q1', '2025 Q2']);
    expect(rows.every((r) => r.annualEmployees === null)).toBe(true);
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

  it('hold a December year across exactly its four quarters, on an axis wider than it on both sides', () => {
    const board = [q(2022, 4, { employees: 9 }), q(2024, 2, { employees: 12 })];
    const rows = quarterRows(board, [fy(2023, '2023-12-31', { avgEmployees: 10 })]);
    expect(rows.map((r) => r.label)).toEqual([
      '2022 Q4',
      '2023 Q1',
      '2023 Q2',
      '2023 Q3',
      '2023 Q4',
      '2024 Q1',
      '2024 Q2',
    ]);
    expect(rows.map((r) => r.annualEmployees)).toEqual([null, 10, 10, 10, 10, null, null]);
  });

  it('hold a year from the quarter it began in when masi says: an 18-month year across six quarters', () => {
    const board = [q(2024, 1), q(2026, 1)];
    const rows = quarterRows(board, [
      { ...fy(2025, '2025-12-31', { avgEmployees: 22 }), periodStart: '2024-07-01' },
    ]);
    expect(rows.map((r) => r.annualEmployees)).toEqual([null, null, 22, 22, 22, 22, 22, 22, null]);
  });

  // 10015764 as published: a full 2024, then a year of four months (2025-01-30 – 2025-05-21) as it changed its year
  it('never let a short year take the quarters of the year before it', () => {
    const board = [q(2024, 1), q(2025, 2)];
    const years = [
      fy(2024, '2024-12-31', { avgEmployees: 10 }),
      fy(2025, '2025-05-21', { avgEmployees: 2 }),
    ];
    expect(quarterRows(board, years).map((r) => r.annualEmployees)).toEqual([10, 10, 10, 10, 2, 2]);
    const told = [years[0], { ...years[1], periodStart: '2025-01-30' }];
    expect(quarterRows(board, told).map((r) => r.annualEmployees)).toEqual([10, 10, 10, 10, 2, 2]);
  });
});

describe('employeeScale', () => {
  it('fits the annual average when it is above every quarterly count', () => {
    const rows = quarterRows(
      [q(2025, 1, { employees: 400 })],
      [fy(2025, '2025-12-31', { avgEmployees: 460 })],
    );
    // 460 people a year on average above 400 a quarter: the axis reaches 600, not the 500 the quarters alone would
    expect(employeeScale(rows)).toEqual([0, 200, 400, 600]);
  });
});
