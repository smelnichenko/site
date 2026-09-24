import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchMasiActivity,
  fetchMasiPerson,
  MasiActivity,
  MasiPerson,
  patchMasiPerson,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDate, formatDateTime } from './format';
import { evidenceLabel, roleLabel, whereLabel } from './people';

/** The fields the operator corrects, as typed; empty is "leave as it is", which is what the API's null means. */
interface Draft {
  name: string;
  title: string;
  email: string;
  phone: string;
  note: string;
}

function draftOf(p: MasiPerson): Draft {
  return {
    name: p.name ?? '',
    title: p.title ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    note: p.userNote ?? '',
  };
}

/** Only what changed: sending an unchanged address would ask the server to re-check an identity nobody touched. */
function changes(p: MasiPerson, d: Draft) {
  const out: Parameters<typeof patchMasiPerson>[1] = {};
  if (d.name.trim() && d.name.trim() !== (p.name ?? '')) out.name = d.name.trim();
  if (d.title.trim() !== (p.title ?? '') && d.title.trim()) out.title = d.title.trim();
  if (d.email.trim() && d.email.trim() !== (p.email ?? '')) out.email = d.email.trim();
  if (d.phone.trim() && d.phone.trim() !== (p.phone ?? '')) out.phone = d.phone.trim();
  if (d.note !== (p.userNote ?? '')) out.userNote = d.note;
  return out;
}

/** One person: who they are, every company they are tied to with what says so, and what happened with them. */
export default function MasiPersonDetail() {
  const { id } = useParams();
  const personId = Number(id);
  const [person, setPerson] = useState<MasiPerson | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', title: '', email: '', phone: '', note: '' });
  const [activity, setActivity] = useState<MasiActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the person'));
      }
    })();
    return () => controller.abort();
  }, [personId]);

  async function save(patch: Parameters<typeof patchMasiPerson>[1], done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await patchMasiPerson(personId, patch);
      setPerson(next);
      setDraft(draftOf(next));
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
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">{person.name ?? 'Unnamed person'}</span>
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
              className={person.doNotContact ? 'status-badge success' : 'status-badge error'}
              onClick={() =>
                void save(
                  { doNotContact: !person.doNotContact },
                  person.doNotContact ? 'May be contacted again' : 'Marked: do not contact',
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
              </tr>
            </thead>
            <tbody>
              {person.ties.map((t, i) => (
                <tr key={`${t.companyId}-${t.role}-${t.evidenceRef ?? i}`}>
                  <td>
                    <Link to={`/masi/companies/${t.companyId}`}>
                      {t.companyName ?? `company ${t.companyId}`}
                    </Link>
                    {t.agency && <span className="status-badge action">agency</span>}
                  </td>
                  <td>{roleLabel(t.role)}</td>
                  <td>{evidenceLabel(t.evidence)}</td>
                  <td>{formatDate(t.since)}</td>
                  <td>{formatDate(t.until)}</td>
                  <td>{whereLabel(t.where)}</td>
                </tr>
              ))}
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
        {activity.length === 0 && <div className="empty-state">Nothing logged with this person.</div>}
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
    </div>
  );
}
