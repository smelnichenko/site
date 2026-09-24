/**
 * What masi answers the layout test's pages: the unit tests' fixtures (src/pages/masi/fixtures.ts), made hard for a
 * layout — long titles, an unbroken URL, a JSON pointer, three bookings in one hour, a day with more chips than a month
 * cell holds. Typed against the API's own interfaces, so a changed response shape fails the typecheck, not the page.
 * An API call this file does not answer fails the test (layout.spec.ts), so no page renders on a missing fixture.
 */
import type {
  CvMaster,
  CvVersionMeta,
  MasiCalendar,
  MasiCalendarEvent,
  MasiJob,
  MasiMatch,
  MasiPackage,
  Paged,
} from '../src/services/api';
import { readFileSync } from 'node:fs';
import { job, prepared } from '../src/pages/masi/fixtures';

/** The real masi answer the Match card's unit test uses (a JSON file: read, not imported, in Node). */
const aiMatch: unknown = JSON.parse(
  readFileSync(new URL('../src/pages/masi/aiMatchFixture.json', import.meta.url), 'utf8'),
);

/** A title as long as a board's, with no break a narrow column would like. */
const LONG_TITLE =
  'Senior Backend Engineer (Java / Kotlin, Kafka, PostgreSQL, Kubernetes) for the payments platform — hybrid, Tallinn or Tartu';
const UNBROKEN =
  'https://example.com/a/very/long/unbroken/path/that/never/has/a/space/in/it/and/keeps/going/and/going';

const detail: MasiJob = { ...job, title: LONG_TITLE, match: aiMatch as MasiMatch };

const master: CvVersionMeta = {
  version: 1,
  note: 'the first master',
  active: true,
  activatedAt: '2026-09-18T10:00:00Z',
  createdAt: '2026-09-18T09:00:00Z',
  schemaVersion: '1',
  language: 'en',
  translatedFrom: null,
  reviewedAt: null,
  current: null,
  parity: null,
};

function translation(version: number, over: Partial<CvVersionMeta>): CvVersionMeta {
  return {
    ...master,
    version,
    active: false,
    activatedAt: null,
    language: 'et',
    translatedFrom: 1,
    current: false,
    parity: [],
    note: null,
    ...over,
  };
}

const versions: CvVersionMeta[] = [
  translation(4, { reviewedAt: '2026-09-24T10:00:00Z', current: true }),
  translation(3, {}),
  translation(2, {
    parity: [
      '/summary: "juhtisin" claims more than the source\'s wording',
      "/experience/0/achievements/3/statement: does not carry its metric's figures [800 ms, 120 ms]",
      `/experience/0/achievements/4/metric:${UNBROKEN}`,
    ],
  }),
  master,
];

const cv: CvMaster = {
  active: master,
  yaml: 'schema_version: "1"\nlanguage: en\n',
  completeness: {
    score: 86,
    gaps: ['Riigi Infosüsteemide Amet — Software Developer: no achievement carries a metric'],
  },
};

const packages: MasiPackage[] = [
  {
    ...(prepared as MasiPackage),
    jobTitle: LONG_TITLE,
    language: 'et',
    tunedFromVersion: 4,
    writtenIn: 'et',
    lint: [{ rule: 'duty', detail: `role 0 bullet reads as a duty without a result: ${UNBROKEN}` }],
  },
  {
    ...(prepared as MasiPackage),
    id: 12,
    status: 'FAILED_GUARD',
    claims: [{ rule: 'metric', detail: `role 1 dropped '40 teenust': ${LONG_TITLE}` }],
  },
];

/** Every day from `from` to `to`, both ends, as YYYY-MM-DD. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let d = new Date(`${from}T12:00:00Z`);
    d <= new Date(`${to}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function booking(
  id: number,
  day: string,
  startUtc: string,
  endUtc: string,
  title: string,
  over: Partial<MasiCalendarEvent> = {},
): MasiCalendarEvent {
  return {
    id,
    kind: 'INTERVIEW',
    startsAt: `${day}T${startUtc}:00Z`,
    endsAt: `${day}T${endUtc}:00Z`,
    allDay: false,
    title,
    jobId: 7,
    jobTitle: LONG_TITLE,
    companyId: 3,
    companyName: 'Nortal AS',
    contactId: null,
    contactName: null,
    location: null,
    notes: null,
    outcome: 'NONE',
    ...over,
  };
}

/**
 * The range's first day holds three bookings in one hour (they must share it in lanes, never overlap) and one
 * running past it; its second day more all-day chips than a month cell shows; every day counts something.
 */
function calendar(from: string, to: string): MasiCalendar {
  const days = daysBetween(from, to);
  const [first, second] = [days[0], days[1] ?? days[0]];
  const events: MasiCalendarEvent[] = [
    booking(1, first, '07:00', '08:00', `Tech interview — ${LONG_TITLE}`),
    booking(2, first, '07:00', '08:00', 'Call with the recruiter', { kind: 'CALL' }),
    booking(3, first, '07:30', '09:30', 'Follow-up on the take-home task', { kind: 'FOLLOW_UP' }),
    booking(4, first, '11:00', '11:30', UNBROKEN, { kind: 'OTHER' }),
    ...Array.from({ length: 7 }, (_, i) =>
      booking(10 + i, second, '00:00', '00:00', `All-day ${i + 1}: ${LONG_TITLE}`, {
        allDay: true,
        kind: 'DEADLINE',
        endsAt: `${second}T23:59:00Z`,
      }),
    ),
  ];
  return {
    days: days.map((day, i) => ({
      day,
      collected: (i * 7) % 23,
      sent: i % 3,
      communicated: i % 2,
    })),
    events,
    deadlines: [
      { jobId: 9, title: LONG_TITLE, companyName: 'Wise', expiresAt: `${second}T20:59:00Z` },
    ],
    dayKinds: {
      sent: ['APPLIED', 'SENT_MESSAGE'],
      collected: ['COLLECTED'],
      communicated: ['SENT_MESSAGE', 'RECEIVED_MESSAGE', 'CALL', 'INTERVIEW'],
    },
  };
}

const jobs: Paged<MasiJob> = {
  content: [
    detail,
    { ...job, id: 8, title: UNBROKEN },
    { ...job, id: 9, companyName: `${LONG_TITLE} OÜ` },
  ],
  page: 0,
  size: 20,
  totalElements: 3,
};

export interface Answer {
  status: number;
  body?: unknown;
}

/** masi's answer to a GET of the pages under test; undefined for a request no fixture covers. */
export function answer(url: URL): Answer | undefined {
  const path = url.pathname.replace(/^\/api\/masi/, '');
  const q = url.searchParams;
  const routes: Array<[RegExp, () => Answer]> = [
    [/^\/cv$/, () => ({ status: 200, body: cv })],
    [/^\/cv\/versions$/, () => ({ status: 200, body: versions })],
    [/^\/cv\/translation$/, () => ({ status: 404, body: { error: 'none since masi started' } })],
    [
      /^\/calendar$/,
      () => ({ status: 200, body: calendar(q.get('from') ?? '', q.get('to') ?? '') }),
    ],
    [
      /^\/calendar\/job\/\d+$/,
      () => ({ status: 200, body: calendar('2026-09-22', '2026-09-23').events.slice(0, 3) }),
    ],
    [/^\/jobs$/, () => ({ status: 200, body: jobs })],
    [/^\/jobs\/\d+$/, () => ({ status: 200, body: detail })],
    [/^\/jobs\/\d+\/history$/, () => ({ status: 200, body: [] })],
    [/^\/jobs\/\d+\/similar$/, () => ({ status: 200, body: [] })],
    [/^\/packages$/, () => ({ status: 200, body: packages })],
    [/^\/packages\/retune$/, () => ({ status: 200, body: { count: 12, estimatedUsd: 3.42 } })],
  ];
  const hit = routes.find(([re]) => re.test(path));
  return hit ? hit[1]() : undefined;
}
