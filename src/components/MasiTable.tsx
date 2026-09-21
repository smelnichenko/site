import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A masi table that scrolls sideways inside its card instead of pushing the page wider than a phone. While it
 * overflows, the scroller is a labelled, focusable region, so a keyboard can reach what is off-screen; while the table
 * fits it is neither — a tab stop that scrolls nothing is only in the way.
 */
export default function MasiTable({
  label,
  className,
  testId,
  children,
}: Readonly<{ label: string; className?: string; testId?: string; children: ReactNode }>) {
  const scroller = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    // more than a pixel: widths are rounded, and a rounding difference is not something to scroll to
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (table.current) observer.observe(table.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={scroller}
      className="masi-table-scroll"
      data-testid="masi-table-scroll"
      role={overflows ? 'region' : undefined}
      aria-label={overflows ? label : undefined}
      // a scrollable region has to be focusable, or the columns off-screen cannot be reached from a keyboard
      tabIndex={overflows ? 0 : undefined}
    >
      <table
        ref={table}
        className={className ? `table ${className}` : 'table'}
        data-testid={testId}
      >
        {children}
      </table>
    </div>
  );
}
