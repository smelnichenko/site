import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

/** Renders a masi page under a router at the given path so links, params and search params work. */
export function renderAt(path: string, route: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
    </MemoryRouter>,
  );
}

export const job = {
  id: 7,
  title: 'Senior Java Developer',
  companyId: 3,
  companyName: 'Nortal AS',
  location: 'Tallinn',
  remote: 'HYBRID',
  salaryMin: null,
  salaryMax: null,
  status: 'OPEN' as const,
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  closedAt: null,
  reopenedCount: 0,
  userNote: null,
  descriptionText: 'We are hiring. token-POSTING',
  matchScore: null,
  match: null,
  listings: [
    {
      id: 1,
      sourceId: 2,
      sourceKey: 'cvee',
      url: 'https://cv.ee/x',
      titleRaw: 'Senior Java Developer',
      companyRaw: 'Nortal',
      postedAt: '2026-09-17T00:00:00Z',
      expiresAt: null,
      firstSeenAt: '2026-09-18T08:00:00Z',
      lastSeenAt: '2026-09-18T09:00:00Z',
      missCount: 0,
      closedAt: null,
    },
  ],
  packageId: null,
  packageStatus: null,
};

export const prepared = {
  id: 11,
  jobId: 7,
  jobTitle: 'Senior Java Developer',
  companyName: 'Nortal AS',
  cvVersionId: 1,
  cvVersion: 2,
  status: 'PREPARED',
  attempts: 1,
  tunedCv: {
    summary: 'Fits the order-API role.',
    title: 'Senior Java Developer',
    roles: [
      {
        company: 'Tõrva Fintech OÜ',
        title: 'Senior Backend Engineer',
        collapsed: false,
        bullets: [{ achievementIndex: 0, text: 'Cut p99 latency from 800 ms to 120 ms' }],
      },
      {
        company: 'Riigi Infosüsteemide Amet',
        title: 'Software Developer',
        collapsed: true,
        bullets: [],
      },
    ],
    skills: ['Java', 'Kafka'],
    coverLetter: 'Dear Nortal team, token-LETTER',
  },
  coverLetter: 'Dear Nortal team, token-LETTER',
  claims: [],
  lint: [{ rule: 'keyword', detail: "the master supports 'Kafka' but the output never says it" }],
  model: 'claude-opus-5',
  costUsd: 0.12,
  error: null,
  userNotes: null,
  appliedAt: null,
  response: 'NONE',
  createdAt: '2026-09-18T09:00:00Z',
  updatedAt: '2026-09-18T09:05:00Z',
  artifacts: [
    {
      kind: 'CV_PDF' as const,
      contentType: 'application/pdf',
      size: 20000,
      sha256: 'ab',
      available: true,
    },
    {
      kind: 'LETTER_TXT' as const,
      contentType: 'text/plain',
      size: 400,
      sha256: 'cd',
      available: true,
    },
  ],
};
