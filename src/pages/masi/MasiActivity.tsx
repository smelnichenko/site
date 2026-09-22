import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchMasiActivity,
  logMasiActivity,
  MASI_ACTIVITY_KINDS,
  MasiActivity as Row,
  Paged,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage, formatDateTime, pageParam } from './format';

const PAGE_SIZE = 50;
const TALLINN = 'Europe/Tallinn';

/** The words for a kind, as a line of the log reads. */
const WORDS: Record<Row['kind'], string> = {
  COLLECTED: 'collected',
  ANALYSED: 'analysed',
  PREPARED: 'package prepared',
  APPLIED: 'applied',
  SENT_MESSAGE: 'message sent',
  RECEIVED_MESSAGE: 'message received',
  CALL: 'call',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  REJECTED: 'rejected',
  NOTE: 'note',
  SCHEDULED: 'scheduled',
};

/** The instant a Tallinn calendar day starts, as ISO: the day's log is the half-open range to the next one. */
function startOfTallinnDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  // the offset on that day, read off the day's noon (never on the DST edge): what hour Tallinn shows at 12:00 UTC
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TALLINN, hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(noon)
      .find((p) => p.type === 'hour')?.value ?? '12',
  );
  return new Date(Date.UTC(y, m - 1, d, 0 - (hour - 12))).toISOString();
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function countWords(n: number): string {
  return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

/** What the log is narrowed to, for the chip that clears it. */
function scopeWords(job: string, company: string, contact: string): string {
  if (job) return `job ${job}`;
  if (company) return `company ${company}`;
  return `contact ${contact}`;
}

/** The search's log: masi's own rows and the operator's, newest first; a form to log a call, a message, a note. */
export default function MasiActivity() {
  const [params, setParams] = useSearchParams();
  const day = params.get('day') ?? '';
  const kind = params.get('kind') ?? '';
  const job = params.get('job') ?? '';
  const company = params.get('company') ?? '';
  const contact = params.get('contact') ?? '';
  const pageNo = pageParam(params.get('page'));
  const [page, setPage] = useState<Paged<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ kind: 'CALL', summary: '', detail: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const filter = {
        from: day ? startOfTallinnDay(day) : undefined,
        to: day ? startOfTallinnDay(nextDay(day)) : undefined,
        kind: kind || undefined,
        job: job ? Number(job) : undefined,
        company: company ? Number(company) : undefined,
        contact: contact ? Number(contact) : undefined,
        page: pageNo,
        size: PAGE_SIZE,
      };
      setPage(await fetchMasiActivity(filter, signal));
    },
    [day, kind, job, company, contact, pageNo],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the log'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  function set(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('page');
    setParams(next);
  }

  const canLog = Boolean(job || company || contact);

  async function onLog() {
    setBusy(true);
    setMessage(null);
    try {
      const row = await logMasiActivity({
        kind: draft.kind,
        jobId: job ? Number(job) : undefined,
        companyId: company ? Number(company) : undefined,
        contactId: contact ? Number(contact) : undefined,
        summary: draft.summary.trim(),
        detail: draft.detail.trim() || undefined,
      });
      setDraft({ kind: draft.kind, summary: '', detail: '' });
      setPage((cur) =>
        cur
          ? { ...cur, content: [row, ...cur.content], totalElements: cur.totalElements + 1 }
          : { content: [row], page: 0, size: PAGE_SIZE, totalElements: 1 },
      );
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Logging failed'));
    } finally {
      setBusy(false);
    }
  }

  const totalPages = page ? Math.max(1, Math.ceil(page.totalElements / PAGE_SIZE)) : 1;

  return (
    <div>
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity</span>
          <span className="muted">{page ? countWords(page.totalElements) : ''}</span>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-row masi-filters">
          <div className="form-group">
            <label htmlFor="act-day">Day</label>
            <input
              id="act-day"
              type="date"
              value={day}
              onChange={(e) => set('day', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="act-kind">Kind</label>
            <select id="act-kind" value={kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="">all</option>
              {(Object.keys(WORDS) as Row['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {WORDS[k]}
                </option>
              ))}
            </select>
          </div>
          {(job || company || contact) && (
            <button type="button" className="status-badge" onClick={() => setParams({})}>
              {scopeWords(job, company, contact)} ×
            </button>
          )}
        </div>
        {canLog && (
          <div className="form-row masi-log-form">
            <div className="form-group">
              <label htmlFor="act-what">What</label>
              <select
                id="act-what"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                {MASI_ACTIVITY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {WORDS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group masi-grow">
              <label htmlFor="act-summary">Summary</label>
              <input
                id="act-summary"
                value={draft.summary}
                maxLength={300}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div className="form-group masi-grow">
              <label htmlFor="act-detail">Detail</label>
              <input
                id="act-detail"
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </div>
            <LoadingButton
              className="status-badge action"
              onClick={() => void onLog()}
              loading={busy}
              disabled={!draft.summary.trim()}
              label="Log"
            />
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        {page?.content.length === 0 && <p className="muted">Nothing logged.</p>}
        {page && page.content.length > 0 && (
          <ol className="masi-activity" aria-label="Activity">
            {page.content.map((a) => (
              <li key={a.id} className={a.origin === 'SYSTEM' ? 'masi-activity-system' : ''}>
                <span className="masi-activity-when">{formatDateTime(a.at)}</span>
                <span className="masi-activity-kind">{WORDS[a.kind]}</span>
                <span className="masi-activity-text">
                  {a.kind !== 'COLLECTED' && a.kind !== 'APPLIED' && a.kind !== 'PREPARED' && (
                    <>
                      <span className="masi-activity-summary">{a.summary}</span>
                      {' · '}
                    </>
                  )}
                  {a.jobId && (
                    <Link to={`/masi/jobs/${a.jobId}`}>{a.jobTitle ?? `job ${a.jobId}`}</Link>
                  )}
                  {a.companyId && (
                    <>
                      {a.jobId ? ' at ' : ''}
                      <Link to={`/masi/companies/${a.companyId}`}>
                        {a.companyName ?? `company ${a.companyId}`}
                      </Link>
                    </>
                  )}
                  {a.contactId && (
                    <>
                      {' with '}
                      <Link to="/masi/contacts">{a.contactName ?? `contact ${a.contactId}`}</Link>
                    </>
                  )}
                  {a.packageId && (
                    <>
                      {' · '}
                      <Link to={`/masi/packages/${a.packageId}`}>package</Link>
                    </>
                  )}
                  {a.detail && <span className="muted"> — {a.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {page && totalPages > 1 && (
          <div className="badge-group masi-pager">
            <button
              type="button"
              className="status-badge"
              disabled={pageNo === 0}
              onClick={() => set('page', String(pageNo - 1))}
            >
              Previous
            </button>
            <span className="muted">
              page {pageNo + 1} of {totalPages}
            </span>
            <button
              type="button"
              className="status-badge"
              disabled={pageNo + 1 >= totalPages}
              onClick={() => set('page', String(pageNo + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
