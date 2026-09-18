import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchMasiCompany,
  fetchMasiCompanyContacts,
  fetchMasiJobs,
  MasiCompany,
  MasiContact,
  MasiJob,
  patchMasiCompany,
  patchMasiContact,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDate, formatDateTime } from './format';

/** One company: its facts from the register and the boards, its open and closed jobs, its contacts, the operator's flags. */
export default function MasiCompanyDetail() {
  const { id } = useParams();
  const companyId = Number(id);
  const [company, setCompany] = useState<MasiCompany | null>(null);
  const [jobs, setJobs] = useState<MasiJob[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [busyContact, setBusyContact] = useState<number | null>(null);
  const [contacts, setContacts] = useState<MasiContact[]>([]);
  const [note, setNote] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const [c, js, cs] = await Promise.all([
        fetchMasiCompany(companyId, signal),
        fetchMasiJobs({ company: companyId, status: 'ALL', size: 100 }, signal),
        fetchMasiCompanyContacts(companyId, signal),
      ]);
      setCompany(c);
      setNote(c.userNote ?? '');
      setCareersUrl(c.careersUrl ?? '');
      setJobs(js.content);
      setJobTotal(js.totalElements);
      setContacts(cs.content);
    },
    [companyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load the company'));
      }
    })();
    return () => controller.abort();
  }, [reload]);

  async function save(patch: Parameters<typeof patchMasiCompany>[1], done: string) {
    setBusy(true);
    setMessage(null);
    try {
      setCompany(await patchMasiCompany(companyId, patch));
      setMessage(done);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving failed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleContact(c: MasiContact) {
    setBusyContact(c.id);
    try {
      const next = await patchMasiContact(c.id, { doNotContact: !c.doNotContact });
      setContacts((cur) => cur.map((x) => (x.id === next.id ? next : x)));
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving the contact failed'));
    } finally {
      setBusyContact(null);
    }
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
  if (!company) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading company...</div>
      </div>
    );
  }
  const open = jobs.filter((j) => j.status === 'OPEN');
  const closed = jobs.filter((j) => j.status !== 'OPEN');
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">{company.name}</span>
          <span className={badgeClass(company.status)}>{company.status.toLowerCase()}</span>
        </div>
        <div className="muted">
          {company.registryCode ? `reg. ${company.registryCode} · ` : ''}
          {company.hqCity ? `${company.hqCity} · ` : ''}
          {company.sizeBand ? `${company.sizeBand} · ` : ''}
          {company.emtakCode ? `EMTAK ${company.emtakCode} · ` : ''}
          {company.origin.toLowerCase()} · seen {formatDate(company.firstSeenAt)} –{' '}
          {formatDate(company.lastSeenAt)}
          {company.registerSeenAt ? ` · register ${formatDate(company.registerSeenAt)}` : ''}
        </div>
        <div className="muted">
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer">
              website
            </a>
          )}
          {company.atsVendor ? ` · ATS ${company.atsVendor}` : ''}
        </div>
        <div className="form-group">
          <label htmlFor="careers-url">Careers URL</label>
          <input
            id="careers-url"
            type="url"
            value={careersUrl}
            onChange={(e) => setCareersUrl(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="company-note">Your note</label>
          <textarea
            id="company-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ width: '100%' }}
          />
        </div>
        {message && <div className="muted">{message}</div>}
        <div className="badge-group">
          <LoadingButton
            className="status-badge action"
            onClick={() => void save({ userNote: note, careersUrl }, 'Saved')}
            loading={busy}
            label="Save"
          />
          <LoadingButton
            className={company.blacklisted ? 'status-badge add' : 'status-badge error'}
            onClick={() =>
              void save(
                { blacklisted: !company.blacklisted },
                company.blacklisted
                  ? 'Blacklist lifted'
                  : 'Blacklisted: no packages for this company',
              )
            }
            loading={busy}
            label={company.blacklisted ? 'Lift blacklist' : 'Blacklist'}
          />
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Jobs</span>
          <span className="muted">
            {open.length} open · {closed.length} closed
            {jobTotal > jobs.length ? ` (showing ${jobs.length} of ${jobTotal})` : ''}
          </span>
          <Link to={`/masi/jobs?company=${companyId}&status=ALL`} className="muted">
            all in the registry
          </Link>
        </div>
        {jobs.length === 0 && <div className="empty-state">No jobs from this company yet.</div>}
        {jobs.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>First seen</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/masi/jobs/${j.id}`}>{j.title}</Link>
                  </td>
                  <td>
                    <span className={badgeClass(j.status)}>{j.status.toLowerCase()}</span>
                  </td>
                  <td>{formatDate(j.firstSeenAt)}</td>
                  <td>{formatDate(j.closedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Contacts</span>
          <span className="muted">{contacts.length}</span>
        </div>
        {contacts.length === 0 && <div className="empty-state">No contacts recorded.</div>}
        {contacts.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Seen</th>
                <th>Contact?</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name ?? <span className="muted">{c.kind.toLowerCase()}</span>}</td>
                  <td>{c.title ?? ''}</td>
                  <td>{c.email ?? ''}</td>
                  <td>{c.phone ?? ''}</td>
                  <td>{formatDateTime(c.lastSeenAt)}</td>
                  <td>
                    <LoadingButton
                      className={c.doNotContact ? 'status-badge error' : 'status-badge success'}
                      onClick={() => void toggleContact(c)}
                      loading={busyContact === c.id}
                      label={c.doNotContact ? 'do not contact' : 'ok to contact'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
