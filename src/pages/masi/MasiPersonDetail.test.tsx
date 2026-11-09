import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import MasiPersonDetail from './MasiPersonDetail';
import { renderAt } from './testUtils';
import { formatDate } from './format';
import type { MasiActivity, MasiPerson } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiPerson: vi.fn(),
  fetchMasiActivity: vi.fn(),
  patchMasiPerson: vi.fn(),
  fetchMasiContactPictures: vi.fn(),
  fetchMasiPictureTries: vi.fn(),
  fetchMasiContactPictureBlob: vi.fn(),
}));
const api = await import('../../services/api');

const kadri: MasiPerson = {
  id: 20,
  name: 'Kadri Kask',
  email: 'kadri@stafferty.example',
  phone: '+372 5555 5555',
  title: 'Recruiter',
  doNotContact: false,
  userNote: null,
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-23T09:00:00Z',
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
      companyId: 9,
      companyName: 'Stafferty OÜ',
      agency: true,
      role: 'REPRESENTS',
      evidence: 'REGISTER',
      evidenceRef: null,
      since: '2020-01-02T00:00:00Z',
      until: '2026-09-20T00:00:00Z',
      where: 'THE_COMPANYS',
      contactId: 5,
    },
  ],
};
const called: MasiActivity = {
  id: 70,
  at: '2026-09-22T10:00:00Z',
  kind: 'CALL',
  origin: 'OPERATOR',
  jobId: null,
  jobTitle: null,
  companyId: 3,
  companyName: 'Nortal AS',
  contactId: 5,
  contactName: 'Kadri Kask',
  personId: 20,
  packageId: null,
  summary: 'Called about the Java role',
  detail: null,
  mine: true,
};

beforeEach(() => {
  vi.mocked(api.fetchMasiPerson).mockReset();
  vi.mocked(api.fetchMasiActivity).mockReset();
  vi.mocked(api.patchMasiPerson).mockReset();
  vi.mocked(api.fetchMasiContactPictures).mockReset().mockResolvedValue([]);
  vi.mocked(api.fetchMasiPictureTries)
    .mockReset()
    .mockResolvedValue({ triesLeft: 0, contacts: [] });
  vi.mocked(api.fetchMasiContactPictureBlob).mockReset();
});

describe('MasiPersonDetail', () => {
  it('shows who they are, every tie with who says so, and what happened with them', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [called],
      page: 0,
      size: 20,
      totalElements: 1,
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(await screen.findByText('Kadri Kask', { selector: '.card-title' })).toBeInTheDocument();
    expect(api.fetchMasiActivity).toHaveBeenCalledWith({ person: 20, size: 20 }, expect.anything());
    expect(screen.getByLabelText('Address')).toHaveValue('kadri@stafferty.example');

    const ties = screen.getByTestId('person-ties');
    const nortal = within(ties).getByRole('row', { name: /Nortal AS/ });
    expect(within(nortal).getByText('posted for')).toBeInTheDocument();
    expect(within(nortal).getByText('a listing')).toBeInTheDocument();
    expect(within(nortal).getByText('writes from elsewhere')).toBeInTheDocument();
    const board = within(ties).getByRole('row', { name: /Stafferty OÜ/ });
    expect(within(board).getByText('represents')).toBeInTheDocument();
    expect(within(board).getByText('the register')).toBeInTheDocument();
    expect(within(board).getByText('agency')).toBeInTheDocument();
    expect(within(board).getByText(formatDate('2026-09-20T00:00:00Z'))).toBeInTheDocument(); // the tie ended
    expect(within(nortal).getAllByText('—')).toHaveLength(1); // and this one holds

    // the log goes through the company: the row is with the person's contact there
    expect(
      within(nortal).getByRole('link', { name: 'Log with them about Nortal AS' }),
    ).toHaveAttribute('href', '/masi/activity?person=20&company=3');
    expect(screen.getByText('Called about the Java role')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'all of it' })).toHaveAttribute(
      'href',
      '/masi/activity?person=20',
    );
  });

  it('saves only what was changed, and shows the refusal the server gives', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.patchMasiPerson).mockResolvedValueOnce({
      ...kadri,
      title: 'Head of Talent',
      userNote: 'prefers mail',
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    await screen.findByText('Nothing logged with this person.');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Nothing changed')).toBeInTheDocument();
    expect(api.patchMasiPerson).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Head of Talent');
    await userEvent.type(screen.getByLabelText('Your note'), 'prefers mail');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.patchMasiPerson).toHaveBeenCalledWith(20, {
        title: 'Head of Talent',
        userNote: 'prefers mail',
      }),
    );
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    vi.mocked(api.patchMasiPerson).mockRejectedValueOnce(
      new Error('a no-reply address reaches nobody'),
    );
    await userEvent.clear(screen.getByLabelText('Address'));
    await userEvent.type(screen.getByLabelText('Address'), 'noreply@cv.ee');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('a no-reply address reaches nobody')).toBeInTheDocument();
  });

  it('marks them not to be contacted, and back', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.patchMasiPerson).mockResolvedValueOnce({ ...kadri, doNotContact: true });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    await userEvent.click(await screen.findByRole('button', { name: 'Do not contact' }));
    await waitFor(() =>
      expect(api.patchMasiPerson).toHaveBeenCalledWith(20, { doNotContact: true }),
    );
    expect(await screen.findByRole('button', { name: 'Allow contact' })).toBeInTheDocument();
    expect(screen.getByText('do not contact', { selector: '.status-badge' })).toBeInTheDocument();
  });

  it('says so when the person cannot be loaded', async () => {
    vi.mocked(api.fetchMasiPerson).mockRejectedValue(new Error('person 20 not found'));
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('person 20 not found');
  });

  it('offers a log once per company, and only where they are a contact — a tie by word alone has nowhere to write', async () => {
    const tie = kadri.ties[0];
    vi.mocked(api.fetchMasiPerson).mockResolvedValue({
      ...kadri,
      ties: [
        tie,
        { ...tie, evidenceRef: 'listing 2' },
        {
          ...tie,
          companyId: 44,
          companyName: 'Met At A Meetup OÜ',
          role: 'TALKED_TO',
          evidence: 'OPERATOR',
          contactId: null,
        },
      ],
    });
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(
      await screen.findAllByRole('link', { name: 'Log with them about Nortal AS' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('link', { name: 'Log with them about Met At A Meetup OÜ' }),
    ).not.toBeInTheDocument();
  });

  it('marks them not to be contacted without also sending the edits typed and not saved', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.patchMasiPerson).mockResolvedValue({ ...kadri, doNotContact: true });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    await userEvent.type(await screen.findByLabelText('Your note'), 'half-typed');
    await userEvent.click(screen.getByRole('button', { name: 'Do not contact' }));
    await waitFor(() =>
      expect(api.patchMasiPerson).toHaveBeenCalledWith(20, { doNotContact: true }),
    );
    expect(api.patchMasiPerson).toHaveBeenCalledTimes(1);
  });

  it('shows what the server kept, not what was typed — an address is stored as the server normalised it', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.patchMasiPerson).mockResolvedValue({ ...kadri, email: 'kadri@x.ee' });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    await userEvent.clear(await screen.findByLabelText('Address'));
    await userEvent.type(screen.getByLabelText('Address'), 'KADRI@X.EE');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Address')).toHaveValue('kadri@x.ee'));
  });

  it("keeps what was typed when the flag is toggled, and forgets one person's message on the next person's page", async () => {
    vi.mocked(api.fetchMasiPerson).mockImplementation((id: number) =>
      Promise.resolve({ ...kadri, id, name: id === 21 ? 'Mari Maasikas' : kadri.name }),
    );
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.patchMasiPerson).mockResolvedValue({ ...kadri, doNotContact: true });
    function Next() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => void navigate('/masi/persons/21')}>
          next person
        </button>
      );
    }
    render(
      <MemoryRouter initialEntries={['/masi/persons/20']}>
        <Next />
        <Routes>
          <Route path="/masi/persons/:id" element={<MasiPersonDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText('Your note'), 'half-typed');
    await userEvent.click(screen.getByRole('button', { name: 'Do not contact' }));
    expect(await screen.findByText('Marked: do not contact')).toBeInTheDocument();
    expect(screen.getByLabelText('Your note')).toHaveValue('half-typed');

    await userEvent.click(screen.getByRole('button', { name: 'next person' }));
    expect(
      await screen.findByText('Mari Maasikas', { selector: '.card-title' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Marked: do not contact')).not.toBeInTheDocument();
  });

  it('says where masi found them: the profile, what it said, the posting that named them, and their picture', async () => {
    const seen = { firstSeenAt: '2026-10-23T08:00:00Z', lastSeenAt: '2026-11-07T02:00:00Z' };
    const filippos: MasiPerson = {
      ...kadri,
      id: 21,
      name: 'Filippos Malandrakis',
      email: null,
      phone: null,
      title: null,
      ties: [],
      found: [
        {
          contactId: 719,
          origin: 'FROM_WEB',
          source: 'github',
          sourceName: 'GitHub people',
          profileUrl: 'https://github.com/filippos47',
          linkedinUrl: null,
          title: 'Backend developer, Go and Kubernetes',
          email: null,
          companyId: null,
          companyName: null,
          listingId: null,
          listingUrl: null,
          listingTitle: null,
          ...seen,
          pictures: 1,
        },
        {
          contactId: 720,
          origin: 'FROM_LISTING',
          source: 'cvee',
          sourceName: 'cv.ee',
          profileUrl: null,
          linkedinUrl: 'https://www.linkedin.com/in/filippos',
          title: 'Recruiter',
          email: 'filippos@nortal.example',
          companyId: 3,
          companyName: 'Nortal AS',
          listingId: 77,
          listingUrl: 'https://cv.ee/job/77',
          listingTitle: 'Java developer',
          ...seen,
          pictures: 0,
        },
      ],
    };
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(filippos);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([
      {
        id: 5,
        source: 'GITHUB',
        sourceUrl: 'https://github.com/filippos47.png',
        contentType: 'image/png',
        size: 3,
        capturedAt: '2026-11-07T02:00:00Z',
      },
    ] as never);
    vi.mocked(api.fetchMasiContactPictureBlob).mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])]),
    );
    URL.createObjectURL = vi.fn(() => 'blob:filippos');
    renderAt('/masi/persons/21', '/masi/persons/:id', <MasiPersonDetail />);

    const found = await screen.findByTestId('person-found');
    const github = within(found).getByRole('link', { name: 'github.com/filippos47' });
    expect(github).toHaveAttribute('href', 'https://github.com/filippos47');
    expect(github).toHaveAttribute('target', '_blank');
    expect(within(found).getByText('Backend developer, Go and Kubernetes')).toBeInTheDocument();
    expect(within(found).getByText('GitHub people')).toBeInTheDocument();
    expect(within(found).getByRole('link', { name: 'Java developer' })).toHaveAttribute(
      'href',
      'https://cv.ee/job/77',
    );
    expect(within(found).getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/companies/3',
    );
    expect(within(found).getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/filippos',
    );
    expect(within(found).getByText('filippos@nortal.example')).toBeInTheDocument();
    // the picture: asked of the record that has one, not of the one that has none, and shown beside the name
    expect(
      await screen.findByRole('button', { name: 'Open the picture of Filippos Malandrakis' }),
    ).toBeInTheDocument();
    expect(api.fetchMasiContactPictures).toHaveBeenCalledWith(719, expect.anything());
    expect(api.fetchMasiContactPictures).not.toHaveBeenCalledWith(720, expect.anything());
  });

  it('says so when masi holds no record of where it found them', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue({ ...kadri, found: [] });
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(await screen.findByText('No record of where masi found them.')).toBeInTheDocument();
  });

  it('shows their GitHub: where they are, what they write, their repositories, and the people they are connected to', async () => {
    const vello: MasiPerson = {
      ...kadri,
      id: 22,
      name: 'Vello Dev',
      ties: [],
      found: [
        {
          contactId: 801,
          origin: 'FROM_WEB',
          source: 'github',
          sourceName: 'GitHub people',
          profileUrl: 'https://github.com/vello',
          linkedinUrl: null,
          title: 'Go and Kubernetes',
          email: null,
          companyId: null,
          companyName: null,
          listingId: null,
          listingUrl: null,
          listingTitle: null,
          firstSeenAt: '2026-10-23T08:00:00Z',
          lastSeenAt: '2026-11-07T02:00:00Z',
          pictures: 0,
          githubLogin: 'vello',
          profile: {
            location: 'Tallinn',
            websiteUrl: 'https://vello.dev',
            isHireable: true,
            status: { message: 'Open to work', indicatesLimitedAvailability: false },
            followers: { totalCount: 120 },
            following: { totalCount: 40 },
            socialAccounts: {
              nodes: [{ provider: 'LINKEDIN', url: 'https://www.linkedin.com/in/vello' }],
            },
            organizations: { nodes: [{ login: 'bolt', name: 'Bolt' }] },
            repositories: {
              totalCount: 3,
              nodes: [
                {
                  name: 'tiny',
                  url: 'https://github.com/vello/tiny',
                  stargazerCount: 1,
                  primaryLanguage: { name: 'Go' },
                },
                {
                  name: 'bus-api',
                  url: 'https://github.com/vello/bus-api',
                  description: 'Tallinn buses',
                  stargazerCount: 42,
                  primaryLanguage: { name: 'Go' },
                },
                {
                  name: 'site',
                  url: 'https://github.com/vello/site',
                  stargazerCount: 50,
                  primaryLanguage: { name: 'TypeScript' },
                },
              ],
            },
            contributionsCollection: { contributionCalendar: { totalContributions: 812 } },
            readme: { object: { text: '# Hi, I am Vello' } },
          },
        },
      ],
      connections: [
        { personId: 30, name: 'Anna Tamm', follows: true, followedBy: true, sameAddress: false },
        { personId: 31, name: 'Carl Kask', follows: false, followedBy: true, sameAddress: false },
        { personId: 32, name: 'V. Dev', follows: false, followedBy: false, sameAddress: true },
        { personId: 33, name: 'Dora Mets', follows: true, followedBy: false, sameAddress: false },
        {
          personId: 34,
          name: 'Eva Face',
          follows: false,
          followedBy: false,
          sameAddress: false,
          faceDistance: 0.322,
          samePicture: false,
        },
        {
          personId: 35,
          name: 'Fred Picture',
          follows: true,
          followedBy: false,
          sameAddress: false,
          faceDistance: null,
          samePicture: true,
        },
      ],
    };
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(vello);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/persons/22', '/masi/persons/:id', <MasiPersonDetail />);

    const gh = await screen.findByTestId('person-github');
    expect(within(gh).getByText('Tallinn')).toBeInTheDocument();
    expect(within(gh).getByRole('link', { name: 'vello.dev' })).toHaveAttribute(
      'href',
      'https://vello.dev',
    );
    expect(within(gh).getByText('open to hire')).toBeInTheDocument();
    expect(within(gh).getByText('Open to work')).toBeInTheDocument();
    expect(within(gh).getByText(/120 followers/)).toBeInTheDocument();
    expect(within(gh).getByText(/812 contributions/)).toBeInTheDocument();
    // languages by how many of their repositories use them, the most first
    expect(within(gh).getByTestId('github-languages')).toHaveTextContent('Go 2, TypeScript 1');
    // repositories by stars, the most first, each a link
    const repos = within(gh).getAllByRole('link', { name: /^(bus-api|site|tiny)$/ });
    expect(repos.map((a) => a.textContent)).toEqual(['site', 'bus-api', 'tiny']);
    expect(within(gh).getByRole('link', { name: 'Bolt' })).toHaveAttribute(
      'href',
      'https://github.com/bolt',
    );
    expect(within(gh).getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/vello',
    );
    expect(within(gh).getByText('# Hi, I am Vello')).toBeInTheDocument();

    const connections = screen.getByTestId('person-connections');
    const anna = within(connections).getByRole('row', { name: /Anna Tamm/ });
    expect(within(anna).getByRole('link', { name: 'Anna Tamm' })).toHaveAttribute(
      'href',
      '/masi/persons/30',
    );
    expect(within(anna).getByText('follow each other')).toBeInTheDocument();
    expect(
      within(within(connections).getByRole('row', { name: /Carl Kask/ })).getByText(
        'follows this person',
      ),
    ).toBeInTheDocument();
    expect(
      within(within(connections).getByRole('row', { name: /V\. Dev/ })).getByText(
        'same commit address',
      ),
    ).toBeInTheDocument();
    // a picture only says "possibly", and says how near; two ways of being connected are both said
    expect(
      within(within(connections).getByRole('row', { name: /Eva Face/ })).getByText(
        'possible connection: similar face (distance 0.32)',
      ),
    ).toBeInTheDocument();
    expect(
      within(within(connections).getByRole('row', { name: /Fred Picture/ })).getByText(
        'followed by this person, possible connection: same picture',
      ),
    ).toBeInTheDocument();
  });

  it('shows no GitHub card for a record GitHub has not given a profile, and says when there are no connections', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue({ ...kadri, found: [], connections: [] });
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
    });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(await screen.findByText('No connections masi knows of.')).toBeInTheDocument();
    expect(screen.queryByTestId('person-github')).not.toBeInTheDocument();
  });
});
