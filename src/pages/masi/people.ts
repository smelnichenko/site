import type { MasiPerson, MasiPersonTie, patchMasiPerson } from '../../services/api';

const ROLES: Record<string, string> = {
  POSTED_FOR: 'posted for',
  REPRESENTS: 'represents',
  WORKS_AT: 'works at',
  RECRUITS_FOR: 'recruits for',
  TALKED_TO: 'talked to',
};

const EVIDENCE: Record<string, string> = {
  LISTING: 'a listing',
  REGISTER: 'the register',
  PARTNER: 'a partner',
  OPERATOR: 'you',
};

const WHERE: Record<string, string> = {
  THE_COMPANYS: "the company's own address",
  SOMEWHERE_ELSE: 'writes from elsewhere',
  COMPANY_UNKNOWN: '',
  NO_ADDRESS: '',
};

/** What the person is to the company, in words; an unknown role is shown as it came rather than hidden. */
export function roleLabel(role: string): string {
  return ROLES[role] ?? role.toLowerCase();
}

/** Who says so. */
export function evidenceLabel(evidence: string): string {
  return EVIDENCE[evidence] ?? evidence.toLowerCase();
}

/** Whether the address they published is the company's; empty where masi cannot tell, which is most companies. */
export function whereLabel(where: string): string {
  return WHERE[where] ?? '';
}

/** One company a person is tied to, with each role once and how many ties say it. */
export interface CompanyTies {
  companyId: number;
  companyName: string;
  agency: boolean;
  roles: Array<{ role: string; count: number; ended: boolean }>;
}

/**
 * The ties grouped by company, in the order the companies first appear: a recruiter who posted ten listings for one
 * employer is one line "posted for ×10", not ten rows. A role is ended only when every tie that says it has ended.
 */
export function byCompany(ties: MasiPersonTie[]): CompanyTies[] {
  const out = new Map<number, CompanyTies>();
  for (const t of ties) {
    let c = out.get(t.companyId);
    if (!c) {
      c = {
        companyId: t.companyId,
        companyName: t.companyName ?? `company ${t.companyId}`,
        agency: t.agency,
        roles: [],
      };
      out.set(t.companyId, c);
    }
    const r = c.roles.find((x) => x.role === t.role);
    if (r) {
      r.count += 1;
      r.ended = r.ended && t.until !== null;
    } else {
      c.roles.push({ role: t.role, count: 1, ended: t.until !== null });
    }
  }
  return [...out.values()];
}

/** "posted for ×2", "represents (ended)". */
export function rolesText(roles: CompanyTies['roles']): string {
  return roles
    .map((r) => {
      const times = r.count > 1 ? ` ×${r.count}` : '';
      const ended = r.ended ? ' (ended)' : '';
      return `${roleLabel(r.role)}${times}${ended}`;
    })
    .join(', ');
}

/** The fields the operator corrects, as typed. */
export interface Draft {
  name: string;
  title: string;
  email: string;
  phone: string;
  note: string;
}

export function draftOf(p: MasiPerson): Draft {
  return {
    name: p.name ?? '',
    title: p.title ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    note: p.userNote ?? '',
  };
}

/**
 * Only what changed: sending an unchanged address would ask the server to re-check an identity nobody touched. A title
 * or a phone emptied is sent empty, which clears it; a name or an address emptied is not sent — they are who the person
 * is, and are corrected, not removed.
 */
export function changes(p: MasiPerson, d: Draft) {
  const out: Parameters<typeof patchMasiPerson>[1] = {};
  if (d.name.trim() && d.name.trim() !== (p.name ?? '')) out.name = d.name.trim();
  if (d.title.trim() !== (p.title ?? '')) out.title = d.title.trim();
  if (d.email.trim() && d.email.trim() !== (p.email ?? '')) out.email = d.email.trim();
  if (d.phone.trim() !== (p.phone ?? '')) out.phone = d.phone.trim();
  if (d.note !== (p.userNote ?? '')) out.userNote = d.note;
  return out;
}
