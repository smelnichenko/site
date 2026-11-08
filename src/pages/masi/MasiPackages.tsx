import { useEffect, useState } from 'react';
import { SortableHeader } from '../../components/SortableHeader';
import { sortRows, useUrlSort, type SortValue } from '../../components/sorting';
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
import MasiTable from '../../components/MasiTable';
import FigureFilterNote from './FigureFilterNote';
import { figureParams, PACKAGE_EVENTS } from './figureLinks';

const EVENT_WORDS = { REQUESTED: 'requested', APPLIED: 'applied' } as const;

/** The review queue: every package of the caller by state, and the explicit backlog re-tune with its estimate first. */
/** What each column of the packages list sorts by (ops plan 112): what its cell shows. */
const PACKAGE_SORTS: Record<string, (p: MasiPackage) => SortValue> = {
  job: (p) => p.jobTitle,
  company: (p) => p.companyName,
  status: (p) => p.status,
  cost: (p) => p.costUsd,
  updatedAt: (p) => p.updatedAt,
};

export default function MasiPackages() {
  const { sort, setSort } = useUrlSort('updatedAt,desc');
  const [params, setParams] = useSearchParams();
  // a report's funnel figure: the packages requested or applied in its period, in whatever state they are now
  const figure = figureParams(params, PACKAGE_EVENTS);
  const status = params.get('status') ?? (figure ? 'ALL' : 'PREPARED');
  const [list, setList] = useState<MasiPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ count: number; estimatedUsd: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiPackages(
      {
        status: status === 'ALL' ? undefined : status,
        event: figure?.event,
        from: figure?.from,
        to: figure?.to,
      },
      controller.signal,
    )
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load packages'));
      });
    return () => controller.abort();
    // the figure's parts, not the object: a new one each render would refetch for ever
  }, [status, figure?.event, figure?.from, figure?.to]);

  /** Sets (or, with '', drops) parameters and keeps the rest: a state chosen keeps the report's period. */
  function setAll(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

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
            onChange={(e) => setAll({ status: e.target.value })}
          >
            {PACKAGE_STATES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
            <option value="ALL">all</option>
          </select>
        </div>
        {figure && (
          <FigureFilterNote
            period={{ words: EVENT_WORDS[figure.event], from: figure.from, to: figure.to }}
            onClear={() => setAll({ event: '', from: '', to: '' })}
          />
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!list && !error && <div className="loading">Loading packages...</div>}
        {list?.length === 0 && (
          <div className="empty-state">
            {figure ? 'No package of yours matches.' : 'Nothing in this state.'}
          </div>
        )}
        {list && list.length > 0 && (
          <MasiTable label="Packages" columns={['34%', '22%', '16%', '12%', '16%']} minWidth={760}>
            <thead>
              <tr>
                <SortableHeader column="job" label="Job" sort={sort} onSort={setSort} />
                <SortableHeader column="company" label="Company" sort={sort} onSort={setSort} />
                <SortableHeader column="status" label="State" sort={sort} onSort={setSort} />
                <SortableHeader column="cost" label="Cost" sort={sort} onSort={setSort} />
                <SortableHeader column="updatedAt" label="Updated" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {sortRows(list, sort, PACKAGE_SORTS).map((p) => (
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
          </MasiTable>
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
