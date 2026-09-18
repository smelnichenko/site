import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchMasiPackages,
  fetchMasiRetuneEstimate,
  MasiPackage,
  retuneMasi,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDateTime, formatUsd, PACKAGE_STATES } from './format';

/** The review queue: every package of the caller by state, and the explicit backlog re-tune with its estimate first. */
export default function MasiPackages() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'PREPARED';
  const [list, setList] = useState<MasiPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ count: number; estimatedUsd: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiPackages({ status: status === 'ALL' ? undefined : status }, controller.signal)
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load packages'));
      });
    return () => controller.abort();
  }, [status]);

  async function onEstimate() {
    setBusy(true);
    setMessage(null);
    try {
      setEstimate(await fetchMasiRetuneEstimate());
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The estimate failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onRetune() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await retuneMasi();
      setMessage(
        `${r.count} package(s) queued (reservation estimate ${formatUsd(r.estimatedUsd)})`,
      );
      setEstimate(null);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The re-tune failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Review queue</span>
          <select
            aria-label="State"
            value={status}
            onChange={(e) => setParams({ status: e.target.value })}
          >
            {PACKAGE_STATES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
            <option value="ALL">all</option>
          </select>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!list && !error && <div className="loading">Loading packages...</div>}
        {list && list.length === 0 && <div className="empty-state">Nothing in this state.</div>}
        {list && list.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Company</th>
                <th>State</th>
                <th>Cost</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/masi/jobs/${p.jobId}`}>{p.jobTitle ?? `job ${p.jobId}`}</Link>
                  </td>
                  <td>{p.companyName ?? ''}</td>
                  <td>
                    <span className={badgeClass(p.status)}>
                      {p.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatUsd(p.costUsd)}</td>
                  <td>{formatDateTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Re-tune the backlog</span>
        </div>
        <p className="muted">
          Activating a new CV version never tunes older open jobs by itself. This queues a package
          for every open job without one, at the shown reservation estimate (the settled cost is
          usually a third of it).
        </p>
        {estimate && (
          <div className="muted" data-testid="retune-estimate">
            {estimate.count} job(s) · about {formatUsd(estimate.estimatedUsd)}
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        <div className="badge-group">
          <LoadingButton
            className="status-badge action"
            onClick={() => void onEstimate()}
            loading={busy}
            label="Estimate"
          />
          {estimate && estimate.count > 0 && (
            <LoadingButton
              className="status-badge add"
              onClick={() => void onRetune()}
              loading={busy}
              label={`Re-tune ${estimate.count} jobs (~${formatUsd(estimate.estimatedUsd)})`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
