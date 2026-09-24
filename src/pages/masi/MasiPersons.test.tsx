import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiPersons from './MasiPersons';
import { renderAt } from './testUtils';
import type { MasiPerson } from '../../services/api';

vi.mock('../../services/api', () => ({ fetchMasiPersons: vi.fn(), patchMasiPerson: vi.fn() }));
const api = await import('../../services/api');

const anna: MasiPerson = {
  id: 20,
  name: 'Taima-Riin Uutma',
  email: 'taima-riin.uutma@ee.ey.com',
  phone: null,
  title: 'Talent Partner',
  doNotContact: false,
  userNote: null,
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-23T09:00:00Z',
  ties: [
    {
      companyId: 7,
      companyName: 'EY Estonia',
      agency: false,
      role: 'POSTED_FOR',
      evidence: 'LISTING',
      evidenceRef: 'listing 1',
      since: null,
      until: null,
      where: 'COMPANY_UNKNOWN',
      contactId: 5,
    },
    {
      companyId: 7,
      companyName: 'EY Estonia',
      agency: false,
      role: 'POSTED_FOR',
      evidence: 'LISTING',
      evidenceRef: 'listing 2',
      since: null,
      until: null,
      where: 'COMPANY_UNKNOWN',
      contactId: 5,
    },
    {
      companyId: 9,
      companyName: 'Grafton Estonia OÜ',
      agency: true,
      role: 'WORKS_AT',
      evidence: 'OPERATOR',
      evidenceRef: null,
      since: null,
      until: null,
      where: 'COMPANY_UNKNOWN',
      contactId: 5,
    },
  ],
};
const page = (content: MasiPerson[], total = content.length) => ({
  content,
  page: 0,
  size: 50,
  totalElements: total,
});

beforeEach(() => {
  vi.mocked(api.fetchMasiPersons).mockReset(); // a body, not an expression: a returned mock would run as the test's cleanup
  vi.mocked(api.patchMasiPerson).mockReset();
});

describe('MasiPersons', () => {
  it('lists people with each company once, its roles counted, and an agency marked', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValue(page([anna]));
    renderAt('/masi/persons', '/masi/persons', <MasiPersons />);
    const link = await screen.findByRole('link', { name: 'Taima-Riin Uutma' });
    expect(link).toHaveAttribute('href', '/masi/persons/20');
    const row = screen.getByRole('row', { name: /Taima-Riin Uutma/ });
    expect(within(row).getAllByRole('link', { name: 'EY Estonia' })).toHaveLength(1);
    expect(within(row).getByText('posted for ×2')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Grafton Estonia OÜ' })).toHaveAttribute(
      'href',
      '/masi/companies/9',
    );
    expect(within(row).getAllByText('agency')).toHaveLength(1); // Grafton's, not EY's
    expect(screen.getByRole('link', { name: 'People' })).toHaveClass('active');
  });

  it('asks the server with the URL: a search, the agency filter and one company, each starting on page one', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValue(page([anna]));
    renderAt('/masi/persons?company=7&page=2', '/masi/persons', <MasiPersons />);
    await screen.findByRole('link', { name: 'Taima-Riin Uutma' });
    expect(vi.mocked(api.fetchMasiPersons).mock.calls[0][0]).toEqual({
      q: undefined,
      company: 7,
      agency: undefined,
      page: 2,
      size: 50,
    });

    await userEvent.type(screen.getByLabelText('Name or address'), 'uutma');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPersons).mock.lastCall?.[0]).toEqual({
        q: 'uutma',
        company: 7,
        agency: undefined,
        page: 0,
        size: 50,
      }),
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'at agencies only' }));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPersons).mock.lastCall?.[0]).toMatchObject({ agency: true }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'All companies' }));
    await waitFor(() =>
      expect(vi.mocked(api.fetchMasiPersons).mock.lastCall?.[0].company).toBeUndefined(),
    );
    expect(screen.queryByRole('button', { name: 'All companies' })).not.toBeInTheDocument();
  });

  it('flags a person not to be contacted through the API', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValue(page([anna]));
    vi.mocked(api.patchMasiPerson).mockResolvedValue({ ...anna, doNotContact: true });
    renderAt('/masi/persons', '/masi/persons', <MasiPersons />);
    await userEvent.click(await screen.findByRole('button', { name: 'ok to contact' }));
    await waitFor(() =>
      expect(api.patchMasiPerson).toHaveBeenCalledWith(20, { doNotContact: true }),
    );
    expect(await screen.findByRole('button', { name: 'do not contact' })).toBeInTheDocument();
  });

  it('says so when nobody matches, and shows a failure instead of a blank page', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValueOnce(page([]));
    renderAt('/masi/persons?q=zz', '/masi/persons', <MasiPersons />);
    expect(await screen.findByText('Nobody matches.')).toBeInTheDocument();

    vi.mocked(api.fetchMasiPersons).mockRejectedValueOnce(new Error('Failed to load people'));
    await userEvent.clear(screen.getByLabelText('Name or address'));
    await userEvent.type(screen.getByLabelText('Name or address'), 'kask');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load people');
  });

  it('pages through a long list', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValue(page([anna], 120));
    renderAt('/masi/persons', '/masi/persons', <MasiPersons />);
    expect(await screen.findByText('page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(vi.mocked(api.fetchMasiPersons).mock.lastCall?.[0].page).toBe(1));
  });

  it('shows a refused flag rather than pretending it was set', async () => {
    vi.mocked(api.fetchMasiPersons).mockResolvedValue(page([anna]));
    vi.mocked(api.patchMasiPerson).mockRejectedValue(new Error('saving refused'));
    renderAt('/masi/persons', '/masi/persons', <MasiPersons />);
    await userEvent.click(await screen.findByRole('button', { name: 'ok to contact' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('saving refused');
    expect(screen.getByRole('button', { name: 'ok to contact' })).toBeInTheDocument();
  });
});
