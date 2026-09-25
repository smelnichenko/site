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

/**
 * The quarters the x axis names: each year's first — the same on every chart, so a spike in one is read against the
 * same label in the next — or every quarter when the span holds no first quarter.
 */
export function yearTicks(rows: QuarterRow[]): string[] {
  const firsts = rows.filter((r) => r.label.endsWith(' Q1')).map((r) => r.label);
  return firsts.length > 0 ? firsts : rows.map((r) => r.label);
}

/** A tick on the x axis: a year's first quarter reads as the year. */
export function quarterTick(label: string): string {
  return label.endsWith(' Q1') ? label.slice(0, 4) : label;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Euros as the page shows them: `64.9M €`, `-23K €`; a dash for a figure not published. */
export function formatEuros(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${compact.format(v)} €`;
}

const tick = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/**
 * An axis tick: a compact number without the unit the chart's caption already names — to two places, so a gridline
 * at 1.16M is not labelled 1.2M.
 */
export function formatTick(v: number): string {
  return tick.format(v);
}

const exact = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** Euros to the euro, where a reader looks for the figure itself: a tooltip, the screen reader's table. */
export function formatEurosExact(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${exact.format(v)} €`;
}
