import { useEffect, useState } from 'react';
import MasiTable from '../../components/MasiTable';
import { SortableHeader } from '../../components/SortableHeader';
import { sortRows, useUrlSort, type SortValue } from '../../components/sorting';
import {
  fetchMasiContactPictureBlob,
  fetchMasiContactPictures,
  fetchMasiPictureTries,
  type MasiContactPicture,
  type MasiPictureTries,
} from '../../services/api';
import { formatDateTime } from './format';

interface Row extends MasiContactPicture {
  contactId: number;
}

const SOURCE: Record<string, string> = {
  GRAVATAR: 'Gravatar',
  UNAVATAR: 'unavatar',
  GITHUB: 'GitHub',
  COMPANY_SITE: 'Company site',
  LINKEDIN: 'LinkedIn',
  NAME_SEARCH: 'Name search',
};

/** A date stays on one line: at a phone's width the table scrolls inside its card, and rows stay short. */
const ONE_LINE = { whiteSpace: 'nowrap' } as const;

const RESULT: Record<string, string> = { FOUND: 'found', NONE: 'nothing', FAILED: 'failed' };

const SORTS: Record<string, (r: Row) => SortValue> = {
  createdAt: (r) => r.createdAt,
  capturedAt: (r) => r.capturedAt,
  source: (r) => SOURCE[r.source] ?? r.source,
  size: (r) => r.size,
};

function sourceName(source: string): string {
  return SOURCE[source] ?? source;
}

/** A picture's size, as a person reads it. */
function kilobytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** When a source is asked next: null is never, a time gone by is now. */
function nextAsk(at: string | null): string {
  if (at === null) return 'not again';
  return new Date(at).getTime() <= Date.now() ? 'due now' : formatDateTime(at);
}

/** Every image masi has kept of this person, newest added first, and what each source has left to try. */
export function PictureHistory({
  personId,
  contactIds,
}: Readonly<{ personId: number; contactIds: readonly number[] }>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tries, setTries] = useState<MasiPictureTries | null>(null);
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());
  const [failed, setFailed] = useState(false);
  const { sort, setSort } = useUrlSort('createdAt,desc', 'picturesSort');
  const contacts = contactIds.join(',');

  useEffect(() => {
    const controller = new AbortController();
    const urls = new Map<number, string>();
    const ids = contacts === '' ? [] : contacts.split(',').map(Number);
    async function load() {
      try {
        const [perContact, left] = await Promise.all([
          Promise.all(
            ids.map(async (contactId) =>
              (await fetchMasiContactPictures(contactId, controller.signal)).map((p) => ({
                ...p,
                contactId,
              })),
            ),
          ),
          fetchMasiPictureTries(personId, controller.signal),
        ]);
        const all = perContact.flat();
        setRows(all);
        setTries(left);
        await Promise.all(
          all.map(async (p) => {
            try {
              urls.set(
                p.id,
                URL.createObjectURL(
                  await fetchMasiContactPictureBlob(p.contactId, p.id, controller.signal),
                ),
              );
            } catch {
              // one image that does not load is an empty cell, not a failed page
            }
          }),
        );
        if (!controller.signal.aborted) setThumbs(new Map(urls));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [personId, contacts]);

  const sources = (tries?.contacts ?? []).flatMap((c) =>
    c.sources.map((s) => ({ ...s, contactId: c.contactId })),
  );
  const severalRecords = (tries?.contacts.length ?? 0) > 1;
  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pictures</span>
          <span className="muted">{rows.length}</span>
        </div>
        {failed && <div className="error">The pictures could not be loaded.</div>}
        {!failed && rows.length === 0 && <div className="empty-state">No picture kept.</div>}
        {rows.length > 0 && (
          <MasiTable label="Pictures of the person" testId="person-pictures">
            <thead>
              <tr>
                <th>Picture</th>
                <SortableHeader column="source" label="Source" sort={sort} onSort={setSort} />
                <SortableHeader column="createdAt" label="Added" sort={sort} onSort={setSort} />
                <SortableHeader
                  column="capturedAt"
                  label="Last seen"
                  sort={sort}
                  onSort={setSort}
                />
                <SortableHeader column="size" label="Size" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {sortRows(rows, sort, SORTS).map((p) => (
                <tr key={p.id}>
                  <td>
                    {thumbs.has(p.id) && (
                      <img
                        className="masi-contact-picture"
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
                        src={thumbs.get(p.id)}
                        alt={`From ${sourceName(p.source)}`}
                      />
                    )}
                  </td>
                  <td>{sourceName(p.source)}</td>
                  <td style={ONE_LINE}>{formatDateTime(p.createdAt)}</td>
                  <td style={ONE_LINE}>{formatDateTime(p.capturedAt)}</td>
                  <td>{kilobytes(p.size)}</td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
      {sources.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Picture tries</span>
            <span className="muted">{tries?.triesLeft} left</span>
          </div>
          <MasiTable label="What each source has left" testId="person-picture-tries">
            <thead>
              <tr>
                <th>Source</th>
                {severalRecords && <th>Record</th>}
                <th>Tries</th>
                <th>Left</th>
                <th>Last asked</th>
                <th>Result</th>
                <th>Next ask</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={`${s.contactId}-${s.source}`}>
                  <td>{sourceName(s.source)}</td>
                  {severalRecords && <td>{s.contactId}</td>}
                  <td>
                    {s.tries} of {s.max}
                  </td>
                  <td>{s.left}</td>
                  <td style={ONE_LINE}>
                    {s.lastTriedAt ? formatDateTime(s.lastTriedAt) : 'never'}
                  </td>
                  <td>{s.lastOutcome ? (RESULT[s.lastOutcome] ?? s.lastOutcome) : '—'}</td>
                  <td style={ONE_LINE}>{nextAsk(s.nextAskAt)}</td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        </div>
      )}
    </>
  );
}
