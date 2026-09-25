import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterCard from './RegisterCard';
import { consequence, restores, whyNone } from './register';
import type {
  MasiCompany,
  MasiRegisterCandidate,
  MasiRegisterCandidates,
} from '../../services/api';

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
const partnership = candidate({
  registryCode: '80001111',
  name: 'Bolt UÜ',
  legalForm: 'UÜ',
  emtakCode: '64301',
  how: 'EXACT',
  employerForm: false,
});
const technology = candidate({});
const found = (
  candidates: MasiRegisterCandidate[],
  over: Partial<MasiRegisterCandidates> = {},
): MasiRegisterCandidates => ({ indexed: true, truncated: false, candidates, ...over });

function showCard(company: MasiCompany, onChange = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[`/masi/companies/${company.id}`]}>
      <Routes>
        <Route
          path="/masi/companies/82"
          element={<RegisterCard company={company} onChange={onChange} />}
        />
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
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([partnership, technology]));
    const placed = { ...bolt, registryCode: '14532901', emtakCode: '62901' };
    vi.mocked(api.placeMasiCompany).mockResolvedValue(placed);
    const onChange = showCard(bolt);
    expect(screen.getByText('Looking in the register...')).toBeInTheDocument();

    const uu = await screen.findByRole('row', { name: /Bolt UÜ/ });
    expect(within(uu).getByText('same name')).toBeInTheDocument();
    expect(within(uu).getByText('never an employer')).toBeInTheDocument();
    const tech = screen.getByRole('row', { name: /Bolt Technology OÜ/ });
    expect(within(tech).getByText('starts with it')).toBeInTheDocument();
    expect(within(tech).queryByText('never an employer')).not.toBeInTheDocument();
    expect(api.fetchMasiRegisterPlacement).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    const confirm = screen.getByRole('group', { name: 'Confirm the placement' });
    expect(confirm).toHaveTextContent(
      "Bolt Technology OÜ (reg. 14532901): Bolt takes the code 14532901 and the register's facts (Tallinn, 250+, EMTAK 62901)",
    );
    // the choice is where focus goes, and the row says it is the one chosen
    expect(within(confirm).getByRole('button', { name: 'Place it' })).toHaveFocus();
    expect(screen.getByRole('row', { name: /Bolt Technology OÜ/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('row', { name: /Bolt UÜ/ })).not.toHaveAttribute('aria-current');
    expect(api.placeMasiCompany).not.toHaveBeenCalled(); // nothing placed on one click

    await userEvent.click(within(confirm).getByRole('button', { name: 'Place it' }));
    await waitFor(() => expect(api.placeMasiCompany).toHaveBeenCalledWith(82, '14532901'));
    expect(onChange).toHaveBeenCalledWith(placed);
  });

  it('marks the one candidate masi is sure of', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(
      found([candidate({ sure: true }), partnership]),
    );
    showCard(bolt);
    const sure = await screen.findByRole('row', { name: /Bolt Technology OÜ/ });
    expect(within(sure).getByText('masi is sure of this one')).toBeInTheDocument();
    const other = screen.getByRole('row', { name: /Bolt UÜ/ });
    expect(within(other).queryByText('masi is sure of this one')).not.toBeInTheDocument();
  });

  it('cancels a choice without placing anything', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([technology]));
    showCard(bolt);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
    expect(api.placeMasiCompany).not.toHaveBeenCalled();
  });

  it("says a code masi already holds merges the two, and goes to the survivor's page when it does", async () => {
    const held = candidate({ heldById: 99, heldByName: 'Bolt Technology OÜ' });
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([held]));
    vi.mocked(api.placeMasiCompany).mockResolvedValue({
      ...bolt,
      id: 99,
      registryCode: '14532901',
    });
    const onChange = showCard(bolt);
    expect(await screen.findByText('masi holds it')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    expect(screen.getByRole('group', { name: 'Confirm the placement' })).toHaveTextContent(
      'masi already holds Bolt Technology OÜ under that code: this company is merged into it',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    expect(await screen.findByTestId('another-company')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled(); // this company is gone; nothing to update in place
  });

  it("says how each candidate was found: the same name, a name that begins with it, its people's domain, a typed code", async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(
      found([
        candidate({ registryCode: '1', name: 'Same OÜ', how: 'EXACT' }),
        candidate({ registryCode: '2', name: 'Longer OÜ', how: 'PREFIX' }),
        candidate({ registryCode: '3', name: 'Domain OÜ', how: 'DOMAIN' }),
        candidate({ registryCode: '4', name: 'Typed OÜ', how: 'CODE' }),
      ]),
    );
    showCard(bolt);
    const row = (name: string) => screen.findByRole('row', { name: new RegExp(name) });
    expect(await row('Same OÜ')).toHaveTextContent('same name');
    expect(await row('Longer OÜ')).toHaveTextContent('starts with it');
    expect(await row('Domain OÜ')).toHaveTextContent('its people write from its domain');
    expect(await row('Domain OÜ')).not.toHaveTextContent('starts with it');
    expect(await row('Typed OÜ')).toHaveTextContent('the code you typed');
    expect(await row('Typed OÜ')).not.toHaveTextContent('starts with it');
  });

  it('looks a typed code up and asks before placing it — a code masi holds would merge two companies', async () => {
    const typed = candidate({
      how: 'CODE',
      registryCode: '12345678',
      heldById: 99,
      heldByName: 'Bolt Technology OÜ',
    });
    vi.mocked(api.fetchMasiRegisterCandidates)
      .mockResolvedValueOnce(found([]))
      .mockResolvedValueOnce(found([typed]));
    vi.mocked(api.placeMasiCompany).mockResolvedValue({ ...bolt, registryCode: '12345678' });
    showCard(bolt);
    expect(
      await screen.findByText('The register has no company by this name.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Or a registry code'), ' 12345678 ');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await waitFor(() =>
      expect(api.fetchMasiRegisterCandidates).toHaveBeenLastCalledWith(82, undefined, '12345678'),
    );
    expect(screen.getByRole('group', { name: 'Confirm the placement' })).toHaveTextContent(
      'this company is merged into it',
    );
    expect(api.placeMasiCompany).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    await waitFor(() => expect(api.placeMasiCompany).toHaveBeenCalledWith(82, '12345678'));
  });

  it('says so when a typed code is not in the register, and when the register has not been read', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates)
      .mockResolvedValueOnce(found([]))
      .mockResolvedValueOnce(found([]))
      .mockResolvedValueOnce(found([], { indexed: false }));
    showCard(bolt);
    await screen.findByText('The register has no company by this name.');
    await userEvent.type(screen.getByLabelText('Or a registry code'), '99999999');
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The register has no company with the code 99999999.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('The register has not been read yet'),
    );
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
  });

  it('says the list is not all of them when more names begin with it than can be listed', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(
      found([candidate({ how: 'EXACT' })], { truncated: true }),
    );
    showCard(bolt);
    expect(
      await screen.findByText(/if it is none of these, type its registry code/),
    ).toBeInTheDocument();
  });

  it('says why there are no candidates', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([], { indexed: false }));
    showCard(bolt);
    expect(await screen.findByText(/The register has not been read yet/)).toBeInTheDocument();
  });

  it('shows a refused placement', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([technology]));
    vi.mocked(api.placeMasiCompany).mockRejectedValue(
      new Error('masi is importing the register; try again'),
    );
    showCard(bolt);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'masi is importing the register; try again',
    );
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
    expect(
      screen.getByText('Taking it back restores website https://bolt.eu.'),
    ).toBeInTheDocument();
    expect(api.fetchMasiRegisterCandidates).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Take back' }));
    await waitFor(() => expect(api.takeBackMasiPlacement).toHaveBeenCalledWith(82));
    expect(onChange).toHaveBeenCalledWith(bolt);
    // gone at once, not offered again while the page reloads the candidates
    expect(screen.queryByRole('button', { name: 'Take back' })).not.toBeInTheDocument();
  });

  it('says nothing for a code the register import gave, which has nothing to take back', async () => {
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue(null);
    showCard({ ...bolt, registryCode: '10391131' });
    await waitFor(() => expect(api.fetchMasiRegisterPlacement).toHaveBeenCalled());
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });

  it('shows a register that cannot be loaded rather than nothing', async () => {
    vi.mocked(api.fetchMasiRegisterPlacement).mockRejectedValue(
      new Error('Failed to load the placement'),
    );
    showCard({ ...bolt, registryCode: '10391131' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the placement');
  });

  it('puts what a choice does, what taking it back restores, and why there is nothing, into words', () => {
    expect(consequence(bolt, candidate({ hqCity: null, sizeBand: null, emtakCode: null }))).toBe(
      'Bolt takes the code 14532901',
    );
    // the company already holding the code is this one: no merge to announce
    expect(consequence(bolt, candidate({ heldById: 82 }))).toBe(
      "Bolt takes the code 14532901 and the register's facts (Tallinn, 250+, EMTAK 62901)",
    );
    const prior = { registryCode: '1', placedAt: '', priorWebsite: null };
    expect(
      restores({ ...prior, priorHqCity: 'Tartu', priorEmtakCode: '62011', priorSizeBand: '1-4' }),
    ).toBe('Taking it back restores city Tartu, EMTAK 62011, size 1-4.');
    expect(
      restores({ ...prior, priorHqCity: null, priorEmtakCode: null, priorSizeBand: null }),
    ).toBe('Taking it back leaves the company as it was before.');
    expect(whyNone(found([], { indexed: false }))).toMatch(/not been read yet/);
    expect(whyNone(found([], { truncated: true }))).toBe(
      'More registered companies begin with this name than can be listed: type its registry code.',
    );
    expect(whyNone(found([]))).toBe('The register has no company by this name.');
  });

  /** The card inside a page that keeps the company, as the company page does: its answer is the prop that comes back. */
  function Page({ start }: Readonly<{ start: MasiCompany }>) {
    const [company, setCompany] = useState(start);
    return (
      <MemoryRouter>
        <RegisterCard company={company} onChange={setCompany} />
      </MemoryRouter>
    );
  }

  it('follows the company it is given: placed, it shows the placement; taken back, the candidates again', async () => {
    const placed = { ...bolt, registryCode: '14532901' };
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([technology]));
    vi.mocked(api.placeMasiCompany).mockResolvedValue(placed);
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue({
      registryCode: '14532901',
      placedAt: '2026-09-24T01:00:00Z',
      priorWebsite: null,
      priorHqCity: null,
      priorEmtakCode: null,
      priorSizeBand: null,
    });
    vi.mocked(api.takeBackMasiPlacement).mockResolvedValue(bolt);
    render(<Page start={bolt} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    expect(await screen.findByText(/Placed on the register as reg\. 14532901/)).toBeInTheDocument();
    expect(api.fetchMasiRegisterPlacement).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Take back' }));
    expect(await screen.findByLabelText('Or a registry code')).toBeInTheDocument();
    expect(api.fetchMasiRegisterCandidates).toHaveBeenCalledTimes(2);
  });

  it('keeps offering to take back a placement the server would not take back, and says why', async () => {
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue({
      registryCode: '14532901',
      placedAt: '2026-09-24T01:00:00Z',
      priorWebsite: null,
      priorHqCity: null,
      priorEmtakCode: null,
      priorSizeBand: null,
    });
    vi.mocked(api.takeBackMasiPlacement).mockRejectedValue(
      new Error('masi is importing the register'),
    );
    render(<Page start={{ ...bolt, registryCode: '14532901' }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Take back' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('masi is importing the register');
    expect(screen.getByRole('button', { name: 'Take back' })).toBeInTheDocument();
  });

  it('closes the confirmation when the placement is refused', async () => {
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue(found([technology]));
    vi.mocked(api.placeMasiCompany).mockRejectedValue(new Error('refused'));
    render(<Page start={bolt} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Bolt Technology OÜ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
  });
});
