import { createContext, useContext, useId, useState } from 'react';
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

/** Who decided, when it was not the model: masi counted it from the CV itself, or the operator said so. */
const DECIDED_BY: Record<MasiMatchRequirement['decidedBy'], string | null> = {
  model: null,
  dates: 'Counted from the dates of your roles.',
  languages: 'Read from the languages on your CV.',
  you: 'Your verdict.',
};

const VERDICTS: MasiMatchVerdict[] = ['MET', 'PARTLY', 'NOT_MET', 'NOT_A_CV_THING'];

/** The operator's verdict on a requirement (null: the model's again), and why. */
export type OnJudge = (
  requirementId: string,
  verdict: MasiMatchVerdict | null,
  note: string | null,
) => Promise<void>;

/** Where the page lets the operator correct the list; none, and the list is only read. */
const JudgeContext = createContext<OnJudge | null>(null);

/** The operator's own verdict on one requirement: their verdict and note, or the model's again. */
function JudgeForm({ r, onClose }: Readonly<{ r: MasiMatchRequirement; onClose: () => void }>) {
  const onJudge = useContext(JudgeContext);
  const noteId = useId();
  const [verdict, setVerdict] = useState<MasiMatchVerdict>(r.verdict);
  const [note, setNote] = useState(r.decidedBy === 'you' ? (r.reason ?? '') : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!onJudge) return null;
  const judge = onJudge;
  const name = r.english ?? r.text;

  async function send(v: MasiMatchVerdict | null, n: string | null) {
    setBusy(true);
    setError(null);
    try {
      await judge(r.id, v, n);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'The verdict could not be saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="masi-judge">
      <select
        aria-label={`Verdict on ${name}`}
        value={verdict}
        onChange={(e) => setVerdict(e.target.value as MasiMatchVerdict)}
      >
        {VERDICTS.map((v) => (
          <option key={v} value={v}>
            {VERDICT_WORDS[v]}
          </option>
        ))}
      </select>
      <label htmlFor={noteId}>Why (optional)</label>
      <input id={noteId} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="badge-group">
        <button
          type="button"
          className="status-badge action"
          disabled={busy}
          onClick={() => void send(verdict, note.trim() === '' ? null : note.trim())}
        >
          Save verdict
        </button>
        {r.decidedBy === 'you' && (
          <button
            type="button"
            className="status-badge"
            disabled={busy}
            onClick={() => void send(null, null)}
          >
            Back to the model&apos;s
          </button>
        )}
        <button type="button" className="status-badge" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * The verdict as a word; where the page lets the operator judge, the word is the button that opens their verdict - no
 * row of its own under every requirement.
 */
function Verdict({
  r,
  open,
  onToggle,
}: Readonly<{ r: MasiMatchRequirement; open: boolean; onToggle: () => void }>) {
  const judging = useContext(JudgeContext) !== null;
  if (!judging) return <span className="masi-tag masi-verdict">{VERDICT_WORDS[r.verdict]}</span>;
  return (
    <button
      type="button"
      className="masi-tag masi-verdict masi-verdict-button"
      aria-label={`Change the verdict on ${r.english ?? r.text}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      {VERDICT_WORDS[r.verdict]}
    </button>
  );
}

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
  const [judging, setJudging] = useState(false);
  const decided = DECIDED_BY[r.decidedBy];
  // the model gives English for a requirement in another language; the same words again are no translation
  const english =
    r.english && r.english.trim().toLowerCase() !== r.text.trim().toLowerCase() ? r.english : null;
  return (
    <li className={`masi-req masi-req-${r.verdict.toLowerCase()}`}>
      <Verdict r={r} open={judging} onToggle={() => setJudging((o) => !o)} />{' '}
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
        {judging && <JudgeForm r={r} onClose={() => setJudging(false)} />}
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
  const onJudge = useContext(JudgeContext);
  // a closed list's controls are laid out under the summary, over what follows it: none until it is opened
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const shown = items.filter((r) => r.verdict !== 'NOT_MET').length;
  return (
    <details className="masi-match-keywords" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary id={id}>
        The posting’s keywords: your CV shows {shown} of {items.length}
      </summary>
      <JudgeContext.Provider value={open ? onJudge : null}>
        <RequirementList labelledBy={id} items={items} />
      </JudgeContext.Provider>
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
          <Trait key={r.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

/** One of them: its words, and where the operator may judge, the verdict that opens theirs. */
function Trait({ r }: Readonly<{ r: MasiMatchRequirement }>) {
  const [judging, setJudging] = useState(false);
  const can = useContext(JudgeContext) !== null;
  return (
    <li>
      {r.english ?? r.text}
      {can && (
        <>
          {' '}
          <Verdict r={r} open={judging} onToggle={() => setJudging((o) => !o)} />
        </>
      )}
      {judging && <JudgeForm r={r} onClose={() => setJudging(false)} />}
    </li>
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
export default function MatchSummary({
  match,
  onJudge,
}: Readonly<{ match: MasiMatch | null; onJudge?: OnJudge }>) {
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
      {ai && onJudge && (
        <p className="muted masi-hint">
          Press a verdict to give your own: the score counts it and the tuner is told.
        </p>
      )}
      {ai ? (
        <JudgeContext.Provider value={onJudge ?? null}>
          <AiMatch match={match} />
        </JudgeContext.Provider>
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
