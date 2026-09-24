import { useId } from 'react';
import type {
  MasiMatch,
  MasiMatchRequirement,
  MasiMatchVerdict,
  MasiUnscored,
} from '../../services/api';

const WHY_NOT: Record<MasiUnscored, string> = {
  NOTHING_STATED: 'The posting states no requirement a CV could be compared with.',
  OTHER_LANGUAGE:
    'The posting is written in another language than your CV: its words cannot be compared, so there is no score.',
  UNREADABLE: 'The analysis of this posting could not be read, so there is no score.',
};

/** The verdict as a word, never as a colour alone. */
const VERDICT_WORDS: Record<MasiMatchVerdict, string> = {
  MET: 'met',
  PARTLY: 'partly',
  NOT_MET: 'not met',
  NOT_A_CV_THING: 'not for a CV',
};

/** Who decided, when it was not the model: masi counted it from the CV itself. */
const DECIDED_BY: Record<MasiMatchRequirement['decidedBy'], string | null> = {
  model: null,
  dates: 'Counted from the dates of your roles.',
  languages: 'Read from the languages on your CV.',
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

/**
 * One requirement: its verdict, what it asks in English with the posting's own words beside, what shows it and why, and
 * who decided when it was masi. The verdict and the body are two columns: a wrapped line stays under its own text.
 */
function Requirement({ r }: Readonly<{ r: MasiMatchRequirement }>) {
  const decided = DECIDED_BY[r.decidedBy];
  // the model gives English for a requirement in another language; the same words again are no translation
  const english =
    r.english && r.english.trim().toLowerCase() !== r.text.trim().toLowerCase() ? r.english : null;
  return (
    <li className={`masi-req masi-req-${r.verdict.toLowerCase()}`}>
      <span className="masi-tag masi-verdict">{VERDICT_WORDS[r.verdict]}</span>{' '}
      <div className="masi-req-body">
        <span>{english ?? r.text}</span>
        {english && <span className="muted"> — “{r.text}”</span>}
        {r.evidence.length > 0 && (
          <div className="masi-req-detail">
            <span className="muted">shown by </span>
            {r.evidence.map((e) => e.label).join('; ')}
          </div>
        )}
        {r.reason && <div className="masi-req-detail muted">{r.reason}</div>}
        {decided && <div className="masi-req-detail muted">{decided}</div>}
      </div>
    </li>
  );
}

function Requirements({
  label,
  items,
}: Readonly<{ label: string; items: MasiMatchRequirement[] }>) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <div className="masi-match-reqs">
      <h3 id={id} className="masi-card-label">
        {label}
      </h3>
      <RequirementList labelledBy={id} items={items} />
    </div>
  );
}

function RequirementList({
  labelledBy,
  items,
}: Readonly<{ labelledBy: string; items: MasiMatchRequirement[] }>) {
  return (
    <ul aria-labelledby={labelledBy}>
      {items.map((r) => (
        <Requirement key={r.id} r={r} />
      ))}
    </ul>
  );
}

/** The keywords, folded: the summary says how many the CV shows and names the list it opens. */
function Keywords({ items }: Readonly<{ items: MasiMatchRequirement[] }>) {
  const id = useId();
  if (items.length === 0) return null;
  const shown = items.filter((r) => r.verdict !== 'NOT_MET').length;
  return (
    <details className="masi-match-keywords">
      <summary id={id}>
        The posting’s keywords: your CV shows {shown} of {items.length}
      </summary>
      <RequirementList labelledBy={id} items={items} />
    </details>
  );
}

/** What no CV can show, from every list, named once: a heading of its own like the lists above it. */
function Traits({ items }: Readonly<{ items: MasiMatchRequirement[] }>) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <div className="masi-match-list">
      <h3 className="masi-match-label" id={id}>
        Not for a CV
      </h3>
      <ul aria-labelledby={id}>
        {items.map((r) => (
          <li key={r.id}>{r.english ?? r.text}</li>
        ))}
      </ul>
    </div>
  );
}

/** Each requirement judged by AI against the CV's evidence; the keywords folded, what a CV cannot show named once at the end. */
function AiMatch({ match }: Readonly<{ match: MasiMatch }>) {
  const judged = match.requirements ?? [];
  const scored = judged.filter((r) => r.verdict !== 'NOT_A_CV_THING');
  const of = (category: MasiMatchRequirement['category']) =>
    scored.filter((r) => r.category === category);
  return (
    <>
      <Requirements label="What the posting requires" items={of('MUST')} />
      <Requirements label="What it would like" items={of('NICE')} />
      <Keywords items={of('KEYWORD')} />
      <Traits items={judged.filter((r) => r.verdict === 'NOT_A_CV_THING')} />
    </>
  );
}

/** How far the active CV master covers what the posting asks for, and the must-haves on either side: a ranking aid, not a verdict. */
export default function MatchSummary({ match }: Readonly<{ match: MasiMatch | null }>) {
  if (!match) return null;
  const ai = match.method === 'AI';
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
            of 100 —{' '}
            {ai
              ? 'what the posting asks for, judged by AI against the evidence in your CV'
              : 'how much of what the posting asks for your CV shows in words'}
          </span>
        </p>
      )}
      {ai ? (
        <AiMatch match={match} />
      ) : (
        <>
          <Phrases label="Your CV shows" phrases={match.supportedMustHave} />
          <Phrases label="Your CV does not show" phrases={match.missingMustHave} />
          <Phrases label="Not compared" phrases={match.notScored} />
        </>
      )}
    </section>
  );
}
