import type { MasiCompany, MasiRegisterCandidate, MasiRegisterPlacement } from '../../services/api';

/** Whether the company places people at others, and whose word that is: the operator's mark, else the register's. */
export function agencyText(c: MasiCompany): string {
  if (c.agencyMark !== null) {
    return c.agencyMark ? 'An agency — your mark' : 'Not an agency — your mark';
  }
  if (c.agency) {
    const code = c.emtakCode ? ` (EMTAK ${c.emtakCode})` : '';
    return `An agency — the register says so${code}`;
  }
  return c.registryCode ? 'Not an agency — by the register' : 'Not an agency — not placed on the register yet';
}

/** What choosing a registered company will do, said before it is done. */
export function consequence(company: MasiCompany, c: MasiRegisterCandidate): string {
  if (c.heldById !== null && c.heldById !== company.id) {
    const holder = c.heldByName ?? `company ${c.heldById}`;
    return `masi already holds ${holder} under that code: this company is merged into it`;
  }
  const emtak = c.emtakCode ? `EMTAK ${c.emtakCode}` : null;
  const facts = [c.hqCity, c.sizeBand, emtak].filter(Boolean).join(', ');
  const withFacts = facts ? ` and the register's facts (${facts})` : '';
  return `${company.name} takes the code ${c.registryCode}${withFacts}`;
}

/** What taking a placement back restores. */
export function restores(p: MasiRegisterPlacement): string {
  const what = [
    p.priorWebsite ? `website ${p.priorWebsite}` : null,
    p.priorHqCity ? `city ${p.priorHqCity}` : null,
    p.priorEmtakCode ? `EMTAK ${p.priorEmtakCode}` : null,
    p.priorSizeBand ? `size ${p.priorSizeBand}` : null,
  ].filter(Boolean);
  return what.length ? `Taking it back restores ${what.join(', ')}.` : 'Taking it back leaves the company as it was before.';
}
