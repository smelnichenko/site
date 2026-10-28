import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchSummary from './MatchSummary';
import type { MasiMatch, MasiMatchRequirement } from '../../services/api';

function req(over: Partial<MasiMatchRequirement>): MasiMatchRequirement {
  return {
    id: 'M1',
    category: 'MUST',
    text: 'Kafka',
    english: null,
    kind: 'SKILL',
    verdict: 'NOT_MET',
    evidence: [],
    reason: 'Nothing in the CV shows Kafka.',
    decidedBy: 'model',
    ...over,
  };
}

const match: MasiMatch = {
  score: 40,
  supportedMustHave: [],
  missingMustHave: ['Kafka'],
  notScored: ['Team player'],
  unscored: null,
  method: 'AI',
  requirements: [
    req({}),
    req({ id: 'M2', text: 'Go', verdict: 'MET', decidedBy: 'you', reason: 'two services in Go' }),
    req({ id: 'M3', text: 'Team player', verdict: 'NOT_A_CV_THING', reason: null }),
  ],
};

/** The met / not met list is the operator's to correct: each requirement takes their verdict and note, or the model's again. */
describe('MatchSummary verdicts', () => {
  it("sends the operator's verdict and note for a requirement", async () => {
    const judge = vi.fn().mockResolvedValue(undefined);
    render(<MatchSummary match={match} onJudge={judge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change the verdict on Kafka' }));
    await userEvent.selectOptions(screen.getByLabelText('Verdict on Kafka'), 'MET');
    await userEvent.type(screen.getByLabelText('Why (optional)'), 'built the event bus on Kafka');
    await userEvent.click(screen.getByRole('button', { name: 'Save verdict' }));
    await waitFor(() =>
      expect(judge).toHaveBeenCalledWith('M1', 'MET', 'built the event bus on Kafka'),
    );
    expect(screen.queryByLabelText('Verdict on Kafka')).not.toBeInTheDocument();
  });

  it("names the operator's own verdict and takes it back to the model's", async () => {
    const judge = vi.fn().mockResolvedValue(undefined);
    render(<MatchSummary match={match} onJudge={judge} />);
    expect(screen.getByText('Your verdict.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change the verdict on Go' }));
    await userEvent.click(screen.getByRole('button', { name: "Back to the model's" }));
    await waitFor(() => expect(judge).toHaveBeenCalledWith('M2', null, null));
  });

  it('a requirement no CV can show can be judged too', async () => {
    const judge = vi.fn().mockResolvedValue(undefined);
    render(<MatchSummary match={match} onJudge={judge} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Change the verdict on Team player' }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Verdict on Team player'), 'PARTLY');
    await userEvent.click(screen.getByRole('button', { name: 'Save verdict' }));
    await waitFor(() => expect(judge).toHaveBeenCalledWith('M3', 'PARTLY', null));
  });

  it('says what masi refused and keeps the form open', async () => {
    const judge = vi.fn().mockRejectedValue(new Error('no active CV version: activate one first'));
    render(<MatchSummary match={match} onJudge={judge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change the verdict on Kafka' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save verdict' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no active CV version');
    expect(screen.getByLabelText('Verdict on Kafka')).toBeInTheDocument();
  });

  it('the folded keywords offer their verdicts only once opened', async () => {
    const judge = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchSummary
        match={{
          ...match,
          requirements: [req({ id: 'K1', category: 'KEYWORD', text: 'Kafka Streams' })],
        }}
        onJudge={judge}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Change the verdict on Kafka Streams' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(/The posting’s keywords/));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Change the verdict on Kafka Streams' }),
    );
    expect(screen.getByLabelText('Verdict on Kafka Streams')).toBeInTheDocument();
  });

  it('without a way to judge, offers none', () => {
    render(<MatchSummary match={match} />);
    expect(screen.queryByRole('button', { name: /Change the verdict/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Press a verdict/)).not.toBeInTheDocument();
  });
});
