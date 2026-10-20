/**
 * What a list is narrowed to when a report figure led here - "closed 12 Oct 2026 – 18 Oct 2026 · on cvee" - and the
 * way back to the whole list. A named region, so it is found and read as the page's filter, not as a row.
 */
export default function FigureFilterNote({
  parts,
  onClear,
}: Readonly<{ parts: string[]; onClear: () => void }>) {
  return (
    <section className="masi-figure-filter" aria-label="Report filter">
      <span>{parts.join(' · ')}</span>
      <button type="button" className="status-badge" onClick={onClear}>
        clear the report filter
      </button>
    </section>
  );
}
