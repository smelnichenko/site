import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MatchSummary from './MatchSummary';
import type { MasiMatch, MasiMatchRequirement } from '../../services/api';
import realAi from './aiMatchFixture.json';

const scored: MasiMatch = {
  score: 57,
  supportedMustHave: ['Java', 'Kafka'],
  missingMustHave: ['Go', 'Terraform'],
  notScored: ['Strong experience'],
  unscored: null,
};

function req(over: Partial<MasiMatchRequirement>): MasiMatchRequirement {
  return {
    id: 'M1',
    category: 'MUST',
    text: 'Java',
    english: null,
    kind: 'SKILL',
    verdict: 'MET',
    evidence: [],
    reason: null,
    decidedBy: 'model',
    ...over,
  };
}

const ai: MasiMatch = {
  score: 93,
  supportedMustHave: [],
  missingMustHave: [],
  notScored: [],
  unscored: null,
  method: 'AI',
  requirements: [
    req({
      text: 'Kubernetese kogemus',
      english: 'Kubernetes experience',
      evidence: [
        { id: 'S7', label: 'Kubernetes' },
        { id: 'R1', label: 'Tõrva Fintech OÜ · Senior Backend Engineer, 2021-03 – present' },
      ],
      reason: 'Runs Kubernetes in the current role.',
    }),
    req({
      id: 'M2',
      text: '5+ years of Java',
      kind: 'YEARS',
      evidence: [{ id: 'R1', label: 'Tõrva Fintech' }],
      reason: 'Ten years in two roles',
      decidedBy: 'dates',
    }),
    req({
      id: 'M3',
      text: 'Estonian C2',
      verdict: 'PARTLY',
      decidedBy: 'languages',
      evidence: [{ id: 'L1', label: 'Estonian: C1' }],
    }),
    req({ id: 'M4', text: 'Go', english: ' go ', verdict: 'NOT_MET', reason: 'No Go anywhere.' }),
    req({
      id: 'M5',
      text: 'meeskonnamängija',
      english: 'a team player',
      verdict: 'NOT_A_CV_THING',
    }),
    req({
      id: 'N1',
      category: 'NICE',
      text: 'Terraform',
      verdict: 'PARTLY',
      evidence: [{ id: 'S8', label: 'AWS' }],
      reason: 'Cloud, not Terraform.',
    }),
    req({ id: 'N2', category: 'NICE', text: 'curiosity', verdict: 'NOT_A_CV_THING' }),
    req({ id: 'K1', category: 'KEYWORD', text: 'Kafka', evidence: [{ id: 'S5', label: 'Kafka' }] }),
    req({
      id: 'K2',
      category: 'KEYWORD',
      text: 'SQL',
      verdict: 'PARTLY',
      evidence: [{ id: 'S3', label: 'SQL' }],
    }),
    req({ id: 'K3', category: 'KEYWORD', text: 'Rust', verdict: 'NOT_MET' }),
    req({ id: 'K4', category: 'KEYWORD', text: 'agile mindset', verdict: 'NOT_A_CV_THING' }),
  ],
};

/** The rows of a list, as text. */
function rows(list: HTMLElement) {
  return within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent);
}

describe('MatchSummary', () => {
  it('says the score and names the must-haves on either side of it', () => {
    render(<MatchSummary match={scored} />);
    const region = screen.getByRole('region', { name: 'Match with your CV' });
    expect(within(region).getByText('57')).toBeInTheDocument();
    const items = (list: string) =>
      within(within(region).getByRole('list', { name: list }))
        .getAllByRole('listitem')
        .map((li) => li.textContent);
    expect(items('Your CV shows')).toEqual(['Java', 'Kafka']);
    expect(items('Your CV does not show')).toEqual(['Go', 'Terraform']);
    expect(items('Not compared')).toEqual(['Strong experience']);
  });

  it('leaves out a list that is empty', () => {
    render(<MatchSummary match={{ ...scored, score: 100, missingMustHave: [], notScored: [] }} />);
    expect(screen.queryByText('Your CV does not show')).not.toBeInTheDocument();
    expect(screen.queryByText('Not compared')).not.toBeInTheDocument();
  });

  it('says why there is no number instead of showing a zero', () => {
    const { rerender } = render(
      <MatchSummary match={{ ...scored, score: null, unscored: 'OTHER_LANGUAGE' }} />,
    );
    expect(screen.getByText(/written in another language than your CV/)).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    rerender(<MatchSummary match={{ ...scored, score: null, unscored: 'NOTHING_STATED' }} />);
    expect(
      screen.getByText(/states no requirement a CV could be compared with/),
    ).toBeInTheDocument();
    rerender(<MatchSummary match={{ ...scored, score: null, unscored: 'UNREADABLE' }} />);
    expect(screen.getByText(/analysis of this posting could not be read/)).toBeInTheDocument();
  });

  it('lists each requirement of an AI match with its verdict in words, what shows it and why', () => {
    render(<MatchSummary match={ai} />);
    const region = screen.getByRole('region', { name: 'Match with your CV' });
    expect(region).toHaveTextContent(
      '93 of 100 — what the posting asks for, judged by AI against the evidence in your CV',
    );
    expect(rows(within(region).getByRole('list', { name: 'What the posting requires' }))).toEqual([
      'met Kubernetes experience — “Kubernetese kogemus”' +
        'shown by Kubernetes; Tõrva Fintech OÜ · Senior Backend Engineer, 2021-03 – present' +
        'Runs Kubernetes in the current role.',
      'met 5+ years of Javashown by Tõrva FintechTen years in two roles — counted from the dates of your roles',
      'partly Estonian C2shown by Estonian: C1read from the languages on your CV',
      'not met GoNo Go anywhere.', // its English is its own words, spaced: shown once
    ]);
    expect(rows(within(region).getByRole('list', { name: 'What it would like' }))).toEqual([
      'partly Terraformshown by AWSCloud, not Terraform.',
    ]);
    expect(rows(within(region).getByRole('list', { name: 'Not something a CV shows' }))).toEqual([
      'a team player',
      'curiosity',
      'agile mindset',
    ]);
    const kube = within(region).getAllByRole('listitem')[0];
    expect(kube).toHaveClass('masi-req-met');
    expect(within(region).queryByText('Your CV shows')).not.toBeInTheDocument();
  });

  it('puts what is required first, then what is liked, the keywords, and what a CV cannot show', () => {
    render(<MatchSummary match={ai} />);
    const region = screen.getByRole('region', { name: 'Match with your CV' });
    const order = [
      ...region.querySelectorAll('h4, summary, .masi-match-label'), // eslint-disable-line testing-library/no-node-access
    ].map((el) => el.textContent);
    expect(order).toEqual([
      'What the posting requires',
      'What it would like',
      'The posting’s keywords: your CV shows 2 of 3',
      'Keywords',
      'Not something a CV shows',
    ]);
  });

  it('folds the keywords, each with its verdict and evidence, partly counted as shown', () => {
    render(<MatchSummary match={ai} />);
    const folded = screen.getByRole('group');
    expect(folded).toHaveTextContent('The posting’s keywords: your CV shows 2 of 3');
    expect(folded).not.toHaveAttribute('open');
    expect(rows(within(folded).getByRole('list', { name: 'Keywords' }))).toEqual([
      'met Kafkashown by Kafka',
      'partly SQLshown by SQL',
      'not met Rust',
    ]);
  });

  it('folds nothing when the posting names no keywords', () => {
    render(
      <MatchSummary
        match={{ ...ai, requirements: ai.requirements?.filter((r) => r.category !== 'KEYWORD') }}
      />,
    );
    expect(screen.getByRole('list', { name: 'What the posting requires' })).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('shows an AI match with nothing to judge as the reason and what a CV cannot show, never the word lists', () => {
    render(
      <MatchSummary
        match={{
          ...ai,
          score: null,
          unscored: 'NOTHING_STATED',
          supportedMustHave: ['Java'],
          requirements: [req({ text: 'a team player', verdict: 'NOT_A_CV_THING' })],
        }}
      />,
    );
    expect(
      screen.getByText(/states no requirement a CV could be compared with/),
    ).toBeInTheDocument();
    expect(rows(screen.getByRole('list', { name: 'Not something a CV shows' }))).toEqual([
      'a team player',
    ]);
    expect(screen.queryByRole('list', { name: 'Your CV shows' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('shows a word match as before, and a row older than the AI match as a word match', () => {
    const { rerender } = render(<MatchSummary match={{ ...scored, method: 'WORDS' }} />);
    expect(screen.getByText(/your CV shows in words/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your CV shows' })).toBeInTheDocument();
    rerender(<MatchSummary match={scored} />);
    expect(screen.getByText(/your CV shows in words/)).toBeInTheDocument();
    expect(screen.queryByText(/judged by AI/)).not.toBeInTheDocument();
  });

  it('reads the AI match masi sends as it sends it', () => {
    // a real answer of masi's AI match (its evaluation, against the fictitious sample CV), as stored and served
    render(<MatchSummary match={realAi as MasiMatch} />);
    const region = screen.getByRole('region', { name: 'Match with your CV' });
    expect(region).toHaveTextContent('65 of 100 — what the posting asks for, judged by AI');
    const required = rows(within(region).getByRole('list', { name: 'What the posting requires' }));
    expect(required).toHaveLength(4);
    expect(required[3]).toMatch(
      /^met Estonian language proficiency — “eesti keele valdamine”shown by Estonian: native.*read from the languages on your CV$/,
    );
    expect(screen.getByRole('group')).toHaveTextContent('your CV shows 9 of 14');
  });

  it('renders nothing for a job that has not been analysed', () => {
    const { container } = render(<MatchSummary match={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
