import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCalendar from './MasiCalendar';
import type { MasiCalendar as Calendar, MasiCalendarEvent } from '../../services/api';
import { renderAt } from './testUtils';
import { dayOf, monthGrid } from './calendarTime';

// only the four calls are stubbed: MASI_DAY_KINDS and the two kind lists stay the REAL ones, or the link assertions
// below would be reading a copy of themselves and a wrong list in api.ts would never show up here
vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  fetchMasiCalendar: vi.fn(),
  createMasiCalendarEvent: vi.fn(),
  updateMasiCalendarEvent: vi.fn(),
  deleteMasiCalendarEvent: vi.fn(),
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
  // the groupings masi states in its own answer; each number links to the kinds named here
  dayKinds: {
    sent: ['APPLIED', 'SENT_MESSAGE'],
    collected: ['COLLECTED'],
    communicated: ['SENT_MESSAGE', 'RECEIVED_MESSAGE', 'CALL', 'INTERVIEW'],
  },
};

/** The fixture event with some fields moved: every booking below is the same shape, differing only where it matters. */
function booking(over: Partial<MasiCalendarEvent> & { id: number }): MasiCalendarEvent {
  return { ...view.events[0], ...over };
}

/** A view carrying just these bookings, on the fixture's two days. */
function showing(events: MasiCalendarEvent[]): Calendar {
  return { ...view, events, deadlines: [] };
}

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

  /**
   * Two bookings at the same hour are two blocks side by side. Before the lane layout they were drawn one on top of
   * the other at full width, so the second one hid the first completely — a 10:00 interview invisible under a 10:00
   * call is a missed interview.
   */
  it('lays overlapping bookings out in lanes, and leaves a lone one the whole column', async () => {
    vi.mocked(api.fetchMasiCalendar).mockResolvedValue(
      showing([
        booking({
          id: 1,
          title: 'Call A',
          startsAt: '2026-09-22T07:00:00Z',
          endsAt: '2026-09-22T08:00:00Z',
        }),
        booking({
          id: 2,
          title: 'Call B',
          startsAt: '2026-09-22T07:30:00Z',
          endsAt: '2026-09-22T08:30:00Z',
        }),
        booking({
          id: 3,
          title: 'Alone',
          startsAt: '2026-09-22T11:00:00Z',
          endsAt: '2026-09-22T12:00:00Z',
        }),
      ]),
    );
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    const a = await screen.findByRole('button', { name: /Call A/ });
    const b = screen.getByRole('button', { name: /Call B/ });
    const alone = screen.getByRole('button', { name: /Alone/ });
    expect(a.style.left).toBe('calc(0% + 2px)');
    expect(a.style.width).toBe('calc(50% - 4px)');
    expect(b.style.left).toBe('calc(50% + 2px)');
    expect(b.style.width).toBe('calc(50% - 4px)');
    // a booking that overlaps nobody is not narrowed by what happens elsewhere in the day
    expect(alone.style.left).toBe('calc(0% + 2px)');
    expect(alone.style.width).toBe('calc(100% - 4px)');
  });

  /**
   * A booking that started yesterday evening is on today too, clipped to the hours today's grid draws: it begins at
   * the top of the grid, not 360 px above it. Grouped only by its starting day, it would not be on this day at all.
   */
  it('carries a booking onto every day it covers and clips it to the hours drawn', async () => {
    vi.mocked(api.fetchMasiCalendar).mockResolvedValue(
      showing([
        // 23:00 Tallinn on the 21st to 10:00 on the 22nd
        booking({
          id: 1,
          title: 'Overnight prep',
          startsAt: '2026-09-21T20:00:00Z',
          endsAt: '2026-09-22T07:00:00Z',
        }),
        // 20:30 to 21:30 Tallinn: past the last hour's label, still inside the hour the grid draws
        booking({
          id: 2,
          title: 'Evening call',
          startsAt: '2026-09-22T17:30:00Z',
          endsAt: '2026-09-22T18:30:00Z',
        }),
      ]),
    );
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    const overnight = await screen.findByRole('button', { name: /Overnight prep/ });
    // 08:00 is the first hour drawn: the block starts there and is two hours tall, not eleven
    expect(overnight.style.top).toBe('0px');
    expect(overnight.style.height).toBe('80px');
    const evening = screen.getByRole('button', { name: /Evening call/ });
    expect(evening.className).toContain('masi-block');
    expect(evening.style.top).toBe('500px'); // 20:30, twelve and a half hours past 08:00
    expect(evening.style.height).toBe('20px'); // clipped at 21:00, where the grid ends
  });

  /**
   * A booking that covers the whole of the hours drawn is named in the column head, not drawn as a block: as a block
   * it would take a lane from every call that happens at an actual hour and say nothing the head does not.
   */
  it('lists a booking that covers the whole day in the head instead of drawing it over the grid', async () => {
    vi.mocked(api.fetchMasiCalendar).mockResolvedValue(
      showing([
        // 23:00 Tallinn on the 21st to 23:00 on the 22nd: over the top and the bottom of the 22nd's grid
        booking({
          id: 1,
          title: 'Conference',
          startsAt: '2026-09-21T20:00:00Z',
          endsAt: '2026-09-22T20:00:00Z',
        }),
        booking({
          id: 2,
          title: 'Away',
          allDay: true,
          startsAt: '2026-09-21T21:00:00Z',
          endsAt: '2026-09-22T21:00:00Z',
        }),
      ]),
    );
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    const carried = await screen.findByRole('button', { name: 'continues: Conference' });
    expect(carried.className).toContain('masi-chip');
    expect(carried.className).not.toContain('masi-block');
    expect(screen.getByRole('button', { name: 'all day: Away' }).className).toContain('masi-chip');
    // nothing is drawn over the hours: both are in the head
    expect(
      screen.queryAllByRole('button').filter((b) => b.className.includes('masi-block')),
    ).toHaveLength(0);
  });

  /** A month cell is an inch tall: it shows three bookings and says how many more the day holds. */
  it('shows three bookings in a month cell and counts the rest', async () => {
    vi.mocked(api.fetchMasiCalendar).mockResolvedValue(
      showing(
        [1, 2, 3, 4, 5].map((n) =>
          booking({
            id: n,
            title: `Booking ${n}`,
            startsAt: `2026-09-22T0${n}:00:00Z`,
            endsAt: `2026-09-22T0${n}:30:00Z`,
          }),
        ),
      ),
    );
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByRole('button', { name: /Booking 3/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Booking 4/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '2 more on Tuesday, 22 September 2026' }),
    ).toBeInTheDocument();
  });

  /** A view or a day the URL cannot mean is the month of today, not a blank page or a one-day range of nonsense. */
  it('falls back to this month when the URL names no view and no day it can read', async () => {
    renderAt('/masi/calendar?view=banana&day=the-22nd', '/masi/calendar', <MasiCalendar />);
    await waitFor(() => expect(api.fetchMasiCalendar).toHaveBeenCalled());
    const grid = monthGrid(dayOf(new Date()));
    expect(api.fetchMasiCalendar).toHaveBeenCalledWith(grid[0], grid[41], expect.anything());
  });

  /** The failure goes when the next load works: an error left on the page outlives what it was about. */
  it('clears the failure once a load succeeds', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchMasiCalendar)
      .mockRejectedValueOnce(new Error('Failed to load the calendar'))
      .mockResolvedValue(view);
    renderAt('/masi/calendar?day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByText('Failed to load the calendar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() =>
      expect(screen.queryByText('Failed to load the calendar')).not.toBeInTheDocument(),
    );
  });

  /**
   * An end the operator clears is left out of the request, not sent as an empty string: masi then gives the booking
   * its default hour. An empty string is refused as a bad instant.
   */
  it('leaves the end out of the request when the operator clears it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createMasiCalendarEvent).mockResolvedValue(view.events[0]);
    renderAt('/masi/calendar?view=day&day=2026-09-22', '/masi/calendar', <MasiCalendar />);
    await user.click(await screen.findByRole('button', { name: /Book 14:00/ }));
    const form = screen.getByRole('region', { name: 'New event' });
    await user.type(within(form).getByLabelText('Title'), 'Open ended');
    await user.clear(within(form).getByLabelText('Ends'));
    await user.click(within(form).getByRole('button', { name: 'Book it' }));
    await waitFor(() => expect(api.createMasiCalendarEvent).toHaveBeenCalled());
    expect(vi.mocked(api.createMasiCalendarEvent).mock.calls[0][0].endsAt).toBeUndefined();
  });

  it('says what went wrong instead of an empty page', async () => {
    vi.mocked(api.fetchMasiCalendar).mockRejectedValue(new Error('Failed to load the calendar'));
    renderAt('/masi/calendar', '/masi/calendar', <MasiCalendar />);
    expect(await screen.findByText('Failed to load the calendar')).toBeInTheDocument();
  });
});
