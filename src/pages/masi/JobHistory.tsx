import { Link } from 'react-router-dom';
import { MasiJobHistoryEntry } from '../../services/api';
import { formatDate } from './format';

/** One entry's words: what happened, where, and under what title where a board's differs. */
function words(e: MasiJobHistoryEntry) {
  switch (e.kind) {
    case 'LISTED':
      return (
        <>
          listed on {e.sourceKey ?? 'a board'}
          {e.detail ? ` as “${e.detail}”` : ''}
        </>
      );
    case 'GONE':
      return <>gone from {e.sourceKey ?? 'a board'}</>;
    case 'CLOSED':
      return <>closed</>;
    case 'REPOSTED':
      return <>reposted{e.sourceKey ? ` on ${e.sourceKey}` : ''}</>;
    case 'MERGED_IN':
      return (
        <>
          merged in <Link to={`/masi/jobs/${e.jobId}`}>job {e.jobId}</Link>
          {e.detail ? ` “${e.detail}”` : ''}
        </>
      );
    default:
      return (
        <>
          merged into <Link to={`/masi/jobs/${e.jobId}`}>job {e.jobId}</Link>
        </>
      );
  }
}

/** The position's timeline, oldest first: nothing when there is nothing to tell. */
export default function JobHistory({ entries }: Readonly<{ entries: MasiJobHistoryEntry[] }>) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="masi-history">
      <span id="masi-history-label" className="masi-history-label">
        History
      </span>
      <ol aria-labelledby="masi-history-label">
        {entries.map((e) => (
          <li key={`${e.at}/${e.kind}/${e.sourceKey ?? ''}/${e.jobId ?? ''}`}>
            {formatDate(e.at)} · {words(e)}
          </li>
        ))}
      </ol>
    </div>
  );
}
