import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCalendar from './MasiCalendar';
import type { MasiCalendar as Calendar } from '../../services/api';
import { renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  fetchMasiCalendar: vi.fn(),
  createMasiCalendarEvent: vi.fn(),
  updateMasiCalendarEvent: vi.fn(),
  deleteMasiCalendarEvent: vi.fn(),
  MASI_EVENT_KINDS: ['CALL', 'INTERVIEW', 'FOLLOW_UP', 'DEADLINE', 'OTHER'],
  MASI_DAY_KINDS: {
    sent: ['APPLIED', 'SENT_MESSAGE'],
    collected: ['COLLECTED'],
    communicated: ['SENT_MESSAGE', 'RECEIVED_MESSAGE', 'CALL', 'INTERVIEW'],
  },
  MASI_EVENT_OUTCOMES: ['NONE', 'DONE', 'CANCELLED', 'NO_SHOW'],
}));
const api = await import('../../services/api');

/** 10:00 Tallinn on 22 September 2026 is 07:00 UTC — the page must show the Tallinn clock, whatever the browser's zone. */
const view: Calendar = {
  days: [
    { day: '2026-09-22', collected: 12, sent: 2, communicated: 1 },
    { day: '2026-09-23', collected: 0, sent: 0, communicated: 0 },
  ],
  events: [
    {
      id: 5,
      kind: 'INTERVIEW',
      startsAt: '2026-09-22T07:00:00Z',
      endsAt: '2026-09-22T08:00:00Z',
      allDay: false,
      title: 'Tech interview, Nortal',
      jobId: 7,
      jobTitle: 'Senior Java Developer',
      companyId: 3,
      companyName: 'Nortal AS',
      contactId: 11,
      contactName: 'Mari Maasikas',
      location: 'Meet link',
      notes: 'bring questions',
      outcome: 'NONE',
    },
  ],
  deadlines: [
    {
      jobId: 9,
      title: 'Platform Engineer',
      companyName: 'Wise',
      expiresAt: '2026-09-23T20:59:00Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchMasiCalendar).mockResolvedValue(view);
});

describe('MasiCalendar', () => {
  it('asks for the six weeks a month grid shows and draws the month', async () => {
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await waitFor(() => expect(api.fetchMasiCalendar).toHaveBeenCalled());
    // the grid starts on the Monday on or before the 1st and runs six weeks
    expect(api.fetchMasiCalendar).toHaveBeenCalledWith(
      '2026-08-31',
      '2026-10-11',
      expect.anything(),
    );
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    // the month is drawn as cells with a dated button each, not as an ARIA grid: the 22nd's button names its day
    expect(
      screen.getByRole('button', { name: 'Open Tuesday, 22 September 2026' }),
    ).toBeInTheDocument();
  });

  it('shows the day numbers, its counts as links into that day of the log, and the deadline', async () => {
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByRole('link', { name: 'collected 12 on 2026-09-22' })).toHaveAttribute(
      'href',
      '/masi/activity?day=2026-09-22&kind=COLLECTED',
    );
    // the link opens the rows the number counted: an application AND a message out
    expect(screen.getByRole('link', { name: 'sent 2 on 2026-09-22' })).toHaveAttribute(
      'href',
      '/masi/activity?day=2026-09-22&kind=APPLIED%2CSENT_MESSAGE',
    );
    expect(screen.getByRole('link', { name: 'talked 1 on 2026-09-22' })).toHaveAttribute(
      'href',
      '/masi/activity?day=2026-09-22&kind=SENT_MESSAGE%2CRECEIVED_MESSAGE%2CCALL%2CINTERVIEW',
    );
    // a day with nothing shows no counts at all, not three zeros
    expect(screen.queryByRole('link', { name: /collected 0/ })).not.toBeInTheDocument();
    // the posting's own deadline lands on ITS Tallinn day (23 Sep, 23:59 local) and links to the job
    expect(screen.getByRole('link', { name: 'closes: Platform Engineer' })).toHaveAttribute(
      'href',
      '/masi/jobs/9',
    );
  });

  it('puts an event on the Tallinn clock, not the browser zone', async () => {
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByText(/10:00/)).toBeInTheDocument();
    expect(screen.queryByText(/07:00/)).not.toBeInTheDocument();
  });

  it('moves a month at a time and back to today without losing the view', async () => {
    const user = userEvent.setup();
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await screen.findByText('September 2026');
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(await screen.findByText('October 2026')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.fetchMasiCalendar).toHaveBeenLastCalledWith(
        '2026-09-28',
        '2026-11-08',
        expect.anything(),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Earlier' }));
    expect(await screen.findByText('September 2026')).toBeInTheDocument();
  });

  it('opens a day from the month grid into the hour grid', async () => {
    const user = userEvent.setup();
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await user.click(
      await screen.findByRole('button', { name: /Open Tuesday, 22 September 2026/ }),
    );
    await waitFor(() =>
      expect(api.fetchMasiCalendar).toHaveBeenLastCalledWith(
        '2026-09-22',
        '2026-09-22',
        expect.anything(),
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Book 09:00 on Tuesday, 22 September 2026' }),
    ).toBeInTheDocument();
  });

  it('books a slot in Tallinn time and reloads', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createMasiCalendarEvent).mockResolvedValue(view.events[0]);
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await user.click(await screen.findByRole('button', { name: /Book 14:00/ }));
    const form = screen.getByRole('region', { name: 'New event' });
    await user.type(within(form).getByLabelText('Title'), 'Call with Mari');
    await user.click(within(form).getByRole('button', { name: 'Book it' }));
    await waitFor(() => expect(api.createMasiCalendarEvent).toHaveBeenCalled());
    const body = vi.mocked(api.createMasiCalendarEvent).mock.calls[0][0];
    expect(body.title).toBe('Call with Mari');
    expect(body.kind).toBe('CALL');
    expect(body.startsAt).toBe('2026-09-22T11:00:00.000Z'); // 14:00 Tallinn
    expect(api.fetchMasiCalendar).toHaveBeenCalledTimes(2);
  });

  it('edits an event from its block, keeps its outcome and can delete it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateMasiCalendarEvent).mockResolvedValue(view.events[0]);
    vi.mocked(api.deleteMasiCalendarEvent).mockResolvedValue(undefined);
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await user.click(await screen.findByRole('button', { name: /Tech interview, Nortal/ }));
    const form = screen.getByRole('region', { name: 'Edit event' });
    expect(within(form).getByLabelText('Starts')).toHaveValue('2026-09-22T10:00');
    await user.selectOptions(within(form).getByLabelText('Outcome'), 'DONE');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateMasiCalendarEvent).toHaveBeenCalled());
    expect(vi.mocked(api.updateMasiCalendarEvent).mock.calls[0][0]).toBe(5);
    expect(vi.mocked(api.updateMasiCalendarEvent).mock.calls[0][1].outcome).toBe('DONE');

    await user.click(await screen.findByRole('button', { name: /Tech interview, Nortal/ }));
    await user.click(
      within(screen.getByRole('region', { name: 'Edit event' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(api.deleteMasiCalendarEvent).toHaveBeenCalledWith(5));
  });

  it('says what went wrong instead of an empty page', async () => {
    vi.mocked(api.fetchMasiCalendar).mockRejectedValue(new Error('Failed to load the calendar'));
    renderAt('/masi/calendar', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByText('Failed to load the calendar')).toBeInTheDocument();
  });
});
