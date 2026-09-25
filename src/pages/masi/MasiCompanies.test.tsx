import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCompanies from './MasiCompanies';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({ fetchMasiCompanies: vi.fn() }));
const api = await import('../../services/api');

const nortal = {
  id: 3,
  name: 'Nortal AS',
  registryCode: '10391131',
  website: 'https://nortal.com',
  careersUrl: null,
  atsVendor: 'teamdash',
  emtakCode: '62011',
  sizeBand: '250+',
  hqCity: 'Tallinn',
  address: null,
  tags: null,
  status: 'ACTIVE',
  origin: 'DISCOVERED',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  registerSeenAt: '2026-09-18T08:00:00Z',
  blacklisted: true,
  agency: false,
  agencyMark: null,
  userNote: null,
};

beforeEach(() => {
  vi.mocked(api.fetchMasiCompanies).mockReset(); // a body, not an expression: a returned mock would run as the test's cleanup
});

describe('MasiCompanies', () => {
  it('lists companies with their flags and drives the hiring filter through the URL', async () => {
    vi.mocked(api.fetchMasiCompanies).mockResolvedValue({
      content: [nortal],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    renderAt('/masi/companies', '/masi/companies', <MasiCompanies />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
        'href',
        '/masi/companies/3',
      ),
    );
    expect(screen.getByText('blacklisted')).toBeInTheDocument();
    expect(screen.getByText('10391131')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiCompanies).mock.calls[0][0]).toMatchObject({
      hiring: false,
      page: 0,
    });
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveClass('active');
    await userEvent.click(screen.getByLabelText('hiring now'));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiCompanies).mock.calls[1][0]).toMatchObject({ hiring: true }),
    );
  });

  it('pages through a long registry', async () => {
    vi.mocked(api.fetchMasiCompanies).mockResolvedValue({
      content: [nortal],
      page: 0,
      size: 50,
      totalElements: 51,
    });
    renderAt('/masi/companies', '/masi/companies', <MasiCompanies />);
    expect(await screen.findByText('page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.fetchMasiCompanies).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.anything(),
      ),
    );
  });
});
