import { MasiPackageLanguage } from '../../services/api';

const CHOICES: { value: MasiPackageLanguage; label: string }[] = [
  { value: 'auto', label: 'Language of the posting' },
  { value: 'en', label: 'English' },
  { value: 'et', label: 'Estonian' },
];

interface Props {
  id: string;
  value: MasiPackageLanguage;
  onChange: (value: MasiPackageLanguage) => void;
  disabled?: boolean;
}

/**
 * The language a package is written in: the posting's by default (an Estonian posting is tuned from the
 * current Estonian translation of the master, when there is one), or the operator's choice — which masi
 * refuses when the master has no current translation into it.
 */
export default function PackageLanguage({ id, value, onChange, disabled = false }: Readonly<Props>) {
  return (
    <label htmlFor={id} className="masi-package-language">
      <span className="sr-only">Package language</span>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as MasiPackageLanguage)}>
        {CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
