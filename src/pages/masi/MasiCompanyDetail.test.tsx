import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import MasiCompanyDetail from './MasiCompanyDetail';
import { mapsUrl } from './format';
import { agencyText } from './register';
import { job, renderAt } from './testUtils';
import type { MasiContact, MasiPerson, MasiRegisterCandidates } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiCompany: vi.fn(),
  fetchMasiJobs: vi.fn(),
  fetchMasiCompanyPersons: vi.fn(),
  patchMasiCompany: vi.fn(),
  patchMasiPerson: vi.fn(),
  fetchMasiRegisterPlacement: vi.fn(),
  fetchMasiRegisterCandidates: vi.fn(),
  placeMasiCompany: vi.fn(),
  takeBackMasiPlacement: vi.fn(),
  fetchMasiCompanyContacts: vi.fn(),
  fetchMasiCompanyFigures: vi.fn(),
  patchMasiContact: vi.fn(),
  fetchMasiCompanyVisits: vi.fn(),
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
  address: null as string | null,
  tags: null,
  status: 'ACTIVE',
  origin: 'DISCOVERED',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  registerSeenAt: null,
  blacklisted: false,
  agency: false,
  agencyMark: null,
  userNote: null,
};
const kati: MasiPerson = {
  id: 5,
  name: 'Kati Kask',
  email: 'kati@stafferty.example',
  phone: null,
  title: 'Recruiter',
  doNotContact: false,
  userNote: null,
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  ties: [
    {
      companyId: 3,
      companyName: 'Nortal AS',
      agency: false,
      role: 'POSTED_FOR',
      evidence: 'LISTING',
      evidenceRef: 'listing 1',
      since: '2026-09-18T08:00:00Z',
      until: null,
      where: 'SOMEWHERE_ELSE',
      contactId: 5,
    },
    {
      companyId: 3,
      companyName: 'Nortal AS',
      agency: false,
      role: 'POSTED_FOR',
      evidence: 'LISTING',
      evidenceRef: 'listing 2',
      since: '2026-09-18T08:00:00Z',
      until: null,
      where: 'SOMEWHERE_ELSE',
      contactId: 5,
    },
    {
      companyId: 44,
      companyName: 'Stafferty',
      agency: true,
      role: 'WORKS_AT',
      evidence: 'OPERATOR',
      evidenceRef: null,
      since: '2026-09-18T08:00:00Z',
      until: null,
      where: 'THE_COMPANYS',
      contactId: 5,
    },
  ],
};

beforeEach(() => {
  vi.mocked(api.fetchMasiCompany).mockReset();
  vi.mocked(api.fetchMasiJobs).mockReset();
  vi.mocked(api.fetchMasiCompanyPersons).mockReset();
  vi.mocked(api.patchMasiCompany).mockReset();
  vi.mocked(api.patchMasiPerson).mockReset();
  vi.mocked(api.fetchMasiRegisterPlacement).mockReset();
  vi.mocked(api.fetchMasiRegisterCandidates).mockReset();
  vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue(null);
  vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue({
    indexed: true,
    truncated: false,
    candidates: [],
  });
  vi.mocked(api.fetchMasiCompanyContacts).mockReset();
  vi.mocked(api.fetchMasiCompanyFigures).mockReset();
  vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({ quarters: [] });
  vi.mocked(api.patchMasiContact).mockReset();
  vi.mocked(api.fetchMasiCompanyVisits).mockReset();
  vi.mocked(api.placeMasiCompany).mockReset();
  vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(null);
  vi.mocked(api.fetchMasiCompanyContacts).mockResolvedValue({
    content: [],
    page: 0,
    size: 200,
    totalElements: 0,
  });
});

const desk: MasiContact = {
  id: 91,
  companyId: 3,
  companyName: 'Nortal AS',
  kind: 'GENERIC',
  name: null,
  title: null,
  email: 'jobs@nortal.example',
  phone: null,
  origin: 'FROM_LISTING',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  doNotContact: false,
  userNote: null,
  personId: null,
};

/** A visit whose site names a registered company masi holds: the code handed to the register card. */
const heldVisits = {
  latest: {
    runAt: '2026-09-27T09:00:00Z',
    outcome: 'CODE_HELD' as const,
    candidateUrl: 'https://nortal.ee/',
    evidence: 'nortal.ee names Nortal Grupp AS (12345678), a company masi holds',
    adoptedCode: null,
    careersUrl: null,
    atsVendor: null,
    requests: 2,
    cut: false,
    foundBy: 'CONTACT' as const,
    triedUrl: null,
    namedCode: '12345678',
  },
  attempt: null,
  visiting: false,
};
const registered = (code: string, name: string) => ({
  registryCode: code,
  name,
  legalForm: 'AS',
  emtakCode: '62011',
  hqCity: 'Tallinn',
  sizeBand: '250+',
  website: null,
  how: 'CODE' as const,
  sure: false,
  employerForm: true,
  heldById: null,
  heldByName: null,
});
const noJobs = { content: [], page: 0, size: 100, totalElements: 0 };

describe('MasiCompanyDetail', () => {
  it('shows the company, its open and closed jobs and its people; blacklists and flags a person through the API', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        job,
        { ...job, id: 9, title: 'Second open role' },
        { ...job, id: 8, title: 'Old role', status: 'CLOSED', closedAt: '2026-09-01T00:00:00Z' },
      ],
      page: 0,
      size: 100,
      totalElements: 3,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([kati]);
    vi.mocked(api.patchMasiCompany).mockResolvedValue({ ...company, blacklisted: true });
    vi.mocked(api.patchMasiPerson).mockResolvedValue({ ...kati, doNotContact: true });
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(await screen.findByText('Nortal AS')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
      company: 3,
      status: 'ALL',
    });
    expect(screen.getByText('2 open · 1 closed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'all in the registry' })).toHaveAttribute(
      'href',
      '/masi/jobs?company=3&status=ALL',
    );
    expect(screen.getByRole('link', { name: 'Old role' })).toHaveAttribute('href', '/masi/jobs/8');
    expect(api.fetchMasiCompanyPersons).toHaveBeenCalledWith(3, expect.anything());
    const people = screen.getByTestId('company-people');
    expect(within(people).getByRole('link', { name: 'Kati Kask' })).toHaveAttribute(
      'href',
      '/masi/persons/5',
    );
    // what she is HERE, not at her agency: two listings say so, and her address is not the company's
    expect(within(people).getByText('posted for ×2')).toBeInTheDocument();
    expect(within(people).queryByText(/works at/)).not.toBeInTheDocument();
    expect(within(people).getByText('writes from elsewhere')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'in the people list' })).toHaveAttribute(
      'href',
      '/masi/persons?company=3',
    );
    // a code from the register import itself has no placement to take back, so no register card
    // the card was there and asked: it says nothing because there is nothing to take back, not because it is missing
    await waitFor(() =>
      expect(api.fetchMasiRegisterPlacement).toHaveBeenCalledWith(3, expect.anything()),
    );
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ok to contact' }));
    await waitFor(() =>
      expect(api.patchMasiPerson).toHaveBeenCalledWith(5, { doNotContact: true }),
    );
    expect(screen.getByRole('button', { name: 'do not contact' })).toBeInTheDocument();
    // the company form saves what was typed
    vi.mocked(api.patchMasiCompany).mockResolvedValueOnce({
      ...company,
      userNote: 'ask Kati',
      careersUrl: 'https://nortal.com/jobs',
    });
    await userEvent.clear(screen.getByLabelText('Careers URL'));
    await userEvent.type(screen.getByLabelText('Careers URL'), 'https://nortal.com/jobs');
    await userEvent.type(screen.getByLabelText('Your note'), 'ask Kati');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.patchMasiCompany).toHaveBeenCalledWith(3, {
        userNote: 'ask Kati',
        careersUrl: 'https://nortal.com/jobs',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Blacklist' }));
    await waitFor(() =>
      expect(api.patchMasiCompany).toHaveBeenCalledWith(3, { blacklisted: true }),
    );
    expect(screen.getByText('Blacklisted: no packages for this company')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lift blacklist' })).toBeInTheDocument();
  });

  it('shows the registered address with a link that opens it on Google Maps, and none without one', async () => {
    const address = 'Harju maakond, Tallinn, Kesklinna linnaosa, Narva mnt 5, 10117';
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, address });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    const { unmount } = renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(await screen.findByText(address)).toBeInTheDocument();
    const map = screen.getByRole('link', { name: 'map' });
    expect(map).toHaveAttribute('href', mapsUrl(address));
    expect(map).toHaveAttribute('target', '_blank');
    expect(map).toHaveAttribute('rel', 'noopener noreferrer');
    unmount();

    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, address: null });
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(await screen.findByText('Nortal AS')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'map' })).not.toBeInTheDocument();
  });

  it("marks an agency, and hands the question back to the register once it is the operator's word", async () => {
    const labourHire = { ...company, emtakCode: '78201', agency: true, agencyMark: null };
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(labourHire);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(
      await screen.findByText('An agency — the register says so (EMTAK 78201)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Let the register decide' }),
    ).not.toBeInTheDocument();

    vi.mocked(api.patchMasiCompany).mockResolvedValueOnce({
      ...labourHire,
      agency: false,
      agencyMark: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Not an agency' }));
    await waitFor(() => expect(api.patchMasiCompany).toHaveBeenCalledWith(3, { agency: false }));
    expect(await screen.findByText('Not an agency — your mark')).toBeInTheDocument();

    vi.mocked(api.patchMasiCompany).mockResolvedValueOnce(labourHire);
    await userEvent.click(screen.getByRole('button', { name: 'Let the register decide' }));
    await waitFor(() =>
      expect(api.patchMasiCompany).toHaveBeenCalledWith(3, { agencyFromRegister: true }),
    );
    expect(
      await screen.findByText('An agency — the register says so (EMTAK 78201)'),
    ).toBeInTheDocument();
  });

  it('says whose word the agency flag is, in every case', () => {
    const base = { ...company, emtakCode: null, agency: false, agencyMark: null };
    expect(agencyText({ ...base, agencyMark: true, agency: true })).toBe('An agency — your mark');
    expect(agencyText({ ...base, agencyMark: false })).toBe('Not an agency — your mark');
    expect(agencyText({ ...base, agency: true, emtakCode: '78101' })).toBe(
      'An agency — the register says so (EMTAK 78101)',
    );
    expect(agencyText(base)).toBe('Not an agency — by the register');
    expect(agencyText({ ...base, registryCode: null })).toBe(
      'Not an agency — not placed on the register yet',
    );
  });

  it("lists the company's own addresses apart from its people, and flags one not to be written to", async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([kati]);
    // Kati's own contact row is her person's; the desk is nobody's
    vi.mocked(api.fetchMasiCompanyContacts).mockResolvedValue({
      content: [
        desk,
        {
          ...desk,
          id: 92,
          kind: 'PERSON',
          name: 'Kati Kask',
          email: 'kati@stafferty.example',
          personId: 5,
        },
      ],
      page: 0,
      size: 200,
      totalElements: 2,
    });
    vi.mocked(api.patchMasiContact).mockResolvedValue({ ...desk, doNotContact: true });
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    const addresses = await screen.findByTestId('company-addresses');
    expect(within(addresses).getByText('jobs@nortal.example')).toBeInTheDocument();
    expect(within(addresses).queryByText('kati@stafferty.example')).not.toBeInTheDocument();
    await userEvent.click(
      within(addresses).getByRole('button', { name: 'Do not contact jobs@nortal.example' }),
    );
    await waitFor(() =>
      expect(api.patchMasiContact).toHaveBeenCalledWith(91, { doNotContact: true }),
    );
    expect(
      await within(addresses).findByRole('button', {
        name: 'Allow contact at jobs@nortal.example',
      }),
    ).toBeInTheDocument();
  });

  it('shows no addresses card when every row is somebody', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([kati]);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    await screen.findByTestId('company-people');
    expect(screen.queryByTestId('company-addresses')).not.toBeInTheDocument();
  });

  it('reads everything again once a placement changes the company: the board it brought is among its people', async () => {
    const uncoded = { ...company, registryCode: null };
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(uncoded);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValueOnce([]).mockResolvedValue([kati]);
    vi.mocked(api.fetchMasiRegisterCandidates).mockResolvedValue({
      indexed: true,
      truncated: false,
      candidates: [
        {
          registryCode: '10391131',
          name: 'Nortal AS',
          legalForm: 'AS',
          emtakCode: '62011',
          hqCity: 'Tallinn',
          sizeBand: '250+',
          website: null,
          how: 'EXACT',
          sure: false,
          employerForm: true,
          heldById: null,
          heldByName: null,
        },
      ],
    });
    vi.mocked(api.placeMasiCompany).mockResolvedValue(company);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    expect(await screen.findByText('Nobody tied to this company yet.')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Nortal AS' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place it' }));
    await waitFor(() => expect(api.placeMasiCompany).toHaveBeenCalledWith(3, '10391131'));
    expect(await screen.findByRole('link', { name: 'Kati Kask' })).toBeInTheDocument();
  });

  it('hands a code its site names to the register card, which says what it is and asks before placing', async () => {
    const uncoded = { ...company, registryCode: null };
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(uncoded);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue({
      latest: {
        runAt: '2026-09-27T09:00:00Z',
        outcome: 'CODE_HELD',
        candidateUrl: 'https://nortal.ee/',
        evidence: 'nortal.ee names Nortal Grupp AS (12345678), a company masi holds',
        adoptedCode: null,
        careersUrl: null,
        atsVendor: null,
        requests: 2,
        cut: false,
        foundBy: 'CONTACT',
        triedUrl: null,
        namedCode: '12345678',
      },
      attempt: null,
      visiting: false,
    });
    const held = {
      registryCode: '12345678',
      name: 'Nortal Grupp AS',
      legalForm: 'AS',
      emtakCode: '62011',
      hqCity: 'Tallinn',
      sizeBand: '250+',
      website: 'https://nortal.ee/',
      how: 'CODE' as const,
      sure: false,
      employerForm: true,
      heldById: 40,
      heldByName: 'Nortal Grupp AS',
    };
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      Promise.resolve({ indexed: true, truncated: false, candidates: code ? [held] : [] }),
    );
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );

    await waitFor(() =>
      expect(api.fetchMasiRegisterCandidates).toHaveBeenCalledWith(
        3,
        expect.anything(),
        '12345678',
      ),
    );
    const confirm = await screen.findByRole('group', { name: 'Confirm the placement' });
    expect(confirm).toHaveTextContent('Nortal Grupp AS (reg. 12345678)');
    // the choice is made there: focus goes to it, and nothing is placed until the operator says so
    expect(within(confirm).getByRole('button', { name: 'Place it' })).toHaveFocus();
    expect(api.placeMasiCompany).not.toHaveBeenCalled();
  });

  it('reads everything again once a website is accepted', async () => {
    const bare = { ...company, registryCode: null, website: null };
    const accepted = { ...bare, website: 'https://nortal.com/' };
    // the page shows what it reads again, not what the PATCH answered: the read carries the website as stored
    const reread = { ...accepted, website: 'https://www.nortal.com/' };
    vi.mocked(api.fetchMasiCompany).mockResolvedValueOnce(bare).mockResolvedValue(reread);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue({
      latest: {
        runAt: '2026-09-27T09:00:00Z',
        outcome: 'UNCONFIRMED',
        candidateUrl: 'https://nortal.com/',
        evidence: 'nortal.com: no registry code',
        adoptedCode: null,
        careersUrl: null,
        atsVendor: null,
        requests: 2,
        cut: false,
        foundBy: 'GUESS',
        triedUrl: null,
        namedCode: null,
      },
      attempt: null,
      visiting: false,
    });
    vi.mocked(api.patchMasiCompany).mockResolvedValue(accepted);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Accept nortal.com as its website' }),
    );

    await waitFor(() => expect(api.fetchMasiCompany).toHaveBeenCalledTimes(2));
    expect(api.patchMasiCompany).toHaveBeenCalledWith(3, { website: 'https://nortal.com/' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'website' })).toHaveAttribute(
        'href',
        'https://www.nortal.com/',
      ),
    );
  });

  it('does not bring a handed-over code back to the confirmation once its placement is taken back', async () => {
    const uncoded = { ...company, registryCode: null };
    const placed = { ...company, registryCode: '12345678' };
    vi.mocked(api.fetchMasiCompany)
      .mockResolvedValueOnce(uncoded)
      .mockResolvedValueOnce(placed)
      .mockResolvedValue(uncoded);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      Promise.resolve({
        indexed: true,
        truncated: false,
        candidates: code ? [registered(code, 'Nortal Grupp AS')] : [],
      }),
    );
    vi.mocked(api.placeMasiCompany).mockResolvedValue(placed);
    vi.mocked(api.fetchMasiRegisterPlacement).mockResolvedValue({
      registryCode: '12345678',
      placedAt: '2026-09-27T10:00:00Z',
      priorWebsite: null,
      priorHqCity: null,
      priorEmtakCode: null,
      priorSizeBand: null,
    });
    vi.mocked(api.takeBackMasiPlacement).mockReset();
    vi.mocked(api.takeBackMasiPlacement).mockResolvedValue(uncoded);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Place it' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Take back' }));
    await waitFor(() => expect(api.takeBackMasiPlacement).toHaveBeenCalledWith(3));
    // the card asks the register by name again, as for any company without a code
    await waitFor(() =>
      expect(
        vi.mocked(api.fetchMasiRegisterCandidates).mock.calls.filter((c) => c[2] === undefined),
      ).toHaveLength(2),
    );

    const byCode = vi.mocked(api.fetchMasiRegisterCandidates).mock.calls.filter((c) => c[2]);
    expect(byCode, 'the code is looked up once: when the operator asked').toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
  });

  it('does not carry a handed-over code to the company a placement merged this one into', async () => {
    const survivor = { ...company, id: 17, name: 'Nortal Grupp AS', registryCode: null };
    vi.mocked(api.fetchMasiCompany).mockImplementation((id) =>
      Promise.resolve(id === 17 ? survivor : { ...company, registryCode: null }),
    );
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      Promise.resolve({
        indexed: true,
        truncated: false,
        candidates: code ? [registered(code, 'Nortal Grupp AS')] : [],
      }),
    );
    vi.mocked(api.placeMasiCompany).mockResolvedValue(survivor);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Place it' }));
    expect(await screen.findByRole('status')).toHaveTextContent('is this company now');
    await waitFor(() =>
      expect(api.fetchMasiRegisterCandidates).toHaveBeenCalledWith(17, expect.anything()),
    );

    expect(vi.mocked(api.fetchMasiRegisterCandidates).mock.calls.filter((c) => c[2])).toEqual([
      [3, expect.anything(), '12345678'],
    ]);
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
  });

  it("holds the register card's own choices while a handed-over code is looked up, and only until then", async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, registryCode: null });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    let answer: (a: MasiRegisterCandidates) => void = () => {};
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      code
        ? new Promise((resolve) => {
            answer = resolve;
          })
        : Promise.resolve({
            indexed: true,
            truncated: false,
            candidates: [registered('10391131', 'Nortal AS')],
          }),
    );
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    const choose = await screen.findByRole('button', { name: 'Choose Nortal AS' });
    await userEvent.click(choose);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await userEvent.type(screen.getByLabelText('Or a registry code'), '87654321');
    const typed = screen.getByRole('button', { name: 'Look up' });
    expect([choose, cancel, typed].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);

    await userEvent.click(
      screen.getByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );

    // its answer would replace what is chosen meanwhile
    await waitFor(() => expect(choose).toBeDisabled());
    expect(cancel).toBeDisabled();
    expect(typed).toBeDisabled();

    answer({ indexed: true, truncated: false, candidates: [] });
    expect(await screen.findByRole('alert')).toHaveTextContent('no company with the code 12345678');
    expect(choose).toBeEnabled();
    expect(typed).toBeEnabled();
  });

  it('says a handed-over look-up failed, brings it into view, and lets the card be used again', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, registryCode: null });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      code
        ? Promise.reject(new Error('the register is being read'))
        : Promise.resolve({
            indexed: true,
            truncated: false,
            candidates: [registered('10391131', 'Nortal AS')],
          }),
    );
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent('the register is being read');
    expect(said).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Choose Nortal AS' })).toBeEnabled();
  });

  it('looks the same code up again when asked again', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, registryCode: null });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, _signal, code) =>
      Promise.resolve({
        indexed: true,
        truncated: false,
        candidates: code ? [registered(code, 'Nortal Grupp AS')] : [],
      }),
    );
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    const lookUp = await screen.findByRole('button', {
      name: 'Look up reg. 12345678 in the register',
    });

    await userEvent.click(lookUp);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm the placement' })).not.toBeInTheDocument();
    await userEvent.click(lookUp);

    expect(await screen.findByRole('group', { name: 'Confirm the placement' })).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiRegisterCandidates).mock.calls.filter((c) => c[2])).toHaveLength(
      2,
    );
  });

  it('says nothing of a handed-over look-up it abandoned for a newer one', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, registryCode: null });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    let asked = 0;
    let answer: (a: MasiRegisterCandidates) => void = () => {};
    vi.mocked(api.fetchMasiRegisterCandidates).mockImplementation((_id, signal, code) => {
      if (!code) return Promise.resolve({ indexed: true, truncated: false, candidates: [] });
      asked++;
      if (asked === 1) {
        return new Promise((_resolve, reject) =>
          signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          ),
        );
      }
      return new Promise((resolve) => {
        answer = resolve;
      });
    });
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    const lookUp = await screen.findByRole('button', {
      name: 'Look up reg. 12345678 in the register',
    });

    await userEvent.click(lookUp);
    await userEvent.click(lookUp);
    await waitFor(() => expect(asked).toBe(2));
    // a task later the abandoned look-up's rejection is in
    await new Promise((resolve) => setTimeout(resolve, 0));

    // while the new look-up is out, the abandoned one says nothing
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    answer({
      indexed: true,
      truncated: false,
      candidates: [registered('12345678', 'Nortal Grupp AS')],
    });
    expect(await screen.findByRole('group', { name: 'Confirm the placement' })).toBeInTheDocument();
  });

  it('brings a handed-over code the register does not have into view', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue({ ...company, registryCode: null });
    vi.mocked(api.fetchMasiJobs).mockResolvedValue(noJobs);
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(heldVisits);
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent('The register has no company with the code 12345678.');
    // the button that asked is above the register card: the answer is brought to the operator
    expect(said).toHaveFocus();
  });

  it('says where a merged company went', async () => {
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([]);
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/masi/companies/3', state: { mergedFrom: 'Nortal' } }]}
      >
        <Routes>
          <Route path="/masi/companies/:id" element={<MasiCompanyDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('status')).toHaveTextContent('“Nortal” is this company now');
  });

  it('says what a person is here even when their first tie is to another company, and shows a refused flag', async () => {
    const elsewhereFirst: MasiPerson = {
      ...kati,
      ties: [kati.ties[2], kati.ties[0], kati.ties[1]],
    };
    vi.mocked(api.fetchMasiCompany).mockResolvedValue(company);
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiCompanyPersons).mockResolvedValue([elsewhereFirst]);
    vi.mocked(api.patchMasiPerson).mockRejectedValue(new Error('saving refused'));
    renderAt('/masi/companies/3', '/masi/companies/:id', <MasiCompanyDetail />);
    const people = await screen.findByTestId('company-people');
    expect(within(people).getByText('posted for ×2')).toBeInTheDocument();
    expect(within(people).getByText('writes from elsewhere')).toBeInTheDocument();
    expect(within(people).queryByText(/works at/)).not.toBeInTheDocument();
    expect(within(people).queryByText("the company's own address")).not.toBeInTheDocument();
    await userEvent.click(within(people).getByRole('button', { name: 'ok to contact' }));
    expect(await screen.findByText('saving refused')).toBeInTheDocument();
  });
});
