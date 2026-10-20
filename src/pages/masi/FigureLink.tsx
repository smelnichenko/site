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
