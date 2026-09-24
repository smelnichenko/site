import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchMasiCompany,
  fetchMasiCompanyPersons,
  fetchMasiJobs,
  MasiCompany,
  MasiJob,
  MasiPerson,
  patchMasiCompany,
  patchMasiPerson,
} from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { badgeClass, errorMessage, formatDate } from './format';
import MasiTable from '../../components/MasiTable';
import RegisterCard from './RegisterCard';
import { byCompany, rolesText, whereLabel } from './people';
import { agencyText } from './register';

/**
 * One company: its facts from the register and the boards, which registered company it is, its open and closed jobs,
 * the people tied to it, the operator's flags.
 */
export default function MasiCompanyDetail() {
  const { id } = useParams();
  const companyId = Number(id);
  const [company, setCompany] = useState<MasiCompany | null>(null);
  const [jobs, setJobs] = useState<MasiJob[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [busyPerson, setBusyPerson] = useState<number | null>(null);
  const [people, setPeople] = useState<MasiPerson[]>([]);
  const [note, setNote] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const [c, js, ps] = await Promise.all([
        fetchMasiCompany(companyId, signal),
        fetchMasiJobs({ company: companyId, status: 'ALL', size: 100 }, signal),
        fetchMasiCompanyPersons(companyId, signal),
      ]);
      setCompany(c);
      setNote(c.userNote ?? '');
      setCareersUrl(c.careersUrl ?? '');
      setJobs(js.content);
      setJobTotal(js.totalElements);
      setPeople(ps);
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

  async function togglePerson(p: MasiPerson) {
    setBusyPerson(p.id);
    try {
      const next = await patchMasiPerson(p.id, { doNotContact: !p.doNotContact });
      setPeople((cur) => cur.map((x) => (x.id === next.id ? next : x)));
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Saving the person failed'));
    } finally {
      setBusyPerson(null);
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
        <div className="badge-group">
          <span className="muted">{agencyText(company)}</span>
          <LoadingButton
            className="status-badge"
            onClick={() =>
              void save(
                { agency: !company.agency },
                company.agency ? 'Marked: not an agency' : 'Marked: an agency',
              )
            }
            loading={busy}
            label={company.agency ? 'Not an agency' : 'Mark as agency'}
          />
          {company.agencyMark !== null && (
            <LoadingButton
              className="status-badge"
              onClick={() => void save({ agencyFromRegister: true }, 'The register decides again')}
              loading={busy}
              label="Let the register decide"
            />
          )}
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
      <RegisterCard company={company} onChange={setCompany} />
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
          <MasiTable label="Jobs of the company">
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
          </MasiTable>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">People</span>
          <span className="muted">{people.length}</span>
          <Link to={`/masi/persons?company=${companyId}`} className="muted">
            in the people list
          </Link>
        </div>
        {people.length === 0 && <div className="empty-state">Nobody tied to this company yet.</div>}
        {people.length > 0 && (
          <MasiTable label="People of the company" testId="company-people">
            <thead>
              <tr>
                <th>Name</th>
                <th>Here</th>
                <th>Address</th>
                <th>Contact?</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const here = byCompany(p.ties).find((c) => c.companyId === companyId);
                const tie = p.ties.find((t) => t.companyId === companyId);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/masi/persons/${p.id}`}>{p.name ?? 'unnamed'}</Link>
                      {p.title && <div className="muted">{p.title}</div>}
                    </td>
                    <td>{here ? rolesText(here.roles) : ''}</td>
                    <td>
                      {p.email ?? ''}
                      {tie && whereLabel(tie.where) && <div className="muted">{whereLabel(tie.where)}</div>}
                    </td>
                    <td>
                      <LoadingButton
                        className={p.doNotContact ? 'status-badge error' : 'status-badge success'}
                        onClick={() => void togglePerson(p)}
                        loading={busyPerson === p.id}
                        label={p.doNotContact ? 'do not contact' : 'ok to contact'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </MasiTable>
        )}
      </div>
    </div>
  );
}
