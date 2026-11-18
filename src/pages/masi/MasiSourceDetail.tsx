import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import MasiNav from '../../components/MasiNav';
import { fetchMasiSourceList } from '../../services/api';
import { errorMessage } from './format';
import MasiSources from './MasiSources';

/** The page for a source there is none of: said so, with the way back to every source. */
function NoSource({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="masi">
      <MasiNav />
      <div className="card masi-sources-card">
        <div className="card-header">
          <span className="card-title">No such source</span>
          <Link to="/masi/sources" className="muted masi-back-link">
            all sources
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A source's id as a route carries it: a whole number from 1, in plain digits. */
const SOURCE_ID = /^[1-9]\d*$/;

/**
 * One source alone (/masi/sources/:id), opened as the Sources page opens a row - its config, its changes and its last
 * runs - with its actions, and the way back to every source. Where the dashboard, a report and the weekly digest lead.
 * Keyed by the id: another source is a fresh page, never the last one's state. An id is plain digits, as masi writes
 * them (12, never 012, 1e3 or 12.0 - which Number would read as one); anything else is no source: said so, with
 * nothing asked of masi.
 */
export default function MasiSourceDetail() {
  const { id = '' } = useParams();
  if (!SOURCE_ID.test(id)) {
    return (
      <NoSource>
        <div className="empty-state">&quot;{id}&quot; is no source&apos;s id.</div>
      </NoSource>
    );
  }
  return <MasiSources key={id} sourceId={Number(id)} />;
}

/** The most rows a search holds (masi's page at its largest): a key is in far fewer names and keys than that. */
const KEY_SEARCH_SIZE = 200;

/**
 * One source by its key (/masi/sources/key/:key): a report names its sources by key alone. Masi finds the key among
 * keys and names containing it ("meetfrank" is in "meetfrankpeople" too); the one whose key is exactly it is opened at
 * its own page, in place of this one in the history.
 */
export function MasiSourceByKey() {
  const { key = '' } = useParams();
  const [found, setFound] = useState<{ key: string; id: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMasiSourceList({ q: key, page: 0, size: KEY_SEARCH_SIZE }, controller.signal).then(
      (answer) => setFound({ key, id: answer.page.content.find((s) => s.key === key)?.id ?? null }),
      (e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to find the source'));
      },
    );
    return () => controller.abort();
  }, [key]);
  if (error) {
    return (
      <NoSource>
        <div className="error" role="alert">
          {error}
        </div>
      </NoSource>
    );
  }
  if (found?.key !== key) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Finding {key}...</div>
      </div>
    );
  }
  if (found.id === null) {
    return (
      <NoSource>
        <div className="empty-state">No source has the key &quot;{key}&quot;.</div>
      </NoSource>
    );
  }
  return <Navigate to={`/masi/sources/${found.id}`} replace />;
}
