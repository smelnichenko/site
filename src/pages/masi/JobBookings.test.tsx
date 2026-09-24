import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import JobBookings from './JobBookings';
import { renderAt } from './testUtils';
import { formatDate, formatDateTime } from './format';
import type { MasiCalendarEvent } from '../../services/api';

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

function show(props: Partial<Parameters<typeof JobBookings>[0]>) {
  return renderAt(
    '/masi/jobs/7',
    '/masi/jobs/:id',
    <JobBookings jobId={7} events={[]} error={null} mergedIntoId={null} {...props} />,
  );
}

describe('JobBookings', () => {
  it("lists the job's bookings, each opening its day in the calendar for this job, and offers to book one", () => {
    show({ events: [call, interview] });
    const section = screen.getByRole('region', { name: 'Bookings' });
    expect(within(section).getByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    const [first, second] = within(section).getAllByRole('listitem');
    expect(
      within(first).getByRole('link', { name: `${formatDate(call.startsAt)}, all day` }),
    ).toHaveAttribute('href', '/masi/calendar?view=day&day=2026-09-28&job=7');
    expect(first).toHaveTextContent('call · Screening');
    expect(within(first).getByText('done')).toBeInTheDocument();
    expect(
      within(second).getByRole('link', { name: formatDateTime(interview.startsAt) }),
    ).toHaveAttribute('href', '/masi/calendar?view=day&day=2026-09-29&job=7');
    expect(second).toHaveTextContent('interview · Technical round · with Kati Kask');
    expect(within(second).queryByText('not yet')).not.toBeInTheDocument(); // an outcome only once there is one
    expect(screen.getByRole('link', { name: 'Book a call or an interview' })).toHaveAttribute(
      'href',
      '/masi/calendar?job=7&view=week',
    );
  });

  it('says when nothing is booked, and shows a failure instead of nothing', () => {
    const { unmount } = show({ events: [] });
    expect(screen.getByText('Nothing booked for this position.')).toBeInTheDocument();
    unmount();
    show({ events: null, error: 'Failed to load the bookings' });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the bookings');
    expect(screen.queryByText('Nothing booked for this position.')).not.toBeInTheDocument();
  });

  it("sends a merged job's bookings to the job it became, and books nothing under it", () => {
    show({ events: [], mergedIntoId: 9 });
    expect(screen.getByRole('link', { name: 'the job it became' })).toHaveAttribute(
      'href',
      '/masi/jobs/9',
    );
    expect(
      screen.queryByRole('link', { name: 'Book a call or an interview' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing booked for this position.')).not.toBeInTheDocument();
  });

  it('opens the right day in winter, when Tallinn is two hours ahead, not three', () => {
    show({
      events: [{ ...interview, startsAt: '2026-11-03T21:30:00Z', endsAt: '2026-11-03T22:30:00Z' }],
    });
    expect(
      screen.getByRole('link', { name: formatDateTime('2026-11-03T21:30:00Z') }),
    ).toHaveAttribute('href', '/masi/calendar?view=day&day=2026-11-03&job=7');
  });
});
