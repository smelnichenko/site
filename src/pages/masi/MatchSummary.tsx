import { useId } from 'react';
import type { MasiMatch, MasiUnscored } from '../../services/api';

const WHY_NOT: Record<MasiUnscored, string> = {
  NOTHING_STATED: 'The posting states no requirement a CV could be compared with.',
  OTHER_LANGUAGE:
    'The posting is written in another language than your CV: its words cannot be compared, so there is no score.',
  UNREADABLE: 'The analysis of this posting could not be read, so there is no score.',
};

function Phrases({ label, phrases }: Readonly<{ label: string; phrases: string[] }>) {
  const id = useId();
  if (phrases.length === 0) return null;
  return (
    <div className="masi-match-list">
      <span className="masi-match-label" id={id}>
        {label}
      </span>
      <ul aria-labelledby={id}>
        {phrases.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/** How far the active CV master covers what the posting asks for, and the must-haves on either side: a ranking aid, not a verdict. */
export default function MatchSummary({ match }: Readonly<{ match: MasiMatch | null }>) {
  if (!match) return null;
  return (
    <section className="masi-match" aria-label="Match with your CV">
      {match.score === null ? (
        <p className="muted">
          {match.unscored ? WHY_NOT[match.unscored] : 'This job has no score.'}
        </p>
      ) : (
        <p className="masi-match-score">
          <strong>{match.score}</strong>
          <span className="muted">
            {' '}
            of 100 — how much of what the posting asks for your CV shows in words
          </span>
        </p>
      )}
      <Phrases label="Your CV shows" phrases={match.supportedMustHave} />
      <Phrases label="Your CV does not show" phrases={match.missingMustHave} />
      <Phrases label="Not compared" phrases={match.notScored} />
    </section>
  );
}
