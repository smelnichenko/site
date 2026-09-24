import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiPersonDetail from './MasiPersonDetail';
import { renderAt } from './testUtils';
import { formatDate } from './format';
import type { MasiActivity, MasiPerson } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiPerson: vi.fn(),
  fetchMasiActivity: vi.fn(),
  patchMasiPerson: vi.fn(),
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
    { companyId: 3, companyName: 'Nortal AS', agency: false, role: 'POSTED_FOR', evidence: 'LISTING',
      evidenceRef: 'listing 1', since: '2026-09-18T08:00:00Z', until: null, where: 'SOMEWHERE_ELSE' },
    { companyId: 9, companyName: 'Stafferty OÜ', agency: true, role: 'REPRESENTS', evidence: 'REGISTER',
      evidenceRef: null, since: '2020-01-02T00:00:00Z', until: '2026-09-20T00:00:00Z', where: 'THE_COMPANYS' },
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
});

describe('MasiPersonDetail', () => {
  it('shows who they are, every tie with who says so, and what happened with them', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({ content: [called], page: 0, size: 20, totalElements: 1 });
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
    expect(within(nortal).getByRole('link', { name: 'Log with them about Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/activity?person=20&company=3',
    );
    expect(screen.getByText('Called about the Java role')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'all of it' })).toHaveAttribute('href', '/masi/activity?person=20');
  });

  it('saves only what was changed, and shows the refusal the server gives', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 });
    vi.mocked(api.patchMasiPerson).mockResolvedValueOnce({ ...kadri, title: 'Head of Talent', userNote: 'prefers mail' });
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
      expect(api.patchMasiPerson).toHaveBeenCalledWith(20, { title: 'Head of Talent', userNote: 'prefers mail' }),
    );
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    vi.mocked(api.patchMasiPerson).mockRejectedValueOnce(new Error('a no-reply address reaches nobody'));
    await userEvent.clear(screen.getByLabelText('Address'));
    await userEvent.type(screen.getByLabelText('Address'), 'noreply@cv.ee');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('a no-reply address reaches nobody')).toBeInTheDocument();
  });

  it('marks them not to be contacted, and back', async () => {
    vi.mocked(api.fetchMasiPerson).mockResolvedValue(kadri);
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 });
    vi.mocked(api.patchMasiPerson).mockResolvedValueOnce({ ...kadri, doNotContact: true });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    await userEvent.click(await screen.findByRole('button', { name: 'Do not contact' }));
    await waitFor(() => expect(api.patchMasiPerson).toHaveBeenCalledWith(20, { doNotContact: true }));
    expect(await screen.findByRole('button', { name: 'Allow contact' })).toBeInTheDocument();
    expect(screen.getByText('do not contact', { selector: '.status-badge' })).toBeInTheDocument();
  });

  it('says so when the person cannot be loaded', async () => {
    vi.mocked(api.fetchMasiPerson).mockRejectedValue(new Error('person 20 not found'));
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 });
    renderAt('/masi/persons/20', '/masi/persons/:id', <MasiPersonDetail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('person 20 not found');
  });
});
