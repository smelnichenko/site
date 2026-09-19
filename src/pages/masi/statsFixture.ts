import type { MasiReport, MasiStats } from '../../services/api';

/** The DST-start week of 2026-03-23 .. 03-30 as the backend's fixtures add it up. */
export const stats: MasiStats = {
  from: '2026-03-22T22:00:00Z',
  to: '2026-03-29T21:00:00Z',
  registry: {
    newJobs: 2,
    closedJobs: 1,
    newListings: 2,
    closedListings: 1,
    medianListingLifetimeHours: 120,
  },
  sources: [
    {
      key: 'cvee',
      name: 'cv.ee',
      newListings: 2,
      closedListings: 1,
      runs: { OK: 1, ERROR: 1, TIMEOUT: 0 },
      llmCostUsd: 0.02,
    },
    {
      key: 'bolt',
      name: 'Bolt careers',
      newListings: 0,
      closedListings: 0,
      runs: { OK: 0 },
      llmCostUsd: 0,
    },
  ],
  topCompanies: [
    { id: 3, name: 'Nortal AS', newJobs: 2 },
    { id: 4, name: null, newJobs: 1 },
  ],
  titles: [
    { value: 'java developer', count: 2 },
    { value: 'senior java developer', count: 1 },
  ],
  seniority: { mid: 1, senior: 1 },
  remote: { HYBRID: 1, REMOTE: 1 },
  techTags: { java: 2, kubernetes: 1, spring: 1 },
  salary: { posted: 2, lowest: 2500, medianMin: 2750, medianMax: 4500, highest: 4500 },
  funnel: { requested: 2, applied: 1, averagePackageCostUsd: 0.2 },
  llm: {
    totalUsd: 0.6,
    byPurpose: { EXTRACT: 0.1, TUNE: 0.5, LETTER: 0, SCORE: 0, ENRICH: 0 },
    byModel: { 'claude-opus-5': 0.5, 'claude-haiku-4-5-20251001': 0.1 },
    calls: { PENDING: 0, OK: 1, ERROR: 1, LOST: 0 },
    tokens: { input: 1050, cacheRead: 200, cacheWrite: 300, output: 400 },
  },
};

export const report: MasiReport = {
  id: 5,
  kind: 'WEEKLY',
  periodStart: '2026-03-22T22:00:00Z',
  periodEnd: '2026-03-29T21:00:00Z',
  generatedAt: '2026-03-30T03:00:00Z',
  stats,
  snapshot: {
    asOf: '2026-03-30T03:00:00Z',
    openJobs: 254,
    companiesHiring: 86,
    sourceHealth: { cvee: 'OK', bolt: 'DISABLED' },
    packagesNow: { NEW: 0, PREPARED: 2, APPLIED: 1, SKIPPED: 0 },
  },
};
