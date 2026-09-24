import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MatchSummary from './MatchSummary';
import type { MasiMatch, MasiMatchRequirement } from '../../services/api';

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
    req({ id: 'M4', text: 'Go', english: 'go', verdict: 'NOT_MET', reason: 'No Go anywhere.' }),
    req({ id: 'M5', text: 'a team player', verdict: 'NOT_A_CV_THING' }),
    req({ id: 'N1', category: 'NICE', text: 'Terraform', verdict: 'NOT_MET' }),
    req({ id: 'K1', category: 'KEYWORD', text: 'Kafka', evidence: [{ id: 'S5', label: 'Kafka' }] }),
    req({
      id: 'K2',
      category: 'KEYWORD',
      text: 'SQL',
      verdict: 'PARTLY',
      evidence: [{ id: 'S3', label: 'SQL' }],
    }),
    req({ id: 'K3', category: 'KEYWORD', text: 'Rust', verdict: 'NOT_MET' }),
  ],
};

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
    expect(region).toHaveTextContent('93 of 100 — what the posting asks for, judged by AI');
    const required = within(region).getByRole('list', { name: 'What the posting requires' });
    const items = within(required).getAllByRole('listitem');
    expect(items.map((li) => /^(met|partly|not met) /.exec(li.textContent ?? '')?.[1])).toEqual([
      'met',
      'met',
      'partly',
      'not met',
    ]);
    expect(items[0]).toHaveTextContent('Kubernetes experience — “Kubernetese kogemus”');
    expect(items[0]).toHaveTextContent(
      'shown by Kubernetes; Tõrva Fintech OÜ · Senior Backend Engineer, 2021-03 – present',
    );
    expect(items[0]).toHaveTextContent('Runs Kubernetes in the current role.');
    expect(items[1]).toHaveTextContent('5+ years of Java');
    expect(items[1]).not.toHaveTextContent('“');
    expect(items[3]).toHaveTextContent('not met GoNo Go anywhere.'); // its English is its own words: shown once
    expect(items[1]).toHaveTextContent(
      'Ten years in two roles — counted from the dates of your roles',
    );
    expect(items[2]).toHaveTextContent('read from the languages on your CV');
    expect(items[3]).not.toHaveTextContent('shown by');
    expect(
      within(within(region).getByRole('list', { name: 'What it would like' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(
      within(within(region).getByRole('list', { name: 'Not something a CV shows' })).getByRole(
        'listitem',
      ),
    ).toHaveTextContent('a team player');
    expect(within(region).queryByText('Your CV shows')).not.toBeInTheDocument();
  });

  it('folds the keywords, counting how many the CV shows, partly counted as shown', () => {
    render(<MatchSummary match={ai} />);
    const folded = screen.getByRole('group');
    expect(folded).toHaveTextContent('The posting’s keywords: your CV shows 2 of 3');
    expect(folded).not.toHaveAttribute('open');
    expect(within(folded).getByRole('list', { name: 'Keywords' })).toBeInTheDocument();
  });

  it('shows an AI match with nothing to judge as the reason, and a word match as before', () => {
    const { rerender } = render(
      <MatchSummary match={{ ...ai, score: null, unscored: 'NOTHING_STATED', requirements: [] }} />,
    );
    expect(
      screen.getByText(/states no requirement a CV could be compared with/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    rerender(<MatchSummary match={{ ...scored, method: 'WORDS' }} />);
    expect(screen.getByText(/your CV shows in words/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your CV shows' })).toBeInTheDocument();
  });

  it('renders nothing for a job that has not been analysed', () => {
    const { container } = render(<MatchSummary match={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
