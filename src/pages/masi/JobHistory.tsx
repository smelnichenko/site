import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MasiJobHistoryEntry } from '../../services/api';
import { formatDate } from './format';

/** How many of the latest entries a long timeline shows before "Show all". */
const FOLDED = 8;

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

/**
 * The position's timeline, oldest first: nothing when there is nothing to tell; a long one shows its latest
 * entries and folds the older ones behind "Show all", so the note and the buttons stay within reach.
 */
export default function JobHistory({ entries }: Readonly<{ entries: MasiJobHistoryEntry[] }>) {
  const [all, setAll] = useState(false);
  if (entries.length === 0) {
    return null;
  }
  const folded = !all && entries.length > FOLDED;
  const shown = folded ? entries.slice(entries.length - FOLDED) : entries;
  return (
    <div className="masi-history">
      <span id="masi-history-label" className="muted">
        History
      </span>
      {folded && (
        <button type="button" className="link-button" onClick={() => setAll(true)}>
          Show all {entries.length}
        </button>
      )}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- WebKit drops the list role from a list-style:none list */}
      <ol role="list" aria-labelledby="masi-history-label">
        {shown.map((e, i) => (
          <li key={`${e.at}/${e.kind}/${e.sourceKey ?? ''}/${e.jobId ?? ''}/${i}`}>
            {formatDate(e.at)} · {words(e)}
          </li>
        ))}
      </ol>
    </div>
  );
}
