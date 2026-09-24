import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiActivity from './MasiActivity';
import type { MasiActivity as Row } from '../../services/api';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiActivity: vi.fn(),
  logMasiActivity: vi.fn(),
  MASI_ACTIVITY_KINDS: [
    'CALL',
    'SENT_MESSAGE',
    'RECEIVED_MESSAGE',
    'INTERVIEW',
    'OFFER',
    'REJECTED',
    'NOTE',
  ],
}));
const api = await import('../../services/api');

const rows: Row[] = [
  {
    id: 3,
    at: '2026-09-22T09:30:00Z',
    kind: 'CALL',
    origin: 'OPERATOR',
    jobId: 7,
    jobTitle: 'Senior Java Developer',
    companyId: 3,
    companyName: 'Nortal AS',
    contactId: 11,
    contactName: 'Mari Maasikas',
    personId: 40,
    packageId: null,
    summary: 'Screening call',
    detail: '30 min, next: tech interview',
    mine: true,
  },
  {
    id: 2,
    at: '2026-09-21T06:00:00Z',
    kind: 'APPLIED',
    origin: 'SYSTEM',
    jobId: 7,
    jobTitle: 'Senior Java Developer',
    companyId: 3,
    companyName: 'Nortal AS',
    contactId: null,
    contactName: null,
    personId: null,
    packageId: 11,
    summary: 'Senior Java Developer',
    detail: null,
    mine: true,
  },
  {
    id: 1,
    at: '2026-09-18T08:00:00Z',
    kind: 'COLLECTED',
    origin: 'SYSTEM',
    jobId: 7,
    jobTitle: 'Senior Java Developer',
    companyId: 3,
    companyName: 'Nortal AS',
    contactId: null,
    contactName: null,
    personId: null,
    packageId: null,
    summary: 'Senior Java Developer',
    detail: null,
    mine: false,
  },
];

beforeEach(() => {
  vi.mocked(api.fetchMasiActivity).mockReset();
  vi.mocked(api.logMasiActivity).mockReset();
});

describe('MasiActivity', () => {
  it('lists the log newest first with its links, and puts the filters in the URL', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: rows,
      page: 0,
      size: 50,
      totalElements: 3,
    });
    renderAt('/masi/activity?day=2026-09-22', '/masi/activity', <MasiActivity />);
    const list = await screen.findByRole('list', { name: 'Activity' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('call');
    expect(items[0]).toHaveTextContent('Screening call');
    expect(within(items[0]).getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
    expect(within(items[0]).getByRole('link', { name: 'Nortal AS' })).toHaveAttribute(
      'href',
      '/masi/companies/3',
    );
    expect(within(items[0]).getByRole('link', { name: 'Mari Maasikas' })).toHaveAttribute(
      'href',
      '/masi/persons/40', // the person the contact is
    );
    expect(within(items[1]).getByRole('link', { name: 'package' })).toHaveAttribute(
      'href',
      '/masi/packages/11',
    );
    expect(items[2]).toHaveTextContent('collected');
    // the day in the URL is the whole Tallinn day, sent as a half-open range
    expect(vi.mocked(api.fetchMasiActivity).mock.calls[0][0]).toMatchObject({
      from: '2026-09-21T21:00:00.000Z',
      to: '2026-09-22T21:00:00.000Z',
    });
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'CALL');
    await waitFor(() =>
      expect(api.fetchMasiActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'CALL', page: 0 }),
        expect.anything(),
      ),
    );
  });

  it('names a contact masi has not made a person of yet, without a link to a page that is not there', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [{ ...rows[0], personId: null, contactName: 'Unplaced Desk' }],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    renderAt('/masi/activity', '/masi/activity', <MasiActivity />);
    expect(await screen.findByText(/Unplaced Desk/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unplaced Desk' })).not.toBeInTheDocument();
  });

  it('logs a note from the form and shows it at the top', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    vi.mocked(api.logMasiActivity).mockResolvedValue({
      ...rows[0],
      id: 9,
      kind: 'NOTE',
      summary: 'Ping them Friday',
    });
    renderAt('/masi/activity?company=3', '/masi/activity', <MasiActivity />);
    expect(await screen.findByText('Nothing logged.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('What'), 'NOTE');
    await userEvent.type(screen.getByLabelText('Summary'), 'Ping them Friday');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() =>
      expect(api.logMasiActivity).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'NOTE', companyId: 3, summary: 'Ping them Friday' }),
      ),
    );
    expect(await screen.findByText('Ping them Friday')).toBeInTheDocument();
  });

  it('shows the empty state and the error', async () => {
    vi.mocked(api.fetchMasiActivity).mockRejectedValue(new Error('boom'));
    renderAt('/masi/activity', '/masi/activity', <MasiActivity />);
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });
});
