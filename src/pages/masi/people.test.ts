import { describe, it, expect } from 'vitest';
import type { MasiPersonTie } from '../../services/api';
import { byCompany, evidenceLabel, roleLabel, rolesText, whereLabel } from './people';

function tie(over: Partial<MasiPersonTie>): MasiPersonTie {
  return {
    companyId: 1,
    companyName: 'EY Estonia',
    agency: false,
    role: 'POSTED_FOR',
    evidence: 'LISTING',
    evidenceRef: null,
    since: '2026-09-01T00:00:00Z',
    until: null,
    where: 'COMPANY_UNKNOWN',
    ...over,
  };
}

describe('people', () => {
  it('groups ties by company, each role once with its count, in the order the companies first appear', () => {
    const grouped = byCompany([
      tie({ companyId: 2, companyName: 'SEB' }),
      tie({}),
      tie({}),
      tie({ role: 'TALKED_TO', evidence: 'OPERATOR' }),
      tie({ companyId: 2, companyName: 'SEB', role: 'REPRESENTS', until: '2026-09-20T00:00:00Z' }),
    ]);
    expect(grouped.map((c) => c.companyName)).toEqual(['SEB', 'EY Estonia']);
    expect(rolesText(grouped[1].roles)).toBe('posted for ×2, talked to');
    expect(rolesText(grouped[0].roles)).toBe('posted for, represents (ended)');
  });

  it('calls a role ended only when every tie that says it has ended', () => {
    const [c] = byCompany([tie({ until: '2026-09-20T00:00:00Z' }), tie({ until: null })]);
    expect(c.roles[0]).toEqual({ role: 'POSTED_FOR', count: 2, ended: false });
    const [gone] = byCompany([tie({ until: '2026-09-20T00:00:00Z' }), tie({ until: '2026-09-21T00:00:00Z' })]);
    expect(gone.roles[0].ended).toBe(true);
  });

  it('names a company it has no name for rather than showing nothing', () => {
    expect(byCompany([tie({ companyId: 9, companyName: null })])[0].companyName).toBe('company 9');
  });

  it('puts every role, evidence and address verdict into words, and shows an unknown one as it came', () => {
    expect(['POSTED_FOR', 'REPRESENTS', 'WORKS_AT', 'RECRUITS_FOR', 'TALKED_TO'].map(roleLabel)).toEqual([
      'posted for',
      'represents',
      'works at',
      'recruits for',
      'talked to',
    ]);
    expect(roleLabel('SOMETHING_NEW')).toBe('something_new');
    expect(['LISTING', 'REGISTER', 'PARTNER', 'OPERATOR'].map(evidenceLabel)).toEqual([
      'a listing',
      'the register',
      'a partner',
      'you',
    ]);
    expect(whereLabel('SOMEWHERE_ELSE')).toBe('writes from elsewhere');
    expect(whereLabel('THE_COMPANYS')).toBe("the company's own address");
    expect(whereLabel('COMPANY_UNKNOWN')).toBe('');
  });
});
