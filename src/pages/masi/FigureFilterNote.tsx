import { Fragment } from 'react';
import { SEPARATOR, windowEnds } from './figureLinks';

/**
 * What a list is narrowed to when a report figure led here - "closed 12 Oct 2026 – 18 Oct 2026 · on cvee" - and the
 * way back to the whole list. A named region, so it is found and read as the page's filter, not as a row. Each date of
 * the period stays on one line, and each "·" goes with the part before it.
 */
export default function FigureFilterNote({
  period,
  parts = [],
  onClear,
}: Readonly<{
  /** The figure's event in words and its window: "closed" and the report's period. */
  period?: { words: string; from: string; to: string };
  parts?: string[];
  onClear: () => void;
}>) {
  const ends = period ? windowEnds(period.from, period.to) : null;
  return (
    <section className="masi-figure-filter" aria-label="Report filter">
      <span>
        {period && ends && (
          <>
            {period.words} <span className="masi-nowrap">{ends[0]}</span>
            {'\u00a0– '}
            <span className="masi-nowrap">{ends[1]}</span>
          </>
        )}
        {parts.map((p, i) => (
          <Fragment key={p}>
            {(period || i > 0) && SEPARATOR}
            {p}
          </Fragment>
        ))}
      </span>
      <button type="button" className="status-badge" onClick={onClear}>
        clear the report filter
      </button>
    </section>
  );
}
