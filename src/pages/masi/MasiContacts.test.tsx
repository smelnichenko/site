import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import MasiContacts from './MasiContacts';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({ fetchMasiContacts: vi.fn(), patchMasiContact: vi.fn() }));
const api = await import('../../services/api');

beforeEach(() => vi.mocked(api.fetchMasiContacts).mockReset());

describe('MasiContacts', () => {
  it('lists contacts with their company links and flags', async () => {
    vi.mocked(api.fetchMasiContacts).mockResolvedValue({
      content: [
        {
          id: 5,
          companyId: 3,
          companyName: 'Nortal AS',
          kind: 'PERSON',
          name: 'Kati Kask',
          title: 'Recruiter',
          email: 'kati@example.org',
          phone: null,
          origin: 'FROM_LISTING',
          sourceId: 2,
          firstListingId: 1,
          firstSeenAt: '2026-09-18T08:00:00Z',
          lastSeenAt: '2026-09-18T09:00:00Z',
          doNotContact: true,
          userNote: null,
        },
        {
          id: 6,
          companyId: 4,
          companyName: 'Wise Europe OÜ',
          kind: 'GENERIC',
          name: null,
          title: null,
          email: 'jobs@example.org',
          phone: null,
          origin: 'FROM_LISTING',
          sourceId: 2,
          firstListingId: 2,
          firstSeenAt: '2026-09-18T08:00:00Z',
          lastSeenAt: '2026-09-18T09:00:00Z',
          doNotContact: false,
          userNote: null,
        },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/contacts', '/masi/contacts', <MasiContacts />);
    expect(await screen.findByText('Kati Kask')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/companies/3',
    );
    expect(screen.getByText('generic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'do not contact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ok to contact' })).toBeInTheDocument();
  });
});
