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
  MasiCompany,
  MasiCompanyFigures,
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
    claims: [{ rule: 'metric', detail: `role 1 dropped '40 teenust': ${LONG_TITLE} ${UNBROKEN}` }],
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
        endsAt: `${second}T20:00:00Z` /* 23:00 in Tallinn: the same day there */,
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

/** A company as hard as the register makes one: a long name, a long address, a website with no break in it. */
const company: MasiCompany = {
  id: 3,
  name: `${LONG_TITLE} AS`,
  registryCode: '10391131',
  website: UNBROKEN,
  careersUrl: null,
  atsVendor: null,
  emtakCode: '62101',
  sizeBand: '250+',
  hqCity: 'Tallinn',
  address: 'Harju maakond, Tallinn, Kesklinna linnaosa, Ahtri tn 12, 10151',
  tags: null,
  status: 'ACTIVE',
  origin: 'DISCOVERED',
  firstSeenAt: '2026-09-16T10:00:00Z',
  lastSeenAt: '2026-09-22T05:00:00Z',
  registerSeenAt: '2026-09-20T03:00:00Z',
  blacklisted: false,
  agency: false,
  agencyMark: null,
  userNote: null,
};

/**
 * NORTAL AS's quarters as the Tax and Customs Board published them (10.07.2026, both files): year, quarter,
 * turnover, employees, state taxes, labour taxes — 18 quarters, a first quarter four times the others.
 */
const NORTAL: Array<[number, number, number | null, number | null, number | null, number | null]> =
  [
    [2022, 1, 28966602, 366, 3264450, 2095885],
    [2022, 2, 12769344, 378, 3111967, 2488008],
    [2022, 3, 7241017, 385, 2918123, 2532906],
    [2022, 4, 8612479, 387, 3017960, 2593337],
    [2023, 1, 52480675, 389, 3741977, 2644147],
    [2023, 2, 9181436, 403, 3445839, 2877011],
    [2023, 3, 10708478, 392, 3643885, 2791338],
    [2023, 4, 11042909, 387, 3615824, 2710587],
    [2024, 1, 64368962, 384, 4563233, 2781451],
    [2024, 2, 11220658, 369, 3988990, 2983629],
    [2024, 3, 11082094, 350, 3679443, 2830189],
    [2024, 4, 13183088, 345, 3720515, 2607995],
    [2025, 1, 55102823, 347, 4379122, 2666445],
    [2025, 2, 11339111, 348, 3369772, 2814691],
    [2025, 3, 11694332, 359, 3401362, 2860768],
    [2025, 4, 12013040, 357, 3884926, 2825625],
    [2026, 1, 64852805, 367, 4545083, 2770242],
    [2026, 2, 14920312, 356, 3676181, 2762582],
  ];

/**
 * ANTERAS BALTIC OÜ's quarters, as published: three employees throughout — but for 2025 Q2, which has no count (a gap
 * in the line) — and a negative turnover in 2025 Q1 (a bar below the zero line).
 */
const ANTERAS: typeof NORTAL = [
  [2022, 1, 17985, 3, 4980, 2557],
  [2022, 2, 44750, 3, 10144, 3399],
  [2022, 3, 59125, 3, 7344, 3805],
  [2022, 4, 35000, 3, 8896, 3429],
  [2023, 1, 32000, 3, 4515, 3204],
  [2023, 2, 30830, 3, 7525, 2634],
  [2023, 3, 18300, 3, 5813, 3314],
  [2023, 4, 56603, 3, 6311, 3045],
  [2024, 1, 42300, 3, 6860, 3738],
  [2024, 2, 12601, 3, 5239, 3350],
  [2024, 3, 112969, 3, 11610, 3462],
  [2024, 4, 95550, 3, 22485, 3829],
  [2025, 1, -34057, 3, 13604, 3918],
  [2025, 2, 46000, null, 9791, 3655],
  [2025, 3, 13890, 3, 4623, 1158],
  [2025, 4, 87960, 3, 15590, 3473],
  [2026, 1, 10550, 3, 11842, 3496],
  [2026, 2, 22000, 3, 8013, 3599],
];

/**
 * The same two companies' annual reports as the register publishes them (key indicators, their own figures): year,
 * period end, revenue, operating profit, profit, average employees (full-time equivalents). NORTAL's are under its
 * reports' second id.
 */
/** year, period start, period end, revenue, operating profit, profit, average employees (FTE) */
type Year = [number, string, string, number, number, number, number | null];
const NORTAL_YEARS: Year[] = [
  [2023, '2023-01-01', '2023-12-31', 66_191_000, 5_352_000, 11_509_000, 386],
  [2024, '2024-01-01', '2024-12-31', 62_729_000, 5_649_000, 36_532_000, 345],
  [2025, '2025-01-01', '2025-12-31', 64_414_000, 1_383_000, 7_062_000, 361],
];
const ANTERAS_YEARS: Year[] = [
  [2023, '2023-01-01', '2023-12-31', 137_630, 1_048, 1_048, 3],
  [2024, '2024-01-01', '2024-12-31', 218_036, 135_356, 135_356, 3],
  [2025, '2025-01-01', '2025-12-31', 137_794, 45_273, 45_273, 3],
];

/**
 * Three more companies as the board and the register publish them, each a shape the charts must draw right:
 * - HORTICOM OÜ (10003666): financial years to July (the first to August, 2020 eleven months) beside its quarters.
 * - ARTISTON, OÜ (10242514): years July to June, each labelled by the register with the year it BEGAN; no 2024 report
 *   — it moved to calendar years, its 2025 report covering 18 months (2024-07 – 2025-12) — so a gap in its annual line.
 * - 10002603 (OÜ): in no quarterly file of the board — dormant since 2022 — six years of reports alone.
 */
const HORTICOM: typeof NORTAL = [
  [2022, 1, 3476548, 55, 480669, 122490],
  [2022, 2, 6184745, 55, 759026, 141557],
  [2022, 3, 2423006, 50, 327624, 138804],
  [2022, 4, 3275655, 51, 396251, 158290],
  [2023, 1, 3547871, 54, 439619, 144625],
  [2023, 2, 6175280, 58, 849928, 161451],
  [2023, 3, 2384337, 48, 353949, 144560],
  [2023, 4, 2854312, 47, 319744, 165418],
  [2024, 1, 3779961, 54, 502054, 141667],
  [2024, 2, 6783899, 55, 916018, 165874],
  [2024, 3, 2406487, 50, 347826, 152602],
  [2024, 4, 2648069, 50, 352578, 172182],
  [2025, 1, 3569257, 60, 472486, 160177],
  [2025, 2, 6602044, 55, 933689, 176608],
  [2025, 3, 2494297, 48, 450615, 170969],
  [2025, 4, 2391168, 48, 346896, 167600],
  [2026, 1, 3322567, 55, 448543, 161415],
  [2026, 2, 7589302, 48, 1097510, 172897],
];
const HORTICOM_YEARS: Year[] = [
  [2019, '2018-09-01', '2019-08-31', 7685613, 96064, 6919, 51],
  [2020, '2019-09-01', '2020-07-31', 7818511, 520123, 432203, null],
  [2021, '2020-08-01', '2021-07-31', 9379293, 509791, 471057, 50],
  [2022, '2021-08-01', '2022-07-31', 9698125, 376421, 353571, 51],
  [2023, '2022-08-01', '2023-07-31', 10157840, 403991, -36770, 56],
  [2024, '2023-08-01', '2024-07-31', 10489884, 403973, 368763, 57],
  [2025, '2024-08-01', '2025-07-31', 10475906, 314967, 336904, 55],
];
const ARTISTON: typeof NORTAL = [
  [2022, 1, 3175167, 21, 215716, 29535],
  [2022, 2, 3643322, 21, 208819, 28281],
  [2022, 3, 3718266, 21, 157878, 28546],
  [2022, 4, 5417766, 26, 326039, 34625],
  [2023, 1, 4756127, 23, 265317, 39093],
  [2023, 2, 2711914, 23, 127953, 37856],
  [2023, 3, 1872465, 22, 81991, 36284],
  [2023, 4, 2344977, 30, 133150, 37336],
  [2024, 1, 4259550, 23, 234455, 40981],
  [2024, 2, 2690266, 22, 230890, 37812],
  [2024, 3, 3146292, 24, 86106, 37517],
  [2024, 4, 3569418, 29, 230214, 39584],
  [2025, 1, 3751267, 23, 232451, 50178],
  [2025, 2, 3116312, 23, 149290, 42160],
  [2025, 3, 1803031, 23, 103785, 43889],
  [2025, 4, 2253190, 27, 165608, 43922],
  [2026, 1, 3717904, 23, 334680, 48618],
  [2026, 2, 2265647, 23, 93008, 40328],
];
const ARTISTON_YEARS: Year[] = [
  [2019, '2019-07-01', '2020-06-30', 7211426, -307301, -314519, 21],
  [2020, '2020-07-01', '2021-06-30', 7381924, 129688, 115121, 22],
  [2021, '2021-07-01', '2022-06-30', 12950265, 65079, 52204, 22],
  [2022, '2022-07-01', '2023-06-30', 15801920, 403492, 379438, 23],
  [2023, '2023-07-01', '2024-06-30', 11471560, 97557, 65763, 22],
  [2025, '2024-07-01', '2025-12-31', 17587406, -294033, -323734, 22],
];
const DORMANT_YEARS: Year[] = [
  [2019, '2019-01-01', '2019-12-31', 30811, 9, 9, 2],
  [2020, '2020-01-01', '2020-12-31', 33492, -231, -231, 2],
  [2021, '2021-01-01', '2021-12-31', 2350, -3971, -3971, 1],
  [2022, '2022-01-01', '2022-12-31', 0, 0, 0, 0],
  [2023, '2023-01-01', '2023-12-31', 0, 0, 0, 0],
  [2024, '2024-01-01', '2024-12-31', 0, 0, 0, 0],
];

type Row = (typeof NORTAL)[number];
const asFigures = (quarters: Row[], years: Year[]): MasiCompanyFigures => ({
  // the period start is kept for the record, not sent: masi does not send it yet
  years: years.map(([year, , periodEnd, revenue, operatingProfit, profit, avgEmployees]) => ({
    year,
    periodEnd,
    revenue,
    operatingProfit,
    profit,
    ...(avgEmployees === null ? {} : { avgEmployees }),
    submitted: `${year + 1}-06-17`,
  })),
  quarters: quarters.map(([year, quarter, turnover, employees, stateTaxes, labourTaxes]) => ({
    year,
    quarter,
    published: '2026-07-10',
    ...(turnover === null ? {} : { turnover }),
    ...(employees === null ? {} : { employees }),
    ...(stateTaxes === null ? {} : { stateTaxes }),
    ...(labourTaxes === null ? {} : { labourTaxes }),
  })),
});

const figures: Record<string, MasiCompanyFigures> = {
  '3': asFigures(NORTAL, NORTAL_YEARS),
  '4': asFigures(ANTERAS, ANTERAS_YEARS),
  '5': asFigures(HORTICOM, HORTICOM_YEARS),
  '6': asFigures(ARTISTON, ARTISTON_YEARS),
  '7': asFigures([], DORMANT_YEARS),
};
const small: MasiCompany = {
  ...company,
  id: 4,
  name: 'ANTERAS BALTIC OÜ',
  registryCode: '12499281',
  sizeBand: '1-9',
};
const named = (id: number, name: string, registryCode: string): MasiCompany => ({
  ...company,
  id,
  name,
  registryCode,
});
const byId: Record<string, MasiCompany> = {
  '4': small,
  '5': named(5, 'HORTICOM OÜ', '10003666'),
  '6': named(6, 'ARTISTON, OÜ', '10242514'),
  '7': named(7, 'An OÜ dormant since 2022', '10002603'),
};

const none = { content: [], page: 0, size: 200, totalElements: 0 };

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
    [/^\/companies\/\d+$/, () => ({ status: 200, body: byId[path.split('/')[2]] ?? company })],
    [/^\/companies\/\d+\/register-match$/, () => ({ status: 204 })],
    [/^\/companies\/\d+\/contacts$/, () => ({ status: 200, body: none })],
    [
      /^\/companies\/\d+\/figures$/,
      () => ({ status: 200, body: figures[path.split('/')[2]] ?? { quarters: [] } }),
    ],
    [/^\/persons\/of-company\/\d+$/, () => ({ status: 200, body: [] })],
    [/^\/packages\/retune$/, () => ({ status: 200, body: { count: 12, estimatedUsd: 3.42 } })],
  ];
  const hit = routes.find(([re]) => re.test(path));
  return hit ? hit[1]() : undefined;
}
