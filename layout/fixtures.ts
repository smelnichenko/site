/**
 * What masi answers the layout test's pages: the unit tests' fixtures (src/pages/masi/fixtures.ts), made hard for a
 * layout — long titles, an unbroken URL, a JSON pointer, three bookings in one hour, a day with more chips than a month
 * cell holds. Typed against the API's own interfaces, so a changed response shape fails the typecheck, not the page.
 * An API call this file does not answer fails the test (layout.spec.ts), so no page renders on a missing fixture.
 */
import type {
  ChartDataByCollection,
  CvMaster,
  CvVersionMeta,
  MasiCalendar,
  MasiCalendarEvent,
  MasiCompany,
  MasiCompanyFigures,
  MasiCompanyVisits,
  MasiPerson,
  MasiActivity,
  MasiJob,
  MasiListingRow,
  MasiMatch,
  MasiPackage,
  MasiPackageSend,
  MasiReport,
  MasiSendPreview,
  Paged,
  PagedResponse,
  RssFeedMonitorConfig,
  RssFeedResult,
  RssOptions,
  MasiContactPicture,
  MasiPictureTries,
} from '../src/services/api';
import { readFileSync } from 'node:fs';
import {
  bookings,
  job,
  listings as listingRows,
  prepared,
  sendPreview,
} from '../src/pages/masi/fixtures';
import { report } from '../src/pages/masi/statsFixture';

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

/**
 * A posting with every term masi reads: a yearly euro figure (so a second, full-time monthly line), a form of work, a
 * country, and the longest remote scope masi keeps (200 characters) with an unbroken run in it.
 */
const termed: MasiJob = {
  ...detail,
  id: 12,
  salaryMin: 80000,
  salaryMax: 110000,
  salaryCurrency: 'EUR',
  salaryPeriod: 'YEAR',
  salaryMonthlyEurFteMin: 6667,
  salaryMonthlyEurFteMax: 9167,
  employmentType: 'FIXED_TERM',
  country: 'EE',
  remoteScope:
    `Remote within the EU/EEA, Estonia, Finland, Latvia, Lithuania, Sweden — ${UNBROKEN}`.slice(
      0,
      200,
    ),
};
const details: Record<string, MasiJob> = { '12': termed };

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
    status: 'FAILED',
    error: `the model refused: ${LONG_TITLE} ${UNBROKEN}`,
  },
];

/** Job 9: a REVIEWED package to Send; job 10: one whose postings named nobody to mail, only where to apply. */
const reviewed: MasiPackage = {
  ...(prepared as MasiPackage),
  id: 21,
  jobId: 9,
  status: 'REVIEWED',
};
const reviewedNoMail: MasiPackage = { ...reviewed, id: 22, jobId: 10 };
/** Job 11: a package masi mailed, on test - who it was for (a long name and address) and the sink it went to. */
const mailed: MasiPackage = {
  ...reviewed,
  id: 23,
  jobId: 11,
  status: 'APPLIED',
  appliedAt: '2026-10-19T09:30:00Z',
};
const mailedSend: MasiPackageSend = {
  contactId: 40,
  toName: 'Kati-Liisa Karu-Kaasik',
  toAddress: 'kati-liisa.karu-kaasik.talent.acquisition@nortal-recruitment-services.example.com',
  deliveredTo: 'masi-sink@pmon.dev',
  status: 'SENT',
  error: null,
  messageId: '<20261019093000.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6@pmon.dev>',
  claimedAt: '2026-10-19T09:29:58Z',
  sentAt: '2026-10-19T09:30:00Z',
  attempt: 1,
  token: null,
  note: null,
};

/**
 * The mail of package 21 on test, made hard for the dialog: a long name and title, an address with no break in it, a
 * subject as long as a board's title, and a letter longer than the dialog, so its body scrolls inside it.
 */
const sendPreviews: Record<string, MasiSendPreview> = {
  '21': {
    ...sendPreview,
    packageId: 21,
    bcc: null,
    deliveredTo: 'masi-sink@pmon.dev',
    note: 'test: goes to masi-sink@pmon.dev, not to the contact; no Bcc copy',
    // its last send may have left: the warning, with a Message-ID that has no break in it, above Send and in the dialog
    lastSend: {
      contactId: 40,
      toName: 'Kati-Liisa Karu-Kaasik',
      toAddress:
        'kati-liisa.karu-kaasik.talent.acquisition@nortal-recruitment-services.example.com',
      deliveredTo: 'masi-sink@pmon.dev',
      status: 'UNKNOWN',
      error: 'the connection dropped after the whole mail went',
      messageId: '<20261019090000.a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6@pmon.dev>',
      claimedAt: '2026-10-19T09:00:00Z',
      sentAt: null,
      attempt: 2,
      token: 'tok-2',
      note: 'the mail may have left - check your Bcc copy before sending it again',
    },
    to: [
      {
        contactId: 40,
        name: 'Kati-Liisa Karu-Kaasik',
        title: 'Senior Talent Acquisition Partner, Engineering and Product',
        email: 'kati-liisa.karu-kaasik.talent.acquisition@nortal-recruitment-services.example.com',
        postedAt: '2026-10-18T08:00:00Z',
      },
      ...sendPreview.to.slice(1),
    ],
    subject: `Application: ${LONG_TITLE} - Mari Operaator`,
    body: [
      'Dear Nortal team,',
      '',
      ...Array.from(
        { length: 30 },
        (_, i) =>
          `Paragraph ${i + 1}: I cut p99 latency from 800 ms to 120 ms on an order API that took 4 000 orders a minute.`,
      ),
      UNBROKEN,
      '',
      'Regards,',
      'Mari Operaator',
    ].join('\n'),
  },
  '22': { ...sendPreview, packageId: 22, to: [], defaultContactId: null, applyAt: [UNBROKEN] },
};

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

/**
 * A month's report at the registry's real size: four-digit figures in the tiles, a source and a company with long names,
 * every figure a link (none zero but one source's), and salaries left out - every link a report can draw, at once.
 */
const bigReport: MasiReport = {
  ...report,
  id: 6,
  kind: 'MONTHLY',
  stats: {
    ...report.stats,
    registry: {
      newJobs: 1284,
      closedJobs: 1107,
      repostedJobs: 96,
      newListings: 2391,
      closedListings: 2210,
      medianListingLifetimeHours: 412.5,
      rowsExact: true,
    },
    sources: [
      ...report.stats.sources,
      {
        key: 'tootukassa',
        name: 'Eesti Töötukassa töövahenduse portaal (töökohad ja praktikakohad)',
        newListings: 1318,
        closedListings: 1206,
        runs: { OK: 30, ERROR: 1 },
      },
    ],
    topCompanies: [
      { id: 3, name: `${LONG_TITLE} AS`, newJobs: 112 },
      { id: 4, name: null, newJobs: 9 },
      { id: 5, name: 'Bolt Operations OÜ', newJobs: 87 },
    ],
    salary: {
      posted: 734,
      lowest: 1100,
      medianMin: 3200,
      medianMax: 4800,
      highest: 14000,
      excluded: 312,
    },
    funnel: { requested: 1024, applied: 381, averagePackageCostUsd: 0.21 },
    outcomes: {
      interviews: 12,
      interviewsByLanguage: { et: 9, en: 2, none: 1 },
      responses: { REPLIED: 14, INTERVIEW: 12, OFFER: 2, REJECTED: 41 },
    },
  },
};

/**
 * The activity log as a report's response figure or a job's log shows it: a call with a person, an application with its
 * package, a message whose summary and detail run past a phone's line - every part a row joins with a separator.
 */
const activityRow: MasiActivity = {
  id: 1,
  at: '2026-03-24T09:30:00Z',
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
};
const activityPage: Paged<MasiActivity> = {
  content: [
    activityRow,
    {
      ...activityRow,
      id: 2,
      kind: 'APPLIED',
      origin: 'SYSTEM',
      contactId: null,
      contactName: null,
      personId: null,
      packageId: 11,
      summary: 'Senior Java Developer',
      detail: null,
    },
    {
      ...activityRow,
      id: 3,
      kind: 'REJECTED',
      origin: 'MAIL',
      jobTitle: LONG_TITLE,
      companyName: `${LONG_TITLE} OÜ`,
      packageId: 12,
      summary: 'Thank you for applying, we went with another candidate this time',
      detail: 'the recruiter offered to keep the CV on file for the next opening in the team',
    },
  ],
  page: 0,
  size: 50,
  totalElements: 3,
};

/** The listings a report's figure leads to: one with a board title as long as a URL, unbroken. */
const listingPage: Paged<MasiListingRow> = {
  content: [...listingRows, { ...listingRows[1], id: 43, title: UNBROKEN }],
  page: 0,
  size: 50,
  totalElements: 3,
};

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
/** A board's employer masi has not placed: no code, no website, and a visit to a guess with much to say. */
const unplaced: MasiCompany = {
  ...company,
  id: 8,
  name: `${LONG_TITLE} OÜ`,
  registryCode: null,
  website: null,
  address: null,
  origin: 'FROM_LISTING',
  registerSeenAt: null,
};
/** The longest a registrable domain's label may be (63), guessed from the name: the host is one unbroken word. */
const GUESSED = `${'kaugeltvaadatudtarkvaraarendus'.repeat(2)}ab.ee`;
const visits: Record<string, MasiCompanyVisits> = {
  '8': {
    latest: {
      runAt: '2026-09-21T22:00:00Z',
      outcome: 'UNCONFIRMED',
      candidateUrl: `https://${GUESSED}/`,
      evidence: `${GUESSED} prints registry code 16267372, which fits its name: ${UNBROKEN}`,
      adoptedCode: null,
      careersUrl: UNBROKEN,
      atsVendor: 'teamdash',
      requests: 6,
      cut: true,
      foundBy: 'GUESS',
      triedUrl: `https://${GUESSED.replace('.ee', '.com')}/`,
      namedCode: '16267372',
    },
    attempt: {
      runAt: '2026-09-22T05:00:00Z',
      outcome: 'VISIT_FAILED',
      candidateUrl: null,
      evidence: null,
      adoptedCode: null,
      careersUrl: null,
      atsVendor: null,
      requests: 0,
      cut: false,
      foundBy: null,
      triedUrl: null,
      namedCode: null,
    },
    visiting: true,
  },
};
const byId: Record<string, MasiCompany> = {
  '8': unplaced,
  '4': small,
  '5': named(5, 'HORTICOM OÜ', '10003666'),
  '6': named(6, 'ARTISTON, OÜ', '10242514'),
  '7': named(7, 'An OÜ dormant since 2022', '10002603'),
};

const none = { content: [], page: 0, size: 200, totalElements: 0 };

/** A recruiter with a long address, tied to the long-named company: Save beside the red "Do not contact". */
const person: MasiPerson = {
  found: [
    {
      contactId: 71,
      origin: 'FROM_LISTING',
      source: 'cvee',
      sourceName: 'CV.ee',
      profileUrl: null,
      linkedinUrl: null,
      title: 'Recruiter',
      email: 'kati@example.ee',
      companyId: 1,
      companyName: 'Example OÜ',
      listingId: null,
      listingUrl: null,
      listingTitle: null,
      firstSeenAt: '2026-09-01T09:00:00Z',
      lastSeenAt: '2026-09-20T09:00:00Z',
      pictures: 3,
    },
  ],
  connections: [
    {
      personId: 61,
      name: 'Stanislav Tamm',
      follows: false,
      followedBy: false,
      sameAddress: false,
      faceDistance: 0.322,
      samePicture: false,
    },
    {
      personId: 62,
      name: 'Mari Kask',
      follows: false,
      followedBy: false,
      sameAddress: false,
      faceDistance: null,
      samePicture: true,
    },
    {
      personId: 63,
      name: 'Jaan Lepik',
      follows: true,
      followedBy: true,
      sameAddress: false,
      faceDistance: 0.58,
      samePicture: false,
    },
  ],
  id: 5,
  name: 'Kati Kask-Maasikas-Mustikas',
  email: `kati.kask-maasikas-mustikas@${'recruiting'.repeat(4)}.example`,
  phone: '+372 5555 5555',
  title: 'Senior Talent Acquisition Partner, Engineering and Product',
  doNotContact: false,
  userNote: null,
  firstSeenAt: '2026-09-16T10:00:00Z',
  lastSeenAt: '2026-09-22T05:00:00Z',
  ties: [
    {
      companyId: 3,
      companyName: company.name,
      agency: false,
      role: 'POSTED_FOR',
      evidence: 'LISTING',
      evidenceRef: 'listing 1',
      since: '2026-09-16T10:00:00Z',
      until: null,
      where: 'SOMEWHERE_ELSE',
      contactId: 5,
    },
  ],
};

export interface Answer {
  status: number;
  body?: unknown;
  /** An image answer: a small picture in place of a JSON body. */
  png?: boolean;
}

const personPictures: MasiContactPicture[] = [
  {
    id: 701,
    source: 'GRAVATAR',
    sourceUrl: 'https://gravatar.example/a',
    contentType: 'image/png',
    size: 41230,
    capturedAt: '2026-09-22T06:00:00Z',
    createdAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 702,
    source: 'GRAVATAR',
    sourceUrl: 'https://gravatar.example/a',
    contentType: 'image/png',
    size: 52310,
    capturedAt: '2026-09-15T06:00:00Z',
    createdAt: '2026-09-15T06:00:00Z',
  },
  {
    id: 703,
    source: 'NAME_SEARCH',
    sourceUrl: 'https://duckduckgo.example/b',
    contentType: 'image/jpeg',
    size: 18400,
    capturedAt: '2026-09-10T12:00:00Z',
    createdAt: '2026-09-10T12:00:00Z',
  },
];

const personPictureTries: MasiPictureTries = {
  triesLeft: 8,
  contacts: [
    {
      contactId: 71,
      sources: [
        {
          source: 'GRAVATAR',
          tries: 0,
          max: 3,
          left: 3,
          lastTriedAt: '2026-09-22T06:00:00Z',
          lastOutcome: 'FOUND',
          nextAskAt: '2026-10-22T06:00:00Z',
        },
        {
          source: 'UNAVATAR',
          tries: 3,
          max: 3,
          left: 0,
          lastTriedAt: '2026-09-12T06:00:00Z',
          lastOutcome: 'NONE',
          nextAskAt: null,
        },
        {
          source: 'GITHUB',
          tries: 0,
          max: 3,
          left: 3,
          lastTriedAt: null,
          lastOutcome: null,
          nextAskAt: null,
        },
        {
          source: 'NAME_SEARCH',
          tries: 1,
          max: 3,
          left: 2,
          lastTriedAt: '2026-09-21T06:00:00Z',
          lastOutcome: 'FAILED',
          nextAskAt: null,
        },
      ],
    },
  ],
};

/** masi's answer to a GET of the pages under test; undefined for a request no fixture covers. */
/** An RSS feed as the monitor answers it: a name and an address longer than a settings line, two collections. */
const rssFeed: RssFeedMonitorConfig = {
  id: 1,
  name: 'err.ee',
  url: 'https://www.err.ee/rss?limit=500&' + 'unbroken'.repeat(12),
  cron: '0 */30 * * * *',
  fetchContent: true,
  countWindow: '1d',
  chartPeriod: '2d',
  enabled: true,
  collections: [
    {
      name: 'Topics',
      metrics: [
        { name: 'Tehnoloogia', keywords: ['tehnoloogia', 'IT'] },
        { name: 'Majandus', keywords: ['majandus'] },
      ],
    },
    { name: 'Places', metrics: [{ name: 'Tallinn', keywords: ['tallinn'] }] },
  ],
};
const rssOptions: RssOptions = {
  chartPeriods: ['1d', '2d', '7d', '30d', '90d', '365d'],
  defaultChartPeriod: '2d',
  countWindows: ['1h', '6h', '12h', '1d', '7d', '30d'],
  defaultCountWindow: '1d',
};
const rssResult = (id: number, hoursAgo: number): RssFeedResult => ({
  id,
  feedName: 'err.ee',
  url: rssFeed.url,
  checkedAt: new Date(Date.parse('2026-09-22T06:00:00Z') - hoursAgo * 3_600_000).toISOString(),
  responseTimeMs: 312,
  httpStatus: 200,
  articleCount: 287,
  errorMessage: null,
  metricCounts: [
    { collectionName: 'Topics', metricName: 'Tehnoloogia', count: 41 },
    { collectionName: 'Topics', metricName: 'Majandus', count: 17 },
    { collectionName: 'Places', metricName: 'Tallinn', count: 63 },
  ],
});
const rssResults: PagedResponse<RssFeedResult> = {
  content: [rssResult(3, 0.5), rssResult(2, 1), rssResult(1, 1.5)],
  pageable: { pageNumber: 0, pageSize: 20 },
  totalElements: 3,
  totalPages: 1,
  last: true,
  first: true,
};
const rssChart: ChartDataByCollection = {
  Topics: [24, 18, 12, 6].map((h, i) => ({
    time: `Sep 2${i} 0${i}:00`,
    timestamp: Date.parse('2026-09-22T06:00:00Z') - h * 3_600_000,
    Tehnoloogia: 30 + i,
    Majandus: 10.5 + i,
  })),
  Places: [24, 18, 12, 6].map((h, i) => ({
    time: `Sep 2${i} 0${i}:00`,
    timestamp: Date.parse('2026-09-22T06:00:00Z') - h * 3_600_000,
    Tallinn: 60 + i,
  })),
};

/** The monitor's RSS and settings calls (the feed's page, the settings page). */
function monitorAnswer(path: string): Answer | undefined {
  const routes: Array<[RegExp, () => Answer]> = [
    [/^\/rss\/config$/, () => ({ status: 200, body: [rssFeed] })],
    [/^\/rss\/config\/options$/, () => ({ status: 200, body: rssOptions })],
    [/^\/rss\/results\/[^/]+$/, () => ({ status: 200, body: rssResults })],
    [/^\/rss\/results\/[^/]+\/chart-data$/, () => ({ status: 200, body: rssChart })],
    [/^\/monitor\/config$/, () => ({ status: 200, body: [] })],
  ];
  const hit = routes.find(([re]) => re.test(path));
  return hit ? hit[1]() : undefined;
}

/**
 * The people list as two sorts show it: by name a page of short rows, by when seen a page with a long address and a long
 * company list - the rows that made the columns jump before they kept their widths (2026-11-08).
 */
/** A large employer's people as the people list answers the company card: the first 25 by name, of 103. */
function companyPeople(companyId: number) {
  const names = ['Aino', 'Birgit', 'Carmen', 'Diana', 'Eero', 'Fred', 'Grete', 'Hannes', 'Ilmar', 'Jaan', 'Kati', 'Lauri', 'Mari'];
  const content: MasiPerson[] = Array.from({ length: 25 }, (_, i) => ({
    ...person,
    id: 300 + i,
    name: `${names[i % names.length]} ${['Kask', 'Tamm', 'Saar', 'Mets'][i % 4]}`,
    email: `person${i}@example-employer.ee`,
    ties: person.ties.slice(0, 1).map((t) => ({ ...t, companyId })),
  })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));   // by name, as the server orders them
  return { content, page: 0, size: 25, totalElements: 103 };
}

function personsPage(sort: string) {
  const long = sort.startsWith('lastSeenAt');
  const content: MasiPerson[] = [1, 2, 3].map((i) => ({
    ...person,
    id: 100 + i,
    name: long ? `Kati Kask-Maasikas-Mustikas ${i}` : `Ann ${i}`,
    email: long
      ? `kati.kask-maasikas-mustikas.${i}@${'recruiting'.repeat(5)}.example`
      : `ann${i}@x.ee`,
    ties: long ? person.ties.concat(person.ties).concat(person.ties) : person.ties.slice(0, 1),
  }));
  return {
    content,
    pageable: { pageNumber: 0, pageSize: 50 },
    totalElements: 3,
    totalPages: 1,
    last: true,
  };
}

/**
 * The live stats day by day for any window: a working week's shape (weekdays busy, weekends quiet), so the charts are
 * drawn with real slopes, pairs crossing and a quiet day of zeros.
 */
function statsDays(from: string, to: string) {
  const days = [];
  for (
    let d = new Date(`${from}T12:00:00Z`);
    d <= new Date(`${to}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(statsDay(d));
  }
  return days;
}

/** One fixture day: busy on a weekday, quiet at the weekend, varied by the date so the lines move. */
function statsDay(d: Date) {
  const busy = d.getUTCDay() % 6 !== 0;
  const n = d.getUTCDate();
  const pick = (weekday: number, weekend: number) => (busy ? weekday : weekend);
  return {
    day: d.toISOString().slice(0, 10),
    newJobs: pick(18 + (n % 7) * 3, 2),
    closedJobs: pick(12 + (n % 5) * 4, 1),
    repostedJobs: n % 4 === 0 ? 1 : 0,
    newListings: pick(40 + (n % 6) * 5, 6),
    closedListings: pick(30 + (n % 4) * 6, 3),
    applied: n % 3 === 0 ? 1 : 0,
    llmUsd: pick(0.35 + (n % 5) * 0.11, 0.02),
    llmCalls: { OK: pick(20, 1) },
  };
}

/** The Sources page's sources: GitHub's config is long - the box it shows in scrolls, never the page. */
const SOURCES = [
  {
    id: 1,
    key: 'github',
    name: 'GitHub — IT specialists in Estonia',
    kind: 'DETERMINISTIC',
    scope: 'PEOPLE',
    baseUrl: 'https://api.github.com',
    cron: '0 23 * * * *',
    nextRunAt: '2026-09-22T09:23:00Z',
    enabled: true,
    configJson: JSON.stringify({
      token: '****',
      locations: ['Estonia', 'Tallinn', 'Tartu', 'Narva', 'Pärnu'],
      queries: [
        'location:Estonia language:Java',
        'location:Tallinn language:Kotlin',
        'location:Tartu language:TypeScript',
      ],
      requestsPerDay: 4500,
      orgs: [],
    }),
    termsNote: null,
    health: 'OK',
    consecutiveFailures: 0,
    lastRunAt: '2026-09-22T08:23:00Z',
    lastSuccessAt: '2026-09-22T08:23:00Z',
    lastError: null,
    running: false,
  },
  {
    id: 2,
    key: 'cvee',
    name: 'cv.ee',
    kind: 'DETERMINISTIC',
    scope: 'JOBS',
    baseUrl: 'https://cv.ee',
    cron: '0 17 * * * *',
    nextRunAt: '2026-09-22T09:17:00Z',
    enabled: true,
    configJson: null,
    termsNote: null,
    health: 'OK',
    consecutiveFailures: 0,
    lastRunAt: '2026-09-22T08:17:00Z',
    lastSuccessAt: '2026-09-22T08:17:00Z',
    lastError: null,
    running: false,
  },
];

const SOURCE_CHANGES = [
  {
    field: 'enabled',
    oldValue: 'false',
    newValue: 'true',
    changedBy: 'the operator',
    changedAt: '2026-09-21T10:00:00Z',
  },
  {
    field: 'config',
    oldValue: JSON.stringify({ orgs: ['bolt', 'wise', 'pipedrive'] }),
    newValue: SOURCES[0].configJson,
    changedBy: 'a migration',
    changedAt: '2026-09-20T03:00:00Z',
  },
  {
    field: 'cron',
    oldValue: '0 0 3 * * *',
    newValue: '0 23 * * * *',
    changedBy: 'masi',
    changedAt: '2026-09-19T12:00:00Z',
  },
];

const SWITCHES = {
  companyVisits: { enabled: true, perTick: 20, revisit: 'PT720H' },
  contactPictures: {
    enabled: true,
    perTick: 40,
    tick: 'PT10M',
    revisit: 'PT720H',
    maxRequestsPerDay: 2000,
    gravatar: true,
    unavatar: true,
    companySite: true,
    linkedin: false,
    nameSearch: true,
    face: false,
  },
  analysis: { auto: true, perTick: 4, matchAuto: true },
  tuning: { auto: false, minMatch: 60 },
  mail: { enabled: true, weeklyAuto: false },
  allowedHosts: ['cv.ee', 'cvkeskus.ee', 'api.github.com', 'boards.greenhouse.io', 'api.lever.co'],
};

export function answer(url: URL): Answer | undefined {
  if (!url.pathname.startsWith('/api/masi')) {
    return monitorAnswer(url.pathname.replace(/^\/api/, ''));
  }
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
    [/^\/jobs\/\d+$/, () => ({ status: 200, body: details[path.split('/')[2]] ?? detail })],
    [/^\/jobs\/\d+\/history$/, () => ({ status: 200, body: [] })],
    [/^\/jobs\/\d+\/similar$/, () => ({ status: 200, body: [] })],
    [
      // a queue of 137: the first page of 50, the pager under it - the two fixture packages first, then the rest of the page
      /^\/packages\/page$/,
      () => ({
        status: 200,
        body: {
          content: [
            ...packages,
            ...Array.from({ length: 48 }, (_, i) => ({
              ...(prepared as MasiPackage),
              id: 100 + i,
              jobId: 200 + i,
              jobTitle: `Backend Developer ${i + 1}`,
              companyName: i % 3 === 0 ? 'Bolt Technology OÜ' : 'Wise Payments Estonia AS',
              status: i % 4 === 0 ? 'REVIEWED' : 'PREPARED',
            })),
          ],
          page: Number(q.get('page') ?? 0),
          size: 50,
          totalElements: 137,
        },
      }),
    ],
    [
      /^\/packages$/,
      () => {
        const byJob: Record<string, MasiPackage[]> = {
          '9': [reviewed],
          '10': [reviewedNoMail],
          '11': [mailed],
        };
        return { status: 200, body: byJob[q.get('job') ?? ''] ?? packages };
      },
    ],
    [
      /^\/packages\/\d+\/send$/,
      () =>
        path.split('/')[2] === '23'
          ? { status: 200, body: mailedSend }
          : { status: 404, body: { error: 'Not found' } },
    ],
    [
      /^\/packages\/\d+\/send-preview$/,
      () => {
        const p = sendPreviews[path.split('/')[2]];
        return p ? { status: 200, body: p } : { status: 404, body: { error: 'Not found' } };
      },
    ],
    [/^\/companies\/\d+$/, () => ({ status: 200, body: byId[path.split('/')[2]] ?? company })],
    [/^\/companies\/\d+\/register-match$/, () => ({ status: 204 })],
    [
      /^\/companies\/\d+\/register-candidates$/,
      () => ({ status: 200, body: { indexed: true, truncated: false, candidates: [] } }),
    ],
    [
      /^\/companies\/\d+\/enrichment$/,
      () => {
        const v = visits[path.split('/')[2]];
        return v ? { status: 200, body: v } : { status: 404, body: { error: 'no visit yet' } };
      },
    ],
    [/^\/companies\/\d+\/contacts$/, () => ({ status: 200, body: none })],
    [
      /^\/companies\/\d+\/figures$/,
      () => ({ status: 200, body: figures[path.split('/')[2]] ?? { quarters: [] } }),
    ],
    [/^\/persons$/, () => ({ status: 200, body: q.get('company') ? companyPeople(Number(q.get('company'))) : personsPage(url.searchParams.get('sort') ?? '') })],
    [/^\/persons\/of-company\/\d+$/, () => ({ status: 200, body: [] })],
    [/^\/contacts\/pictures\/for$/, () => ({ status: 200, body: {} })],   // no faces: the names alone
    [/^\/persons\/\d+$/, () => ({ status: 200, body: person })],
    // the Sources page: two sources (one with a long config), their changes, the deployment's switches
    [/^\/sources$/, () => ({ status: 200, body: SOURCES })],
    [/^\/sources\/switches$/, () => ({ status: 200, body: SWITCHES })],
    [/^\/sources\/\d+\/history$/, () => ({ status: 200, body: SOURCE_CHANGES })],
    [
      /^\/sources\/\d+\/runs$/,
      () => ({ status: 200, body: { content: [], page: 0, size: 20, totalElements: 0 } }),
    ],
    [
      /^\/assistant$/,
      () => ({ status: 200, body: { enabled: false, gmailReady: false, linkedinReady: false } }),
    ],
    [
      /^\/contacts\/pictures\/status$/,
      () => ({
        status: 200,
        body: {
          enabled: true,
          face: false,
          perTick: 40,
          tick: 'PT10M',
          revisit: 'PT720H',
          contactsWithAPicture: 697,
          lookupsByOutcome: { FOUND: 697, NONE: 1200 },
          askedToday: 320,
          dueNow: 15,
        },
      }),
    ],
    [/^\/contacts\/71\/pictures\/\d+$/, () => ({ status: 200, png: true })],
    [/^\/contacts\/71\/pictures$/, () => ({ status: 200, body: personPictures })],
    // the person page asks for each contact's pictures: none collected
    [/^\/contacts\/\d+\/pictures$/, () => ({ status: 200, body: [] })],
    [/^\/persons\/\d+\/picture-tries$/, () => ({ status: 200, body: personPictureTries })],
    [/^\/activity$/, () => ({ status: 200, body: activityPage })],
    [/^\/packages\/retune$/, () => ({ status: 200, body: { count: 12, estimatedUsd: 3.42 } })],
    [/^\/reports$/, () => ({ status: 200, body: [report] })],
    [/^\/stats$/, () => ({ status: 200, body: report.stats })],
    [
      /^\/stats\/daily$/,
      () => ({ status: 200, body: statsDays(q.get('from') ?? '', q.get('to') ?? '') }),
    ],
    [/^\/reports\/5$/, () => ({ status: 200, body: report })],
    [/^\/reports\/6$/, () => ({ status: 200, body: bigReport })],
    [/^\/listings$/, () => ({ status: 200, body: listingPage })],
    [
      /^\/calendar\/events$/,
      () => ({ status: 200, body: { content: bookings, page: 0, size: 50, totalElements: 2 } }),
    ],
  ];
  const hit = routes.find(([re]) => re.test(path));
  return hit ? hit[1]() : undefined;
}
