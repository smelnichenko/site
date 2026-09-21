import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MatchSummary from './MatchSummary';
import type { MasiMatch } from '../../services/api';

const scored: MasiMatch = {
  score: 57,
  supportedMustHave: ['Java', 'Kafka'],
  missingMustHave: ['Go', 'Terraform'],
  notScored: ['Strong experience'],
  unscored: null,
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

  it('renders nothing for a job that has not been analysed', () => {
    const { container } = render(<MatchSummary match={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
