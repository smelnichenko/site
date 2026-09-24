import { describe, it, expect } from 'vitest';
import type { MasiPerson, MasiPersonTie } from '../../services/api';
import {
  byCompany,
  changes,
  draftOf,
  evidenceLabel,
  roleLabel,
  rolesText,
  whereLabel,
} from './people';

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
    contactId: 7,
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
    const [gone] = byCompany([
      tie({ until: '2026-09-20T00:00:00Z' }),
      tie({ until: '2026-09-21T00:00:00Z' }),
    ]);
    expect(gone.roles[0].ended).toBe(true);
  });

  it('names a company it has no name for rather than showing nothing', () => {
    expect(byCompany([tie({ companyId: 9, companyName: null })])[0].companyName).toBe('company 9');
  });

  it('puts every role, evidence and address verdict into words, and shows an unknown one as it came', () => {
    expect(
      ['POSTED_FOR', 'REPRESENTS', 'WORKS_AT', 'RECRUITS_FOR', 'TALKED_TO'].map(roleLabel),
    ).toEqual(['posted for', 'represents', 'works at', 'recruits for', 'talked to']);
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

  it('sends only what changed: a title or a phone emptied clears it, a name or an address emptied is left alone', () => {
    const kadri: MasiPerson = {
      id: 1,
      name: 'Kadri Kask',
      email: 'kadri@example.com',
      phone: '+372 555',
      title: 'Recruiter',
      doNotContact: false,
      userNote: null,
      firstSeenAt: '2026-09-18T08:00:00Z',
      lastSeenAt: '2026-09-18T08:00:00Z',
      ties: [],
    };
    const as = draftOf(kadri);
    expect(changes(kadri, as)).toEqual({});
    expect(changes(kadri, { ...as, title: '  ', phone: '' })).toEqual({ title: '', phone: '' });
    expect(changes(kadri, { ...as, name: '', email: ' ' })).toEqual({});
    expect(changes(kadri, { ...as, name: ' Kadri Kaasik ', email: 'k@example.com' })).toEqual({
      name: 'Kadri Kaasik',
      email: 'k@example.com',
    });
    expect(changes(kadri, { ...as, note: 'x' })).toEqual({ userNote: 'x' });
    expect(changes({ ...kadri, userNote: 'old' }, { ...as, note: '' })).toEqual({ userNote: '' });
    expect(changes(kadri, { ...as, phone: ' +372 6666 ', title: ' Head ' })).toEqual({
      phone: '+372 6666',
      title: 'Head',
    });
    expect(changes(kadri, { ...as, title: 'Recruiter ' })).toEqual({}); // the same, typed with a space
  });
});
