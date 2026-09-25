import { describe, expect, it } from 'vitest';
import { formatEuros, latest, quarterRows } from './figures';

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
    expect(latest(rows, 'employees')).toEqual({ label: '2026 Q1', value: 5 });
    expect(latest(rows, 'turnover')).toEqual({ label: '2025 Q4', value: 400 });
    expect(latest(rows, 'stateTaxes')).toBeNull();
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
