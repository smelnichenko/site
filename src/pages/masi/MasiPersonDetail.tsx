import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchMasiActivity,
  fetchMasiContactPictureBlob,
  fetchMasiContactPictures,
  fetchMasiPerson,
  GitHubProfile,
  MasiActivity,
  MasiPerson,
  MasiPersonConnection,
  patchMasiPerson,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import MasiTable from '../../components/MasiTable';
import PictureLightbox, { ViewerPicture } from './PictureLightbox';
import PictureHistory from './PictureHistory';
import GitHubProfileCard from './GitHubProfileCard';
import { errorMessage, formatDate, formatDateTime } from './format';
import { changes, Draft, draftOf, evidenceLabel, roleLabel, whereLabel } from './people';

/** One person: who they are, every company they are tied to with what says so, and what happened with them. */
export default function MasiPersonDetail() {
  const { id } = useParams();
  const personId = Number(id);
  const [person, setPerson] = useState<MasiPerson | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    title: '',
    email: '',
    phone: '',
    note: '',
  });
  const [activity, setActivity] = useState<MasiActivity[]>([]);
  const [pictures, setPictures] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ pictures: ViewerPicture[]; index: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [p, log] = await Promise.all([
          fetchMasiPerson(personId, controller.signal),
          fetchMasiActivity({ person: personId, size: 20 }, controller.signal),
        ]);
        setPerson(p);
        setDraft(draftOf(p));
        setActivity(log.content);
        setError(null);
        setMessage(null); // a message about the person this page showed before is not about this one
        // the contacts' pictures, the first of each: a record that gave one (beside the name), and each tie's contact. The
        // bytes come as blobs - an <img> cannot send the token
        const urls = new Map<number, string>();
        const withPictures = (p.found ?? []).filter((f) => f.pictures > 0).map((f) => f.contactId);
        const ofTies = p.ties.map((t) => t.contactId).filter((id): id is number => id != null);
        for (const contactId of [...withPictures, ...ofTies]) {
          if (urls.has(contactId)) continue;
          try {
            const rows = await fetchMasiContactPictures(contactId, controller.signal);
            if (rows.length > 0) {
              const blob = await fetchMasiContactPictureBlob(
                contactId,
                rows[0].id,
                controller.signal,
              );
              urls.set(contactId, URL.createObjectURL(blob));
            }
          } catch {
            // one contact without a picture is no reason to fail the page
          }
        }
        setPictures(urls);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the person'));
      }
    })();
    return () => controller.abort();
  }, [personId]);

  /** `keepDraft`: a flag toggled while edits are typed and not saved leaves the edits as they are. */
  async function save(
    patch: Parameters<typeof patchMasiPerson>[1],
    done: string,
    keepDraft = false,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await patchMasiPerson(personId, patch);
      setPerson(next);
      if (!keepDraft) setDraft(draftOf(next));
      setMessage(done);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving failed'));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!person) return;
    const patch = changes(person, draft);
    if (Object.keys(patch).length === 0) {
      setMessage('Nothing changed');
      return;
    }
    void save(patch, 'Saved');
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
  if (!person) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading person...</div>
      </div>
    );
  }
  const field = (key: keyof Draft, label: string, type = 'text') => (
    <div className="form-group">
      <label htmlFor={`person-${key}`}>{label}</label>
      {key === 'note' ? (
        <textarea
          id={`person-${key}`}
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          rows={2}
          style={{ width: '100%' }}
        />
      ) : (
        <input
          id={`person-${key}`}
          type={type}
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          style={{ width: '100%' }}
        />
      )}
    </div>
  );
  const found = person.found ?? [];
  const connections = person.connections ?? [];
  // every picture the person's records gave, the first beside the name: the lightbox walks them all
  const faces: ViewerPicture[] = [
    ...new Set([...found.map((f) => f.contactId), ...person.ties.map((t) => t.contactId)]),
  ]
    .filter((id): id is number => id != null && pictures.has(id))
    .map((id) => ({ url: pictures.get(id) as string, alt: person.name ?? 'person' }));
  const face = faces[0]?.url;
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {face && (
              <button
                type="button"
                className="picture-thumb"
                aria-label={`Open the picture of ${person.name ?? 'this person'}`}
                onClick={() => setViewer({ pictures: faces, index: 0 })}
              >
                <img
                  src={face}
                  alt=""
                  className="masi-contact-picture"
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    cursor: 'zoom-in',
                  }}
                />
              </button>
            )}
            <span className="card-title">{person.name ?? 'Unnamed person'}</span>
          </span>
          {person.doNotContact && <span className="status-badge error">do not contact</span>}
        </div>
        <div className="muted">
          seen {formatDate(person.firstSeenAt)} – {formatDate(person.lastSeenAt)}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {field('name', 'Name')}
          {field('title', 'Title')}
          {field('email', 'Address', 'email')}
          {field('phone', 'Phone', 'tel')}
          {field('note', 'Your note')}
          {message && <div className="muted">{message}</div>}
          <div className="badge-group">
            <button type="submit" className="status-badge action" disabled={busy}>
              Save
            </button>
            <LoadingButton
              type="button"
              className={person.doNotContact ? 'status-badge success' : 'status-badge error'}
              onClick={() =>
                void save(
                  { doNotContact: !person.doNotContact },
                  person.doNotContact ? 'May be contacted again' : 'Marked: do not contact',
                  true,
                )
              }
              loading={busy}
              label={person.doNotContact ? 'Allow contact' : 'Do not contact'}
            />
          </div>
        </form>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Where masi found them</span>
          <span className="muted">{found.length}</span>
        </div>
        {found.length === 0 && (
          <div className="empty-state">No record of where masi found them.</div>
        )}
        {found.length > 0 && (
          <MasiTable label="Where masi found the person" testId="person-found">
            <thead>
              <tr>
                <th>Source</th>
                <th>What it says</th>
                <th>Their page</th>
                <th>Company</th>
                <th>Posting</th>
                <th>Address</th>
                <th>Seen</th>
              </tr>
            </thead>
            <tbody>
              {found.map((f) => (
                <tr key={f.contactId}>
                  <td>
                    <div>{f.sourceName ?? f.source ?? '—'}</div>
                    <div className="muted">{originLabel(f.origin)}</div>
                  </td>
                  <td>{f.title}</td>
                  <td>
                    {f.profileUrl && (
                      <div>
                        <a href={f.profileUrl} target="_blank" rel="noopener noreferrer">
                          {pageLabel(f.profileUrl)}
                        </a>
                      </div>
                    )}
                    {f.linkedinUrl && (
                      <div>
                        <a href={f.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          LinkedIn
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    {f.companyId !== null && (
                      <Link to={`/masi/companies/${f.companyId}`}>
                        {f.companyName ?? `company ${f.companyId}`}
                      </Link>
                    )}
                  </td>
                  <td>
                    {f.listingUrl && (
                      <a href={f.listingUrl} target="_blank" rel="noopener noreferrer">
                        {f.listingTitle ?? 'the posting'}
                      </a>
                    )}
                  </td>
                  <td>{f.email}</td>
                  <td>
                    {formatDate(f.firstSeenAt)} – {formatDate(f.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
      {found
        .filter((f) => f.githubLogin && f.profile)
        .map((f) => (
          <GitHubProfileCard
            key={f.contactId}
            login={f.githubLogin as string}
            profile={f.profile as GitHubProfile}
          />
        ))}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Connections</span>
          <span className="muted">{connections.length}</span>
        </div>
        {connections.length === 0 && (
          <div className="empty-state">No connections masi knows of.</div>
        )}
        {connections.length > 0 && (
          <MasiTable label="People connected to the person" testId="person-connections">
            <thead>
              <tr>
                <th>Person</th>
                <th>How</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.personId}>
                  <td>
                    <Link to={`/masi/persons/${c.personId}`}>
                      {c.name ?? `person ${c.personId}`}
                    </Link>
                  </td>
                  <td>{connectionLabel(c)}</td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
      <PictureHistory key={person.id} personId={person.id} found={found} />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Companies</span>
          <span className="muted">{person.ties.length}</span>
        </div>
        {person.ties.length === 0 && <div className="empty-state">Tied to no company.</div>}
        {person.ties.length > 0 && (
          <MasiTable label="Companies of the person" testId="person-ties">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Who says so</th>
                <th>Since</th>
                <th>Until</th>
                <th>Address</th>
                <th>Picture</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {person.ties.map((t, i) => {
                const companyName = t.companyName ?? `company ${t.companyId}`;
                // one log per company, on its first tie that has a contact: a tie by word alone has nowhere to write
                const logHere =
                  person.ties.findIndex(
                    (o) => o.companyId === t.companyId && o.contactId !== null,
                  ) === i;
                return (
                  <tr key={`${t.companyId}-${t.role}-${t.evidenceRef ?? i}`}>
                    <td>
                      <Link to={`/masi/companies/${t.companyId}`}>{companyName}</Link>
                      {t.agency && <span className="masi-tag">agency</span>}
                    </td>
                    <td>{roleLabel(t.role)}</td>
                    <td>{evidenceLabel(t.evidence)}</td>
                    <td>{formatDate(t.since)}</td>
                    <td>{formatDate(t.until)}</td>
                    <td>{whereLabel(t.where)}</td>
                    <td>
                      {t.contactId != null && pictures.get(t.contactId) && (
                        <button
                          type="button"
                          className="picture-thumb"
                          aria-label={`Open the picture of ${companyName}`}
                          onClick={() => {
                            const cid = t.contactId;
                            if (cid == null) return;
                            const all = person.ties
                              .map((tie) =>
                                tie.contactId != null && pictures.get(tie.contactId)
                                  ? {
                                      url: pictures.get(tie.contactId) as string,
                                      alt: tie.companyName ?? `company ${tie.companyId}`,
                                    }
                                  : null,
                              )
                              .filter((x): x is ViewerPicture => x != null);
                            const index = Math.max(
                              0,
                              all.findIndex((x) => x.url === pictures.get(cid)),
                            );
                            setViewer({ pictures: all, index });
                          }}
                        >
                          <img
                            src={pictures.get(t.contactId)}
                            alt={companyName}
                            className="masi-contact-picture"
                            style={{
                              width: 64,
                              height: 64,
                              objectFit: 'cover',
                              borderRadius: 8,
                              cursor: 'zoom-in',
                            }}
                          />
                        </button>
                      )}
                    </td>
                    <td>
                      {logHere && (
                        <Link
                          className="masi-log-link"
                          to={`/masi/activity?person=${personId}&company=${t.companyId}`}
                          aria-label={`Log with them about ${companyName}`}
                        >
                          log
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </MasiTable>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity</span>
          <Link to={`/masi/activity?person=${personId}`} className="muted">
            all of it
          </Link>
        </div>
        {activity.length === 0 && (
          <div className="empty-state">Nothing logged with this person.</div>
        )}
        {activity.length > 0 && (
          <MasiTable label="Activity with the person">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.at)}</td>
                  <td>{a.summary}</td>
                  <td>
                    {a.companyId !== null && (
                      <Link to={`/masi/companies/${a.companyId}`}>
                        {a.companyName ?? `company ${a.companyId}`}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
      {viewer && (
        <PictureLightbox
          pictures={viewer.pictures}
          index={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

/** How a record came to masi, in words. */
function originLabel(origin: string | null): string {
  switch (origin) {
    case 'FROM_LISTING':
      return 'a posting';
    case 'FROM_REGISTER':
      return 'the e-Business Register';
    case 'FROM_WEB':
      return 'the web';
    case 'MANUAL':
      return 'you, by hand';
    case 'FROM_PARTNER':
      return 'a partner';
    case 'FROM_MAIL':
      return 'a mail';
    default:
      return origin ?? '';
  }
}

/** A page's address as it reads: no scheme, no "www.", no trailing slash - github.com/filippos47. */
function pageLabel(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/** How someone is connected to the person, in words: both ways, one way, or the same commit address. */
function connectionLabel(c: MasiPersonConnection): string {
  const how = [];
  if (c.follows && c.followedBy) how.push('follow each other');
  else if (c.follows) how.push('followed by this person');
  else if (c.followedBy) how.push('follows this person');
  if (c.sameAddress) how.push('same commit address');
  if (typeof c.faceDistance === 'number') {
    how.push(`possible connection: similar face (distance ${c.faceDistance.toFixed(2)})`);
  }
  if (c.samePicture) how.push('possible connection: same picture');
  return how.join(', ');
}
