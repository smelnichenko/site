/** A company's quarterly figures shaped for the charts: one row per quarter on a continuous axis. */
import { MasiQuarterFigures } from '../../services/api';

export type Figure = 'turnover' | 'employees' | 'stateTaxes' | 'labourTaxes';

export interface QuarterRow {
  label: string;
  turnover: number | null;
  employees: number | null;
  stateTaxes: number | null;
  labourTaxes: number | null;
}

const index = (q: { year: number; quarter: number }) => q.year * 4 + q.quarter - 1;

/**
 * Every quarter from the first to the last the board published, in order. A quarter it has no row for stays on the
 * axis as a gap — skipping it would draw two quarters a year apart side by side — and a figure it left empty is null,
 * never zero: a bank reports no turnover.
 */
export function quarterRows(quarters: MasiQuarterFigures[]): QuarterRow[] {
  if (quarters.length === 0) return [];
  const byIndex = new Map(quarters.map((q) => [index(q), q]));
  const indices = [...byIndex.keys()];
  const first = Math.min(...indices);
  const last = Math.max(...indices);
  const rows: QuarterRow[] = [];
  for (let i = first; i <= last; i++) {
    const q = byIndex.get(i);
    rows.push({
      label: `${Math.floor(i / 4)} Q${(i % 4) + 1}`,
      turnover: q?.turnover ?? null,
      employees: q?.employees ?? null,
      stateTaxes: q?.stateTaxes ?? null,
      labourTaxes: q?.labourTaxes ?? null,
    });
  }
  return rows;
}

/** The last quarter that carries the figure, and its value; null when no quarter does. */
export function latest(
  rows: QuarterRow[],
  figure: Figure,
): { label: string; value: number } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const value = rows[i][figure];
    if (value !== null) return { label: rows[i].label, value };
  }
  return null;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Euros as the page shows them: `64.9M €`, `-23K €`; a dash for a figure not published. */
export function formatEuros(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${compact.format(v)} €`;
}

/** An axis tick: the same compact number, without the unit the chart's caption already names. */
export function formatTick(v: number): string {
  return compact.format(v);
}
