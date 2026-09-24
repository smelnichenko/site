import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterCard from './RegisterCard';
import { consequence, restores } from './register';
import type { MasiCompany, MasiRegisterCandidate } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiRegisterCandidates: vi.fn(),
  fetchMasiRegisterPlacement: vi.fn(),
  placeMasiCompany: vi.fn(),
  takeBackMasiPlacement: vi.fn(),
}));
const api = await import('../../services/api');

const bolt: MasiCompany = {
  id: 82,
  name: 'Bolt',
  registryCode: null,
  website: null,
  careersUrl: null,
  atsVendor: null,
  emtakCode: null,
  sizeBand: null,
  hqCity: null,
  tags: null,
  status: 'ACTIVE',
  origin: 'FROM_LISTING',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-23T09:00:00Z',
  registerSeenAt: null,
  blacklisted: false,
  agency: false,
  agencyMark: null,
  userNote: null,
};
const candidate = (over: Partial<MasiRegisterCandidate>): MasiRegisterCandidate => ({
  registryCode: '14532901',
  name: 'Bolt Technology OÜ',
  legalForm: 'OÜ',
  emtakCode: '62901',
  hqCity: 'Tallinn',
  sizeBand: '250+',
  website: null,
  how: 'PREFIX',
  sure: false,
  employerForm: true,
  heldById: null,
  heldByName: null,
  ...over,
});
const partnership = candidate({ registryCode: '80001111', name: 'Bolt UÜ', legalForm: 'UÜ', emtakCode: '64301', how: 'EXACT', employerForm: false });
const technology = candidate({});

function showCard(company: MasiCompany, onChange = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[`/masi/companies/${company.id}`]}>
      <Routes>
        <Route path="/masi/companies/82" element={<RegisterCard company={company} onChange={onChange} />} />
        <Route path="/masi/companies/:id" element={<div data-testid="another-company" />} />
      </Routes>
    </MemoryRouter>,
  );
  return onChange;
}

beforeEach(() => {
  vi.mocked(api.fetchMasiRegisterCandidates).mockReset();
  vi.mocked(api.fetchMasiRegisterPlacement).mockReset();
  vi.mocked(api.placeMasiCompany).mockReset();
  vi.mocked(api.takeBackMasiPlacement).mockReset();
});

describe('RegisterCard', () => {
  it("lists the candidates for a company without a code, says a partnership is never an employer, and places the operator's choice after saying what it does", async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue([partnership, technology]);
    const placed = { ...bolt, registryCode: '14532901', emtakCode: '62901' };
    vi.mocked(api.placeMasiCompany).mockResolvedValue(placed);
    const onChange = showCard(bolt);

    const uu = await screen.findByRole('row', { name: /Bolt UÜ/ });
    expect(within(uu).getByText('same name')).toBeInTheDocument();
    expect(within(uu).getByText('never an employer')).toBeInTheDocument();
    const tech = screen.getByRole('row', { name: /Bolt Technology OÜ/ });
    expect(within(tech).getByText('starts with it')).toBeInTheDocument();
    expect(within(tech).queryByText('never an employer')).not.toBeInTheDocument();
    expect(api.fetchMasiRegisterPlacement).not.toHaveBeenCalled();

    await userEvent.click(within(tech).getByRole('button', { name: 'Choose' }));
    const confirm = screen.getByRole('group', { name: 'Confirm the placement' });
    expect(confirm).toHaveTextContent('Bolt takes the code 14532901 and the register\'s facts (Tallinn, 250+, EMTAK 62901)');
    expect(api.placeMasiCompany).not.toHaveBeenCalled(); // nothing placed on one click

    await userEvent.click(within(confirm).getByRole('button', { name: 'Place on Bolt Technology OÜ' }));
    await waitFor(() => expect(api.placeMasiCompany).toHaveBeenCalledWith(82, '14532901'));
    expect(onChange).toHaveBeenCalledWith(placed);
  });

  it('cancels a choice without placing anything', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue([technology]);
    showCard(bolt);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
    expect(api.placeMasiCompany).not.toHaveBeenCalled();
  });

  it("says a code masi already holds merges the two, and goes to the survivor's page when it does", async () => {
    const held = candidate({ heldById: 99, heldByName: 'Bolt Technology OÜ' });
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue([held]);
    vi.mocked(api.placeMasiCompany).mockResolvedValue({ ...bolt, id: 99, registryCode: '14532901' });
    const onChange = showCard(bolt);
    expect(await screen.findByText('masi holds it')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screen.getByRole('group', { name: 'Confirm the placement' })).toHaveTextContent(
      'masi already holds Bolt Technology OÜ under that code: this company is merged into it',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Place on Bolt Technology OÜ' }));
    expect(await screen.findByTestId('another-company')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled(); // this company is gone; nothing to update in place
  });

  it('places by a registry code the operator types, which need not be a candidate', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue([]);
    vi.mocked(api.placeMasiCompany).mockResolvedValue({ ...bolt, registryCode: '12345678' });
    showCard(bolt);
    expect(await screen.findByText('The register has no company by this name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Or a registry code'), ' 12345678 ');
    await userEvent.click(screen.getByRole('button', { name: 'Place' }));
    await waitFor(() => expect(api.placeMasiCompany).toHaveBeenCalledWith(82, '12345678'));
  });

  it('shows a refused placement', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue([technology]);
    vi.mocked(api.placeMasiCompany).mockRejectedValue(new Error('masi is importing the register; try again'));
    showCard(bolt);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place on Bolt Technology OÜ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('masi is importing the register; try again');
  });

  it('shows what a placement replaced, and takes it back', async () => {
    const coded = { ...bolt, registryCode: '14532901' };
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue({
      registryCode: '14532901',
      placedAt: '2026-09-24T01:00:00Z',
      priorWebsite: 'https://bolt.eu',
      priorHqCity: null,
      priorEmtakCode: null,
      priorSizeBand: null,
    });
    vi.mocked(api.takeBackMasiPlacement).mockResolvedValue(bolt);
    const onChange = showCard(coded);
    expect(await screen.findByText(/Placed on the register as reg\. 14532901/)).toBeInTheDocument();
    expect(screen.getByText('Taking it back restores website https://bolt.eu.')).toBeInTheDocument();
    expect(api.fetchMasiRegisterCandidates).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Take back' }));
    await waitFor(() => expect(api.takeBackMasiPlacement).toHaveBeenCalledWith(82));
    expect(onChange).toHaveBeenCalledWith(bolt);
  });

  it('says nothing for a code the register import gave, which has nothing to take back', async () => {
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue(null);
    showCard({ ...bolt, registryCode: '10391131' });
    await waitFor(() => expect(api.fetchMasiRegisterPlacement).toHaveBeenCalled());
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });

  it('shows a register that cannot be loaded rather than nothing', async () => {
    vi.mocked(api.fetchMasiRegisterPlacement).mockRejectedValue(new Error('Failed to load the placement'));
    showCard({ ...bolt, registryCode: '10391131' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the placement');
  });

  it('puts what a choice does and what taking it back restores into words', () => {
    expect(consequence(bolt, candidate({ hqCity: null, sizeBand: null, emtakCode: null }))).toBe('Bolt takes the code 14532901');
    // the company already holding the code is this one: no merge to announce
    expect(consequence(bolt, candidate({ heldById: 82 }))).toBe(
      "Bolt takes the code 14532901 and the register's facts (Tallinn, 250+, EMTAK 62901)",
    );
    expect(
      restores({ registryCode: '1', placedAt: '', priorWebsite: null, priorHqCity: 'Tartu', priorEmtakCode: '62011', priorSizeBand: '1-4' }),
    ).toBe('Taking it back restores city Tartu, EMTAK 62011, size 1-4.');
    expect(
      restores({ registryCode: '1', placedAt: '', priorWebsite: null, priorHqCity: null, priorEmtakCode: null, priorSizeBand: null }),
    ).toBe('Taking it back leaves the company as it was before.');
  });
});
