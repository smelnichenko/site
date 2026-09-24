import type { ReactNode } from 'react';
import { MasiPackageLanguage } from '../../services/api';

const CHOICES: { value: MasiPackageLanguage; label: string }[] = [
  { value: 'auto', label: 'Language of the posting' },
  { value: 'en', label: 'English' },
  { value: 'et', label: 'Estonian' },
];

interface Props {
  id: string;
  /** What the choice is for, read out with it: "Language of package #11", "Language of the new package". */
  label: string;
  value: MasiPackageLanguage;
  onChange: (value: MasiPackageLanguage) => void;
  disabled?: boolean;
  /** The button the choice is for: it stays beside it when the row wraps. */
  children: ReactNode;
}

/**
 * The language a package is written in: the posting's by default (an Estonian posting is tuned from the
 * current Estonian translation of the master, when there is one), or the operator's choice — which masi
 * refuses when the master has no current translation into it.
 */
export default function PackageLanguage({
  id,
  label,
  value,
  onChange,
  disabled = false,
  children,
}: Readonly<Props>) {
  return (
    <span className="masi-package-language">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MasiPackageLanguage)}
      >
        {CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {children}
    </span>
  );
}
