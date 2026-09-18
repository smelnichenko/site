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
  tags: null,
  status: 'ACTIVE',
  origin: 'DISCOVERED',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  registerSeenAt: '2026-09-18T08:00:00Z',
  blacklisted: true,
  userNote: null,
};

beforeEach(() => vi.mocked(api.fetchMasiCompanies).mockReset());

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
    await userEvent.click(screen.getByLabelText('hiring now'));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiCompanies).mock.calls[1][0]).toMatchObject({ hiring: true }),
    );
  });
});
