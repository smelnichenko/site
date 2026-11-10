import { useEffect, useState } from 'react';
import MasiTable from '../../components/MasiTable';
import { SortableHeader } from '../../components/SortableHeader';
import { sortRows, useUrlSort, type SortValue } from '../../components/sorting';
import {
  fetchMasiContactPictureBlob,
  fetchMasiContactPictures,
  fetchMasiPictureTries,
  type MasiContactPicture,
  type MasiPersonFound,
  type MasiPictureSourceTries,
  type MasiPictureTries,
} from '../../services/api';
import { errorMessage, formatBytes, formatDateTime } from './format';
import PictureLightbox, { type ViewerPicture } from './PictureLightbox';

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

// each column's share: widths stay put as sorts and thumbnails arrive
const PICTURE_COLUMNS = ['20%', '20%', '22%', '22%', '16%'];
const PICTURE_COLUMNS_WITH_RECORD = ['16%', '14%', '22%', '18%', '18%', '12%'];
const TRIES_COLUMNS = ['18%', '11%', '8%', '26%', '12%', '25%'];
const TRIES_COLUMNS_WITH_RECORD = ['14%', '22%', '9%', '6%', '20%', '9%', '20%'];

/** The row keeps its height while a thumbnail loads, and when one does not. */
const THUMBNAIL_BOX = { width: 64, height: 64, display: 'flex', alignItems: 'center' } as const;

/** A person's kept pictures can be many, and each is a full-size download. */
const PICTURES_AT_ONCE = 4;

const RESULT: Record<string, string> = { FOUND: 'found', NONE: 'nothing', FAILED: 'failed' };

const SORTS: Record<string, (r: Row) => SortValue> = {
  createdAt: (r) => r.createdAt,
  capturedAt: (r) => r.capturedAt,
  source: (r) => sourceName(r.source),
  size: (r) => r.size,
};

/** Which picture this is, in words: several can come from one source. */
function describe(p: Readonly<MasiContactPicture>): string {
  return `from ${sourceName(p.source)}, added ${formatDateTime(p.createdAt)}`;
}

function sourceName(source: string): string {
  return SOURCE[source] ?? source;
}

/** When a source is asked next: null is never, a time gone by is now. */
/** A source with tries left is not asked once another source holds the contact's picture. */
function nextAsk({ nextAskAt: at, left }: Readonly<MasiPictureSourceTries>): string {
  if (at === null) return left > 0 ? 'not needed' : 'not again';
  return new Date(at).getTime() <= Date.now() ? 'due now' : formatDateTime(at);
}

/** Every image masi has kept of this person, newest added first, and what each source has left to try. */
export default function PictureHistory({
  personId,
  found,
}: Readonly<{ personId: number; found: readonly MasiPersonFound[] }>) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tries, setTries] = useState<MasiPictureTries | null>(null);
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());
  const [notLoaded, setNotLoaded] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [triesError, setTriesError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ pictures: ViewerPicture[]; index: number } | null>(null);
  const { sort, setSort } = useUrlSort('createdAt,desc', 'picturesSort');
  const contacts = found
    .filter((f) => f.pictures > 0)
    .map((f) => f.contactId)
    .join(',');

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiPictureTries(personId, controller.signal)
      .then(setTries)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setTriesError(errorMessage(e, 'The tries could not be loaded.'));
        }
      });
    return () => controller.abort();
  }, [personId]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const urls = new Map<number, string>();
    const ids = contacts === '' ? [] : contacts.split(',').map(Number);

    async function showNext(queue: Row[]) {
      for (let p = queue.shift(); p !== undefined && !signal.aborted; p = queue.shift()) {
        try {
          const blob = await fetchMasiContactPictureBlob(p.contactId, p.id, signal);
          if (!signal.aborted) {
            urls.set(p.id, URL.createObjectURL(blob));
            setThumbs(new Map(urls));
          }
        } catch {
          // one image that does not load says so in its own cell, and is not a failed page
          const id = p.id;
          if (!signal.aborted) setNotLoaded((before) => new Set(before).add(id));
        }
      }
    }

    async function load() {
      const lists = await Promise.allSettled(
        ids.map((contactId) => fetchMasiContactPictures(contactId, signal)),
      );
      if (signal.aborted) return;
      const all = lists.flatMap((list, i) =>
        list.status === 'fulfilled' ? list.value.map((p) => ({ ...p, contactId: ids[i] })) : [],
      );
      setRows(all);
      const refused = lists.find((list) => list.status === 'rejected');
      setError(refused ? errorMessage(refused.reason, 'The pictures could not be loaded.') : null);
      const queue = [...all];
      await Promise.all(Array.from({ length: PICTURES_AT_ONCE }, () => showNext(queue)));
    }

    void load();
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [contacts]);

  const sources = (tries?.contacts ?? []).flatMap((c) =>
    c.sources.map((s) => ({ ...s, contactId: c.contactId })),
  );
  const severalTried = new Set(sources.map((s) => s.contactId)).size > 1;
  const severalPictured = new Set((rows ?? []).map((p) => p.contactId)).size > 1;
  const recordName = (contactId: number) => {
    const record = found.find((f) => f.contactId === contactId);
    if (!record) return String(contactId);
    return record.companyName ? `${record.sourceName}, ${record.companyName}` : record.sourceName;
  };
  const shown = sortRows(rows ?? [], sort, SORTS);
  const open = (id: number) => {
    const pictures = shown.flatMap((p) => {
      const url = thumbs.get(p.id);
      return url ? [{ id: p.id, url, alt: describe(p) }] : [];
    });
    setViewer({ pictures, index: pictures.findIndex((p) => p.id === id) });
  };
  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pictures</span>
          {(rows?.length ?? 0) > 0 && <span className="muted">{rows?.length}</span>}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {rows === null && <div className="loading">Loading pictures...</div>}
        {!error && rows?.length === 0 && <div className="empty-state">No picture kept.</div>}
        {shown.length > 0 && (
          <MasiTable
            label="Pictures of the person"
            testId="person-pictures"
            columns={severalPictured ? PICTURE_COLUMNS_WITH_RECORD : PICTURE_COLUMNS}
            minWidth={severalPictured ? 640 : 500}
          >
            <thead>
              <tr>
                <th>Picture</th>
                <SortableHeader column="source" label="Source" sort={sort} onSort={setSort} />
                {severalPictured && <th>Record</th>}
                <SortableHeader column="createdAt" label="Added" sort={sort} onSort={setSort} />
                <SortableHeader
                  column="capturedAt"
                  label="Last seen"
                  sort={sort}
                  onSort={setSort}
                />
                <SortableHeader
                  column="size"
                  label="Size"
                  sort={sort}
                  onSort={setSort}
                  className="masi-num"
                />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={THUMBNAIL_BOX}>
                      {thumbs.has(p.id) && (
                        <button
                          type="button"
                          className="picture-thumb"
                          aria-label={`Open the picture ${describe(p)}`}
                          onClick={() => open(p.id)}
                        >
                          <img
                            className="masi-contact-picture"
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: 'cover',
                              borderRadius: 8,
                              cursor: 'zoom-in',
                              display: 'block',
                            }}
                            src={thumbs.get(p.id)}
                            alt=""
                          />
                        </button>
                      )}
                      {notLoaded.has(p.id) && <span className="muted">not loaded</span>}
                    </div>
                  </td>
                  <td>{sourceName(p.source)}</td>
                  {severalPictured && <td>{recordName(p.contactId)}</td>}
                  <td>{formatDateTime(p.createdAt)}</td>
                  <td>{formatDateTime(p.capturedAt)}</td>
                  <td className="masi-nowrap masi-num">{formatBytes(p.size)}</td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
      {triesError && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Picture tries</span>
          </div>
          <div className="error" role="alert">
            {triesError}
          </div>
        </div>
      )}
      {sources.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Picture tries</span>
            <span className="muted">{tries?.triesLeft} left</span>
          </div>
          <MasiTable
            label="What each source has left"
            testId="person-picture-tries"
            columns={severalTried ? TRIES_COLUMNS_WITH_RECORD : TRIES_COLUMNS}
            minWidth={severalTried ? 920 : 720}
          >
            <thead>
              <tr>
                <th>Source</th>
                {severalTried && <th>Record</th>}
                <th>Tries</th>
                <th className="masi-num">Left</th>
                <th>Last asked</th>
                <th>Result</th>
                <th>Next ask</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={`${s.contactId}-${s.source}`}>
                  <td>{sourceName(s.source)}</td>
                  {severalTried && <td>{recordName(s.contactId)}</td>}
                  <td className="masi-nowrap">
                    {s.tries} of {s.max}
                  </td>
                  <td className="masi-num">{s.left}</td>
                  <td className="masi-nowrap">
                    {s.lastTriedAt ? formatDateTime(s.lastTriedAt) : 'never'}
                  </td>
                  <td>{s.lastOutcome ? (RESULT[s.lastOutcome] ?? s.lastOutcome) : '—'}</td>
                  <td className="masi-nowrap">{nextAsk(s)}</td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        </div>
      )}
      {viewer && (
        <PictureLightbox
          pictures={viewer.pictures}
          index={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
