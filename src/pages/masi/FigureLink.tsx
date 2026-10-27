import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * A report figure: a link to the rows it counts. A bare number is named for what it counts ("3 closed jobs", which
 * starts with what is shown), so a screen reader hears more than "3"; a figure shown in words ("2 packages requested")
 * is named by them (no name given). Zero is plain text: a link to an empty list leads nowhere.
 */
export default function FigureLink({
  value,
  to,
  name,
  children,
}: Readonly<{ value: number; to: string | null; name?: string; children?: ReactNode }>) {
  const shown = children ?? value;
  if (value === 0 || to === null) return <>{shown}</>;
  return (
    <Link to={to} aria-label={name} className="masi-figure-link">
      {shown}
    </Link>
  );
}

/**
 * A figure and the text right after it - its "·", a closing bracket - kept on one line. A figure link is a box (a
 * finger target), and a browser breaks a line between a box and the text after it even at a no-break space; inside one
 * nowrap span it cannot, so the line breaks after the separator rather than starting a line with it. `after` carries no
 * space of its own: the caller's space after the span is where the line may break.
 */
export function Tied({ children, after }: Readonly<{ children: ReactNode; after: string }>) {
  return (
    <span className="masi-nowrap">
      {children}
      {after}
    </span>
  );
}
