import type { MasiCalendarEvent } from '../../services/api';

/** What a booking is, in words: the calendar and the job page say it the same way. */
export const KIND_WORDS: Record<MasiCalendarEvent['kind'], string> = {
  CALL: 'call',
  INTERVIEW: 'interview',
  FOLLOW_UP: 'follow-up',
  DEADLINE: 'deadline',
  OTHER: 'other',
};

/** How a booking went, in words. */
export const OUTCOME_WORDS: Record<MasiCalendarEvent['outcome'], string> = {
  NONE: 'not yet',
  DONE: 'done',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no show',
};
