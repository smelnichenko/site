import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchCvMaster,
  fetchMasiJob,
  fetchMasiPackages,
  fetchMasiJobBookings,
  fetchMasiJobHistory,
  fetchMasiSimilarJobs,
  MasiJob,
  MasiCalendarEvent,
  MasiJobHistoryEntry,
  MasiPackage,
  MasiSimilarJob,
  requestMasiPackage,
  saveMasiJobNote,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import MatchSummary from './MatchSummary';
import LoadingButton from '../../components/LoadingButton';
import PackagePanel from './PackagePanel';
import { errorMessage, formatDateTime } from './format';
import SourceMarks from './SourceMarks';
import JobHistory from './JobHistory';
import JobBookings from './JobBookings';

/** 18 × 10 s, then 57 × 60 s: an hour of polling at most. */
const MAX_POLLS = 75;

/** The word beside the title: open, closed with its time, or merged. */
function jobState(job: MasiJob): string {
  if (job.status === 'MERGED') {
    return 'merged';
  }
  return job.status === 'CLOSED' ? `closed ${formatDateTime(job.closedAt)}` : 'open';
}

/** One job: its listings per source, the description, the operator's note, and the package panel. */
export default function MasiJobDetail() {
  const { id } = useParams();
  const jobId = Number(id);
  const [job, setJob] = useState<MasiJob | null>(null);
  const [packages, setPackages] = useState<MasiPackage[]>([]);
  const [activeCv, setActiveCv] = useState<number | null>(null);
  const [similar, setSimilar] = useState<MasiSimilarJob[]>([]);
  const [history, setHistory] = useState<MasiJobHistoryEntry[]>([]);
  const [bookings, setBookings] = useState<{
    events: MasiCalendarEvent[] | null;
    error: string | null;
  }>({
    events: null,
    error: null,
  });
  const [polls, setPolls] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      // the hint is loaded WITH the job: it sits above the note and the buttons, and arriving late it pushed them
      // two to ten lines down under the finger. It is a hint — when it cannot be loaded the page is none the worse
      const [j, ps, cv, alike, past, booked] = await Promise.all([
        fetchMasiJob(jobId, signal),
        fetchMasiPackages({ job: jobId }, signal),
        fetchCvMaster(signal),
        fetchMasiSimilarJobs(jobId, signal).catch(() => [] as MasiSimilarJob[]),
        fetchMasiJobHistory(jobId, signal).catch(() => [] as MasiJobHistoryEntry[]),
        // the bookings too, and for the same reason; a failure is said in their card, the page is none the worse
        fetchMasiJobBookings(jobId, signal).then(
          (events) => ({ events, error: null }),
          (e: unknown) => ({ events: null, error: errorMessage(e, 'Failed to load the bookings') }),
        ),
      ]);
      setSimilar(alike);
      setHistory(past);
      setBookings(booked);
      setJob(j);
      setNote(j.userNote ?? '');
      setPackages(ps);
      setActiveCv(cv.active?.version ?? null);
    },
    [jobId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the job'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  // a package being prepared: poll while it settles — every 10 s for the first 3 min, then every minute, and give up
  // after an hour (a spent budget parks a package NEW until the next UTC day); a failure is shown, never swallowed
  const preparing = packages.some((p) => p.status === 'NEW' || p.status === 'PREPARING');
  const refreshPackages = useCallback(async () => {
    try {
      setPackages(await fetchMasiPackages({ job: jobId }));
      setPolls((n) => n + 1);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Refreshing the package failed'));
      setPolls(MAX_POLLS);
    }
  }, [jobId]);
  useEffect(() => {
    if (!preparing || polls >= MAX_POLLS) return;
    const t = setTimeout(() => void refreshPackages(), polls < 18 ? 10_000 : 60_000);
    return () => clearTimeout(t);
  }, [preparing, polls, refreshPackages]);

  function replacePackage(next: MasiPackage) {
    setPackages((cur) => cur.map((x) => (x.id === next.id ? next : x)));
  }

  async function onPrepare() {
    setBusy(true);
    setMessage(null);
    try {
      const p = await requestMasiPackage(jobId);
      setPackages((cur) => [p, ...cur.filter((x) => x.id !== p.id)]);
      setPolls(0);
      setMessage('Package queued; it prepares in the background');
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Prepare failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNote() {
    setBusy(true);
    setMessage(null);
    try {
      setJob(await saveMasiJobNote(jobId, note));
      setMessage('Note saved');
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving the note failed'));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="error" role="alert">
          {error}
        </div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading job...</div>
      </div>
    );
  }
  /** The job a merged one became: its bookings, notes and log rows live there. */
  const becameId = job.status === 'MERGED' ? job.mergedIntoId : null;
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">{job.title}</span>
          <span className="muted">{jobState(job)}</span>
        </div>
        <div className="muted">
          {job.companyId ? (
            <Link to={`/masi/companies/${job.companyId}`}>{job.companyName}</Link>
          ) : (
            job.companyName
          )}
          {job.location ? ` · ${job.location}` : ''}
          {job.remote && job.remote !== 'UNKNOWN'
            ? ` · ${job.remote.toLowerCase().replace('_', '-')}`
            : ''}
          {job.salaryMin || job.salaryMax
            ? ` · ${job.salaryMin ?? '?'}–${job.salaryMax ?? '?'} EUR`
            : ''}
          {` · first seen ${formatDateTime(job.firstSeenAt)}`}
        </div>
        {job.status === 'MERGED' && (
          <div className="muted masi-hint" role="note" aria-label="merged">
            Merged: the same posting under another spelling of the title or the employer. Its
            listings live on{' '}
            {job.mergedIntoId ? (
              <Link to={`/masi/jobs/${job.mergedIntoId}`}>job {job.mergedIntoId}</Link>
            ) : (
              'the job it was merged into'
            )}
            ; a package or score of this one that could move is there too, the rest stays here.
          </div>
        )}
        <div className="muted masi-hint masi-listed-on">
          <span id="masi-listed-on-label">Listed on</span>
          <SourceMarks sources={job.sources} labelledBy="masi-listed-on-label" />
        </div>
        {similar.length > 0 && (
          <div className="muted masi-hint" role="note">
            Looks like another open job of this company. Nothing is merged: look, and skip the one
            you do not need.
            <ul>
              {similar.map((s) => (
                <li key={s.id}>
                  <Link to={`/masi/jobs/${s.id}`}>{s.title}</Link> —{' '}
                  {Math.round(s.similarity * 100)}% similar title
                </li>
              ))}
            </ul>
          </div>
        )}
        <MatchSummary match={job.match} />
        <ul className="masi-listings">
          {job.listings.map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.sourceKey ?? 'source'}
              </a>
              {l.postedAt ? ` · posted ${formatDateTime(l.postedAt)}` : ''}
              {l.closedAt ? ' · gone' : ''}
            </li>
          ))}
        </ul>
        <JobHistory entries={history} />
        <JobBookings
          jobId={job.id}
          events={bookings.events}
          error={bookings.error}
          mergedIntoId={becameId}
        />
        <p className="muted masi-hint">
          {/* masi files a row about a merged job under the job it became: the link says so */}
          <Link to={`/masi/activity?job=${becameId ?? job.id}`}>
            {becameId === null
              ? 'Log a call, a message or a note for this job'
              : 'Log a call, a message or a note for the job it became'}
          </Link>
        </p>
        {job.descriptionText && <pre className="masi-description">{job.descriptionText}</pre>}
        {becameId === null ? (
          <div className="form-group">
            <label htmlFor="job-note">Your note</label>
            <textarea
              id="job-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        ) : (
          // masi refuses a note on a merged job; one written before the merge stays readable here
          <section className="form-group" aria-labelledby="job-note-label">
            <span id="job-note-label" className="masi-card-label">
              Your note
            </span>
            {job.userNote && <p className="masi-kept-note">{job.userNote}</p>}
            <p className="muted">
              {job.userNote ? 'It is kept here. ' : ''}Notes on this position go on{' '}
              <Link to={`/masi/jobs/${becameId}`}>job {becameId}</Link>.
            </p>
          </section>
        )}
        {message && <div className="muted">{message}</div>}
        <div className="badge-group">
          {becameId === null && (
            <LoadingButton
              className="status-badge action"
              onClick={() => void onSaveNote()}
              loading={busy}
              label="Save note"
            />
          )}
          {job.status === 'OPEN' &&
            activeCv !== null &&
            !packages.some((p) => p.cvVersion === activeCv) && (
              <LoadingButton
                className="status-badge add"
                onClick={() => void onPrepare()}
                loading={busy}
                label="Prepare package"
              />
            )}
        </div>
      </div>
      {packages.map((p) => (
        <PackagePanel
          key={p.id}
          pkg={p}
          onChanged={replacePackage}
          jobOpen={job.status === 'OPEN'}
        />
      ))}
    </div>
  );
}
