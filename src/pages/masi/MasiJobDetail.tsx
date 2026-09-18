import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchMasiJob,
  fetchMasiPackages,
  MasiJob,
  MasiPackage,
  requestMasiPackage,
  saveMasiJobNote,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import PackagePanel from './PackagePanel';
import { errorMessage, formatDateTime } from './format';

/** One job: its listings per source, the description, the operator's note, and the package panel. */
export default function MasiJobDetail() {
  const { id } = useParams();
  const jobId = Number(id);
  const [job, setJob] = useState<MasiJob | null>(null);
  const [packages, setPackages] = useState<MasiPackage[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const [j, ps] = await Promise.all([
        fetchMasiJob(jobId, signal),
        fetchMasiPackages({ job: jobId }, signal),
      ]);
      setJob(j);
      setNote(j.userNote ?? '');
      setPackages(ps);
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

  // a package being prepared: poll until it settles
  const preparing = packages.some((p) => p.status === 'NEW' || p.status === 'PREPARING');
  useEffect(() => {
    if (!preparing) return;
    const t = setInterval(() => {
      fetchMasiPackages({ job: jobId })
        .then(setPackages)
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(t);
  }, [preparing, jobId]);

  async function onPrepare() {
    setBusy(true);
    setMessage(null);
    try {
      const p = await requestMasiPackage(jobId);
      setPackages((cur) => [p, ...cur.filter((x) => x.id !== p.id)]);
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
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">{job.title}</span>
          <span className="muted">
            {job.status === 'CLOSED' ? `closed ${formatDateTime(job.closedAt)}` : 'open'}
          </span>
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
        {job.descriptionText && <pre className="masi-description">{job.descriptionText}</pre>}
        <div className="form-group">
          <label htmlFor="job-note">Your note</label>
          <textarea
            id="job-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ width: '100%' }}
          />
        </div>
        {message && <div className="muted">{message}</div>}
        <div className="badge-group">
          <LoadingButton
            className="status-badge action"
            onClick={() => void onSaveNote()}
            loading={busy}
            label="Save note"
          />
          {job.status === 'OPEN' && packages.length === 0 && (
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
          onChanged={(next) => setPackages((cur) => cur.map((x) => (x.id === next.id ? next : x)))}
        />
      ))}
    </div>
  );
}
