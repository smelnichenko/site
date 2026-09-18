import { Link, useLocation } from 'react-router-dom';

const TABS: Array<{ to: string; label: string; exact?: boolean }> = [
  { to: '/masi', label: 'Overview', exact: true },
  { to: '/masi/jobs', label: 'Jobs' },
  { to: '/masi/packages', label: 'Review queue' },
  { to: '/masi/companies', label: 'Companies' },
  { to: '/masi/contacts', label: 'Contacts' },
  { to: '/masi/sources', label: 'Sources' },
  { to: '/masi/cv', label: 'CV master' },
];

/** The tab bar every masi page shares; the active tab follows the path prefix. */
export default function MasiNav() {
  const { pathname } = useLocation();
  return (
    <nav className="masi-nav" aria-label="masi sections">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link key={t.to} to={t.to} className={active ? 'active' : ''}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
