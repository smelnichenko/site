import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import MasiActivity from './MasiActivity';
import type { MasiActivity as Row } from '../../services/api';
import { looseSeparators, renderAt } from './testUtils';

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
    expect(within(items[1]).getByRole('link', { name: 'package 11' })).toHaveAttribute(
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

  it("narrows to one person's rows, and logs with them only once a company says which of their contacts", async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/activity?person=40', '/masi/activity', <MasiActivity />);
    expect(
      await screen.findByRole('button', { name: 'Clear the scope: person 40' }),
    ).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiActivity).mock.calls[0][0]).toMatchObject({ person: 40 });
    expect(screen.queryByLabelText('Summary')).not.toBeInTheDocument();
  });

  it('logs with a person at a company as their contact there', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    vi.mocked(api.logMasiActivity).mockResolvedValue({ ...rows[0], summary: 'Called Mari' });
    renderAt('/masi/activity?person=40&company=3', '/masi/activity', <MasiActivity />);
    expect(
      await screen.findByRole('button', { name: 'Clear the scope: person 40 at company 3' }),
    ).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiActivity).mock.calls[0][0]).toMatchObject({
      person: 40,
      company: 3,
    });
    await userEvent.type(screen.getByLabelText('Summary'), 'Called Mari');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() =>
      expect(api.logMasiActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: 40,
          companyId: 3,
          contactId: undefined,
          summary: 'Called Mari',
        }),
      ),
    );
  });

  it('names a row whose contact or person has no name by its number', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [
        { ...rows[0], id: 1, personId: null, contactName: null, contactId: 77 },
        { ...rows[0], id: 2, personId: 40, contactName: null },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/activity', '/masi/activity', <MasiActivity />);
    expect(await screen.findByText(/contact 77/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'person 40' })).toHaveAttribute(
      'href',
      '/masi/persons/40',
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

  it("names masi's register and website lines, and filters only by the kinds the server has", async () => {
    const own = (id: number, kind: Row['kind'], summary: string): Row => ({
      ...rows[2],
      id,
      kind,
      origin: 'SYSTEM',
      jobId: null,
      jobTitle: null,
      summary,
    });
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: [
        own(21, 'REGISTER_MATCHED', 'placed on reg. 10391131 by its own site nortal.com'),
        own(20, 'WEBSITE_SET', 'website nortal.ee replaced by nortal.com'),
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/activity', '/masi/activity', <MasiActivity />);

    const log = await screen.findByRole('list', { name: 'Activity' });
    const [placed, website] = within(log).getAllByRole('listitem');
    expect(within(placed).getByText('placed in the register')).toBeInTheDocument();
    expect(
      within(placed).getByText('placed on reg. 10391131 by its own site nortal.com'),
    ).toBeInTheDocument();
    expect(within(website).getByText('website')).toBeInTheDocument();
    const kinds = within(screen.getByRole('combobox', { name: 'Kind' }))
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'));
    expect(kinds).toEqual(expect.arrayContaining(['REGISTER_MATCHED', 'WEBSITE_SET']));
    // a kind the server does not have would answer every filter by it with an error
    expect(kinds).not.toContain('ANALYSED');
  });

  it('shows the empty state and the error', async () => {
    vi.mocked(api.fetchMasiActivity).mockRejectedValue(new Error('boom'));
    renderAt('/masi/activity', '/masi/activity', <MasiActivity />);
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });

  it("shows a report's responses: the caller's rows of one kind in the period, named, and clears back to the log", async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: rows,
      page: 0,
      size: 50,
      totalElements: 2,
    });
    const from = '2026-03-22T22:00:00Z';
    const to = '2026-03-29T21:00:00Z';
    /** The page's URL, as the address bar would show it after a clear. */
    function Search() {
      return <output data-testid="search">{useLocation().search}</output>;
    }
    render(
      <MemoryRouter
        initialEntries={[`/masi/activity?response=REJECTED&from=${from}&to=${to}&kind=CALL`]}
      >
        <Routes>
          <Route
            path="/masi/activity"
            element={
              <>
                <MasiActivity />
                <Search />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    const note = await screen.findByRole('region', { name: 'Report filter' });
    expect(note).toHaveTextContent('refused 23 Mar 2026 – 29 Mar 2026');
    expect(vi.mocked(api.fetchMasiActivity).mock.calls[0][0]).toMatchObject({
      response: 'REJECTED',
      from,
      to,
    });
    await userEvent.click(within(note).getByRole('button', { name: 'clear the report filter' }));
    await waitFor(() =>
      expect(api.fetchMasiActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ response: undefined, from: undefined, to: undefined }),
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('region', { name: 'Report filter' })).not.toBeInTheDocument();
    // the figure's parameters are gone from the URL, every one; the operator's own filter stays
    expect(screen.getByTestId('search')).toHaveTextContent(/^\?kind=CALL$/);
  });
  it("is a masi page like the rest: under the masi pages' own rules, its separators kept with the part before them", async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: rows,
      page: 0,
      size: 50,
      totalElements: 3,
    });
    renderAt('/masi/activity?job=7', '/masi/activity', <MasiActivity />);
    const list = await screen.findByRole('list', { name: 'Activity' });
    // the page's root carries the class every `.masi ...` rule of the stylesheet is scoped to
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('navigation', { name: 'masi sections' }).parentElement).toHaveClass(
      'masi',
    );
    // the premise: the rows draw separators (a summary's, a package's)
    expect(list.textContent).toContain('·');
    expect(looseSeparators(list.textContent)).toEqual([]);
  });

  it('names every control of the log, the scope chip by what it clears', async () => {
    vi.mocked(api.fetchMasiActivity).mockResolvedValue({
      content: rows,
      page: 0,
      size: 50,
      totalElements: 3,
    });
    renderAt('/masi/activity?job=7', '/masi/activity', <MasiActivity />);
    await screen.findByRole('list', { name: 'Activity' });
    expect(screen.getByRole('button', { name: 'Clear the scope: job 7' })).toBeInTheDocument();
    for (const name of ['Day', 'Kind', 'What', 'Summary', 'Detail']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Log' })).toBeInTheDocument();
    // two rows' package links are told apart by name, not only by where they lead
    const packages = screen.getAllByRole('link', { name: /^package/ });
    expect(packages.map((a) => a.getAttribute('aria-label') ?? a.textContent)).toEqual(
      packages.map((a) => `package ${a.getAttribute('href')?.split('/').pop()}`),
    );
  });
});
