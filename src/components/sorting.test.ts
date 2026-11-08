import { describe, it, expect } from 'vitest';
import { sortRows, type SortValue } from './sorting';

interface Row {
  id: number;
  name: string | null;
  count: number | null;
}

const rows: Row[] = [
  { id: 3, name: 'beta', count: 10 },
  { id: 1, name: null, count: 2 },
  { id: 5, name: 'alpha', count: null },
  { id: 2, name: 'Alpha', count: 9 },
  { id: 4, name: '', count: 10 },
];
const columns: Record<string, (r: Row) => SortValue> = {
  name: (r) => r.name,
  count: (r) => r.count,
};
const ids = (sort: string) => sortRows(rows, sort, columns).map((r) => r.id);

describe('sortRows: a list held whole sorts as masi sorts a paged one (ops plan 112)', () => {
  it('text A to Z whatever its case ("Alpha" and "alpha" tie, by id), empty ones last', () => {
    expect(ids('name,asc')).toEqual([2, 5, 3, 1, 4]);
  });

  it('descending turns the values and their ties round, and the empty ones are still last', () => {
    expect(ids('name,desc')).toEqual([3, 5, 2, 4, 1]);
  });

  it('numbers by their value, not their text (10 after 9), ties by id the way the list sorts', () => {
    expect(ids('count,asc')).toEqual([1, 2, 3, 4, 5]);
    expect(ids('count,desc')).toEqual([4, 3, 2, 1, 5]);
  });

  it('a column the list does not know leaves the order as it came, and the input is never changed', () => {
    const before = rows.map((r) => r.id);
    expect(ids('salary,asc')).toEqual(before);
    sortRows(rows, 'name,asc', columns);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
