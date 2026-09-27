import { useEffect, useId, useRef, useState } from 'react';
import {
  fetchMasiCompanyVisits,
  MasiCompany,
  MasiCompanyVisit,
  MasiCompanyVisits,
  MasiSiteFoundBy,
  MasiVisitOutcome,
  patchMasiCompany,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage, formatDate } from './format';

/** What a visit came to, as the operator reads it. */
const CAME_TO: Record<MasiVisitOutcome, string> = {
  PROVED: 'its site: it prints the registry code',
  MATCHED: 'its site: its people write from it, and it is its name',
  KNOWN_SITE: 'the website it had; its careers page was looked for',
  CODE_HELD: 'the site names a company masi holds',
  INDEX_NOT_READY: 'the site prints a code, and the register is not read yet',
  REGISTER_BUSY: 'the register was busy: visited again soon',
  UNCONFIRMED: 'not sure it is its site',
  NO_CANDIDATE: 'nothing to visit',
  ROBOTS_DENIED: "the sites' robots.txt forbid reading them",
  FETCH_FAILED: 'no site could be read',
  VISIT_FAILED: 'the visit did not finish',
};

/** How the visit came to the site it judged. */
const FOUND_BY: Record<MasiSiteFoundBy, string> = {
  OWN: 'the website it had',
  REGISTER: "the register's address for it",
  CONTACT: 'the domain its people write from',
  POSTING: 'an address in its postings',
  GUESS: 'a guess from its name',
};

/** The host a URL names, without a leading www.: what the operator recognises a site by. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Whether two hosts are one site: the same, or one under the other (jobs.firma.ee is firma.ee's). */
function sameSite(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/** What a message about the company is about: the company as it was — its id, website and code. */
function stampOf(c: MasiCompany): string {
  return `${c.id}|${c.website ?? ''}|${c.registryCode ?? ''}`;
}

/**
 * Which visit the card shows: the last judgement (what the operator acts on), else a newer attempt — but not the start
 * marker of a visit under way, which is the visit running, not one that failed. A busy register's code is not offered
 * from a newer attempt: masi places it itself on the visit that follows.
 */
function read(visits: MasiCompanyVisits | null | undefined) {
  const underWay = !!visits?.visiting && visits.attempt?.outcome === 'VISIT_FAILED';
  const latest = visits?.latest ?? null;
  const shown = latest ?? (underWay ? null : (visits?.attempt ?? null));
  const newer = latest && !underWay ? (visits?.attempt ?? null) : null;
  return { underWay, shown, newer };
}

/** The header's word: a visit under way, and when the judgement shown is from. */
function when(
  visits: MasiCompanyVisits | null | undefined,
  shown: MasiCompanyVisit | null,
): string | null {
  const last = shown ? `visited ${formatDate(shown.runAt)}` : null;
  if (!visits?.visiting) return last;
  return visits.latest && last ? `visiting now · ${last}` : 'visiting now';
}

interface Props {
  company: MasiCompany;
  /** The website was accepted: the company changed, and the page reads again what it shows. */
  onChange: (c: MasiCompany) => void;
  /** A registry code the site names, for the register card to look up and offer. */
  onLookUp: (code: string) => void;
}

/** The answer for one company: its visits (null: never visited), or why they could not be loaded. */
interface Loaded {
  id: number;
  visits?: MasiCompanyVisits | null;
  message?: string;
}

/**
 * masi's visits to the company's own site: what the latest visit that judged a site came to and why, where a guess
 * ended up, the careers page and ATS it found. A site masi is not sure of is offered to the operator (Accept); a code
 * the site names that masi did not place the company on is handed to the register card. No card before the first visit.
 */
export default function VisitCard({ company, onChange, onLookUp }: Readonly<Props>) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  // what the operator's Accept came to, for the company as it was then: a refusal the placement it asked for resolved,
  // or one about the company the page moved on from, is not shown
  const [said, setSaid] = useState<{ stamp: string; text: string; refused: boolean } | null>(null);
  const saidRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { id, website, registryCode } = company;

  useEffect(() => {
    // read again when the website or the code changes (an Accept, a placement): the card says what is now
    const controller = new AbortController();
    void (async () => {
      try {
        setLoaded({ id, visits: await fetchMasiCompanyVisits(id, controller.signal) });
      } catch (e: unknown) {
        if (!controller.signal.aborted) {
          setLoaded({ id, message: errorMessage(e, 'Failed to load the visits') });
        }
      }
    })();
    return () => controller.abort();
  }, [id, website, registryCode]);

  // the answer shows while the company is as it was when it was given
  const answer = said?.stamp === stampOf(company) ? said : null;
  useEffect(() => {
    // the answer to Accept is where the operator looks next: the button it replaces is gone
    if (answer) saidRef.current?.focus();
  }, [answer]);

  // a company the page moved on from shows nothing of its own while the next one loads; the same company keeps its
  // visits on screen while they are read again
  const current = loaded?.id === company.id ? loaded : null;
  if (!current) return null;
  const { visits, message } = current;
  if (!message && !visits) return null;

  async function accept(url: string, host: string) {
    setBusy(true);
    setSaid(null);
    try {
      const accepted = await patchMasiCompany(company.id, { website: url });
      setSaid({ stamp: stampOf(accepted), text: `${host} is its website now.`, refused: false });
      onChange(accepted);
    } catch (e: unknown) {
      setSaid({
        stamp: stampOf(company),
        text: errorMessage(e, `Accepting ${host} failed`),
        refused: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const { underWay, shown, newer } = read(visits);
  return (
    <section className="card masi-visit-card" aria-labelledby={titleId}>
      <div className="card-header">
        <span className="card-title" id={titleId}>
          Own site
        </span>
        <span className="card-header-aside muted">{when(visits, shown)}</span>
      </div>
      {message && (
        <div className="error" role="alert">
          {message}
        </div>
      )}
      {!shown && underWay && (
        <div className="muted">masi is visiting its site for the first time.</div>
      )}
      {shown && (
        <Visit
          visit={shown}
          company={company}
          busy={busy}
          onAccept={(url, host) => void accept(url, host)}
          onLookUp={onLookUp}
        />
      )}
      {newer && (
        <div className="muted">
          Tried again {formatDate(newer.runAt)}: {CAME_TO[newer.outcome] ?? newer.outcome}
        </div>
      )}
      {answer && (
        <div
          ref={saidRef}
          tabIndex={-1}
          className={answer.refused ? 'error' : 'masi-visit-done'}
          role={answer.refused ? 'alert' : 'status'}
        >
          {answer.text}
        </div>
      )}
    </section>
  );
}

interface VisitProps {
  visit: MasiCompanyVisit;
  company: MasiCompany;
  busy: boolean;
  onAccept: (url: string, host: string) => void;
  onLookUp: (code: string) => void;
}

/** One visit: what it came to, the site and how it was found, the evidence, what it took, and what the operator may do. */
function Visit({ visit, company, busy, onAccept, onLookUp }: Readonly<VisitProps>) {
  const host = hostOf(visit.candidateUrl);
  const tried = hostOf(visit.triedUrl);
  const found = visit.foundBy ? FOUND_BY[visit.foundBy] : null;
  const has = hostOf(company.website);
  // a site masi is not sure of is the operator's to accept; the one the company has already is not offered again
  const offered =
    visit.outcome === 'UNCONFIRMED' && visit.candidateUrl && host && !(has && sameSite(host, has))
      ? visit.candidateUrl
      : null;
  const code = company.registryCode === null ? (visit.namedCode ?? null) : null;
  return (
    <div className="masi-visit">
      <div>{CAME_TO[visit.outcome] ?? visit.outcome}</div>
      {host && visit.candidateUrl && (
        <div className="masi-visit-site">
          <a href={visit.candidateUrl} target="_blank" rel="noopener noreferrer">
            {host}
          </a>
          {found && !tried && <span className="muted">{found}</span>}
        </div>
      )}
      {tried && (
        <div className="muted">
          Tried {tried}
          {found ? `, ${found}` : ''}:{' '}
          {host ? `it answered from ${host}.` : "no company's own site answered."}
        </div>
      )}
      {visit.evidence && <div className="muted">{visit.evidence}</div>}
      {(visit.adoptedCode || visit.careersUrl || visit.atsVendor) && (
        <div className="masi-visit-site">
          {visit.adoptedCode && <span>placed on reg. {visit.adoptedCode}</span>}
          {visit.careersUrl && (
            <a href={visit.careersUrl} target="_blank" rel="noopener noreferrer">
              careers page
            </a>
          )}
          {visit.atsVendor && <span>ATS {visit.atsVendor}</span>}
        </div>
      )}
      {visit.cut && <div className="muted">cut short by a restart: visited again soon</div>}
      {(offered || code) && (
        <div className="badge-group">
          {offered && host && (
            <LoadingButton
              type="button"
              className="status-badge action"
              onClick={() => onAccept(offered, host)}
              loading={busy}
              // accepting replaces the website the company has: the button says which
              label={has ? `Accept ${host} instead of ${has}` : `Accept ${host} as its website`}
            />
          )}
          {code && (
            <button type="button" className="status-badge action" onClick={() => onLookUp(code)}>
              Look up reg. {code} in the register
            </button>
          )}
        </div>
      )}
    </div>
  );
}
