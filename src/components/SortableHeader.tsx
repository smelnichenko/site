/** A masi list's sortable column header (ops plan 112); the sort itself is in ./sorting. */
interface Props {
  /** The column's name as the list's endpoint (or its browser sort) knows it. */
  column: string;
  label: string;
  /** The list's sort now: `column,asc|desc`. */
  sort: string;
  onSort: (next: string) => void;
  className?: string;
}

/**
 * A column header that sorts: a button filling the header (a finger's 44 px), its order said to screen readers by
 * `aria-sort` on the header and shown by ▲ or ▼.
 */
export function SortableHeader({ column, label, sort, onSort, className }: Readonly<Props>) {
  const ascending = sort === `${column},asc`;
  const descending = sort === `${column},desc`;
  let order: 'ascending' | 'descending' | 'none' = 'none';
  if (ascending) order = 'ascending';
  else if (descending) order = 'descending';
  let mark = '';
  if (ascending) mark = ' ▲';
  else if (descending) mark = ' ▼';
  return (
    <th aria-sort={order} className={className}>
      <button
        type="button"
        className="sortable-th"
        onClick={() => onSort(ascending ? `${column},desc` : `${column},asc`)}
      >
        {label}
        <span aria-hidden="true">{mark}</span>
      </button>
    </th>
  );
}
