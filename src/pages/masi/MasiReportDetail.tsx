import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMasiReport, mailMasiReportDigest, MasiReport } from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import MasiNav from '../../components/MasiNav';
import StatsPanel from './StatsPanel';
import { badgeClass, errorMessage, formatDateTime, periodLabel } from './format';

/** One stored report: the period's stats as frozen, plus the registry and the caller's queue as of generation. */
export default function MasiReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState<MasiReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailing, setMailing] = useState(false);
  const [mailed, setMailed] = useState<{ ok: boolean; text: string } | null>(null);

  async function onMailMe() {
    setMailing(true);
    setMailed(null);
    try {
      await mailMasiReportDigest(Number(id));
      setMailed({ ok: true, text: 'The digest is on its way to you.' });
    } catch (e: unknown) {
      setMailed({ ok: false, text: errorMessage(e, 'The digest could not be mailed') });
    } finally {
      setMailing(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setReport(await fetchMasiReport(Number(id), controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the report'));
      }
    })();
    return () => controller.abort();
  }, [id]);

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
  if (!report) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading report...</div>
      </div>
    );
  }
  const queue = Object.entries(report.snapshot.packagesNow)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k.toLowerCase()}`)
    .join(', ');
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {report.kind.toLowerCase()} report {periodLabel(report.periodStart, report.periodEnd)}
          </span>
          <Link to="/masi/reports" className="muted">
            all reports
          </Link>
        </div>
        <div className="muted" data-testid="snapshot-line">
          As of {formatDateTime(report.snapshot.asOf)}: {report.snapshot.openJobs} open jobs,{' '}
          {report.snapshot.companiesHiring} companies hiring
          {queue && ` · my queue: ${queue}`}
        </div>
        {report.kind === 'WEEKLY' && (
          <div className="badge-group masi-mail-me">
            <LoadingButton
              className="status-badge action"
              onClick={() => void onMailMe()}
              loading={mailing}
              label="Mail me this report"
            />
            {mailed?.ok && <output className="muted">{mailed.text}</output>}
            {mailed && !mailed.ok && (
              <span className="error" role="alert">
                {mailed.text}
              </span>
            )}
          </div>
        )}
        <div className="badge-group" data-testid="source-health">
          {Object.entries(report.snapshot.sourceHealth).map(([key, health]) => (
            <span key={key} className={badgeClass(health)}>
              {key}: {health.toLowerCase().replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
      <StatsPanel stats={report.stats} />
    </div>
  );
}
