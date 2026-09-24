import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import JobBookings from './JobBookings';
import { renderAt } from './testUtils';
import { formatDate, formatDateTime } from './format';
import type { MasiCalendarEvent } from '../../services/api';

vi.mock('../../services/api', () => ({ fetchMasiJobBookings: vi.fn() }));
const api = await import('../../services/api');

const interview: MasiCalendarEvent = {
  id: 1,
  kind: 'INTERVIEW',
  startsAt: '2026-09-29T07:00:00Z', // 10:00 in Tallinn
  endsAt: '2026-09-29T08:00:00Z',
  allDay: false,
  title: 'Technical round',
  jobId: 7,
  jobTitle: 'Senior Java Developer',
  companyId: 3,
  companyName: 'Nortal AS',
  contactId: 5,
  contactName: 'Kati Kask',
  location: null,
  notes: null,
  outcome: 'NONE',
};
const call: MasiCalendarEvent = {
  ...interview,
  id: 2,
  kind: 'CALL',
  startsAt: '2026-09-27T21:00:00Z', // an all-day booking is its day in Tallinn: the 28th begins at 21:00 UTC
  endsAt: '2026-09-28T21:00:00Z',
  allDay: true,
  title: 'Screening',
  contactName: null,
  outcome: 'DONE',
};

beforeEach(() => {
  vi.mocked(api.fetchMasiJobBookings).mockReset();
});

describe('JobBookings', () => {
  it("lists the job's bookings, each opening its day in the calendar, and offers to book one for this job", async () => {
    vi.mocked(api.fetchMasiJobBookings).mockResolvedValue([call, interview]);
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <JobBookings jobId={7} />);
    const section = await screen.findByRole('region', { name: 'Bookings for this job' });
    const [first, second] = within(section).getAllByRole('listitem');
    expect(
      within(first).getByRole('link', { name: `${formatDate(call.startsAt)}, all day` }),
    ).toHaveAttribute('href', '/masi/calendar?view=day&day=2026-09-28');
    expect(first).toHaveTextContent('call · Screening');
    expect(within(first).getByText('done')).toBeInTheDocument();
    expect(
      within(second).getByRole('link', { name: formatDateTime(interview.startsAt) }),
    ).toHaveAttribute('href', '/masi/calendar?view=day&day=2026-09-29');
    expect(second).toHaveTextContent('interview · Technical round · with Kati Kask');
    expect(within(second).queryByText('not yet')).not.toBeInTheDocument(); // an outcome only once there is one
    expect(screen.getByRole('link', { name: 'Book a call or an interview' })).toHaveAttribute(
      'href',
      '/masi/calendar?job=7&view=week',
    );
    expect(api.fetchMasiJobBookings).toHaveBeenCalledWith(7, expect.anything());
  });

  it('says when nothing is booked, and shows a failure instead of nothing', async () => {
    vi.mocked(api.fetchMasiJobBookings).mockResolvedValueOnce([]);
    const { unmount } = renderAt('/masi/jobs/7', '/masi/jobs/:id', <JobBookings jobId={7} />);
    expect(await screen.findByText('Nothing booked for this position.')).toBeInTheDocument();
    unmount();
    vi.mocked(api.fetchMasiJobBookings).mockRejectedValueOnce(
      new Error('Failed to load the bookings'),
    );
    renderAt('/masi/jobs/7', '/masi/jobs/:id', <JobBookings jobId={7} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the bookings');
  });
});
