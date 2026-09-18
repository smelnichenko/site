import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCompanyDetail from './MasiCompanyDetail';
import { job, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiCompany: vi.fn(),
  fetchMasiJobs: vi.fn(),
  fetchMasiCompanyContacts: vi.fn(),
  patchMasiCompany: vi.fn(),
  patchMasiContact: vi.fn(),
}));
const api = await import('../../services/api');

const company = {
  id: 3,
  name: 'Nortal AS',
  registryCode: '10391131',
  website: 'https://nortal.com',
  careersUrl: 'https://nortal.com/careers',
  atsVendor: null,
  emtakCode: null,
  sizeBand: '250+',
  hqCity: 'Tallinn',
  tags: null,
  status: 'ACTIVE',
  origin: 'DISCOVERED',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  registerSeenAt: null,
  blacklisted: false,
  userNote: null,
};
const kati = {
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
  doNotContact: false,
  userNote: null,
};

beforeEach(() => {
  vi.mocked(api.fetchMasiCompany).mockReset();
  vi.mocked(api.fetchMasiJobs).mockReset();
  vi.mocked(api.fetchMasiCompanyContacts).mockReset();
  vi.mocked(api.patchMasiCompany).mockReset();
  vi.mocked(api.patchMasiContact).mockReset();
});

describe('MasiCompanyDetail', () => {
  it('shows the company, its open and closed jobs and its contacts; blacklists and flags a contact through the API', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        job,
        { ...job, id: 8, title: 'Old role', status: 'CLOSED', closedAt: '2026-09-01T00:00:00Z' },
      ],
      page: 0,
      size: 100,
      totalElements: 2,
    });
    vi.mocked(api.fetchMasiCompanyContacts).mockResolvedValue({
      content: [kati],
      page: 0,
      size: 200,
      totalElements: 1,
    });
    vi.mocked(api.patchMasiCompany).mockResolvedValue({ ...company, blacklisted: true });
    vi.mocked(api.patchMasiContact).mockResolvedValue({ ...kati, doNotContact: true });
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(await screen.findByText('Nortal AS')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
      company: 3,
      status: 'ALL',
    });
    expect(screen.getByText('1 open · 1 closed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Old role' })).toHaveAttribute('href', '/masi/jobs/8');
    expect(screen.getByText('Kati Kask')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ok to contact' }));
    await waitFor(() =>
      expect(api.patchMasiContact).toHaveBeenCalledWith(5, { doNotContact: true }),
    );
    expect(screen.getByRole('button', { name: 'do not contact' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Blacklist' }));
    await waitFor(() =>
      expect(api.patchMasiCompany).toHaveBeenCalledWith(3, { blacklisted: true }),
    );
    expect(screen.getByText('Blacklisted: no packages for this company')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lift blacklist' })).toBeInTheDocument();
  });
});
