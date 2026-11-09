import { useSearchParams } from 'react-router-dom';

/**
 * How every masi list sorts (ops plan 112): the sort lives in the URL as `sort=column,asc|desc`, so it survives a
 * reload and a shared link; a new sort starts again at page 1. A header press sorts by that column ascending, the next
 * press descending. A page with a second sortable table names its own parameter.
 */
export function useUrlSort(
  fallback: string,
  param = 'sort',
): { sort: string; setSort: (next: string) => void } {
  const [params, setParams] = useSearchParams();
  const sort = params.get(param) || fallback;
  function setSort(next: string) {
    const changed = new URLSearchParams(params);
    changed.set(param, next);
    changed.delete('page');
    setParams(changed);
  }
  return { sort, setSort };
}

/** A value a list sorts by: text, a number, a date as ISO text or a boolean; null or '' is empty. */
export type SortValue = string | number | boolean | null | undefined;

/**
 * A list the page holds whole, sorted in the browser the way the server sorts the paged ones: by the column's value
 * (text A to Z whatever its case), empty values last whichever way, ties by id the same way.
 */
export function sortRows<T extends { id: number }>(
  rows: readonly T[],
  sort: string,
  columns: Record<string, (row: T) => SortValue>,
): T[] {
  const [column, direction] = sort.split(',');
  const value = columns[column];
  if (!value) return [...rows];
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const aEmpty = va === null || va === undefined || va === '';
    const bEmpty = vb === null || vb === undefined || vb === '';
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    const byValue = aEmpty || bEmpty ? 0 : compare(va, vb);
    // equal values (or two empty ones, or "a" and "A") fall to the id, so the order never depends on the input's
    return sign * (byValue === 0 ? a.id - b.id : byValue);
  });
}

/** A value that is there: text, a number or a boolean. */
type Present = string | number | boolean;

function compare(a: Present, b: Present): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  }
  return Number(a) - Number(b);
}
