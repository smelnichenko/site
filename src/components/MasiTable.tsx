import type { ReactNode } from 'react';

/**
 * A masi table that scrolls sideways inside its card instead of pushing the page wider than a phone. The scroller is a
 * labelled, focusable region so a keyboard can reach what is off-screen.
 */
export default function MasiTable({
  label,
  className,
  testId,
  children,
}: Readonly<{ label: string; className?: string; testId?: string; children: ReactNode }>) {
  return (
    // a scrollable region has to be focusable, or the columns off-screen cannot be reached from a keyboard
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="masi-table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className={className ? `table ${className}` : 'table'} data-testid={testId}>
        {children}
      </table>
    </div>
  );
}
