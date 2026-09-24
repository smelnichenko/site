import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiPersons, MasiPerson, Paged, patchMasiPerson } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDateTime, pageParam } from './format';
import { byCompany, rolesText } from './people';

const PAGE_SIZE = 50;

/**
 * The people behind the postings, across companies: who posted, who represents, who the operator spoke to. Search
 * finds a name or an address; the agency filter keeps those tied to a company that places people at others.
 */
export default function MasiPersons() {
  const [params, setParams] = useSearchParams();
  const pageNo = pageParam(params.get('page'));
  const q = params.get('q') ?? '';
  const agencyOnly = params.get('agency') === 'true';
  const companyParam = params.get('company');
  const company = companyParam ? Number(companyParam) : undefined;
  const [typed, setTyped] = useState(q);
  const [page, setPage] = useState<Paged<MasiPerson> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiPersons(
      {
        q: q || undefined,
        company,
        agency: agencyOnly ? true : undefined,
        page: pageNo,
        size: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((p) => {
        setPage(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load people'));
      });
    return () => controller.abort();
  }, [q, company, agencyOnly, pageNo]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('page'); // a new question starts on its first page
    setParams(next);
  }

  function goTo(n: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(n));
    setParams(next);
  }

  async function toggle(p: MasiPerson) {
    setBusyId(p.id);
    try {
      const next = await patchMasiPerson(p.id, { doNotContact: !p.doNotContact });
      setPage((cur) =>
        cur ? { ...cur, content: cur.content.map((x) => (x.id === next.id ? next : x)) } : cur,
      );
    } catch (e: unknown) {
      setError(errorMessage(e, 'Saving the person failed'));
    } finally {
      setBusyId(null);
    }
  }

  const total = page?.totalElements ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">People</span>
          <span className="muted">{page ? `${total}` : ''}</span>
        </div>
        <form
          className="masi-filters"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', typed.trim());
          }}
        >
          <label htmlFor="person-q">Name or address</label>
          <input id="person-q" type="search" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" className="btn-small">
            Search
          </button>
          <label>
            <input
              type="checkbox"
              checked={agencyOnly}
              onChange={(e) => setParam('agency', e.target.checked ? 'true' : null)}
            />{' '}
            at agencies only
          </label>
          {company !== undefined && (
            <button type="button" className="btn-small" onClick={() => setParam('company', null)}>
              All companies
            </button>
          )}
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading people...</div>}
        {page?.content.length === 0 && <div className="empty-state">Nobody matches.</div>}
        {page && page.content.length > 0 && (
          <MasiTable label="People">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Companies</th>
                <th>Seen</th>
                <th>Contact?</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/masi/persons/${p.id}`}>{p.name ?? 'unnamed'}</Link>
                    {p.title && <div className="muted">{p.title}</div>}
                  </td>
                  <td>{p.email ?? ''}</td>
                  <td>
                    {byCompany(p.ties).map((c) => (
                      <div key={c.companyId}>
                        <Link to={`/masi/companies/${c.companyId}`}>{c.companyName}</Link>
                        {c.agency && <span className="status-badge action">agency</span>}{' '}
                        <span className="muted">{rolesText(c.roles)}</span>
                      </div>
                    ))}
                  </td>
                  <td>{formatDateTime(p.lastSeenAt)}</td>
                  <td>
                    <LoadingButton
                      className={p.doNotContact ? 'status-badge error' : 'status-badge success'}
                      onClick={() => void toggle(p)}
                      loading={busyId === p.id}
                      label={p.doNotContact ? 'do not contact' : 'ok to contact'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
        {pages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn-small"
              disabled={pageNo <= 0}
              onClick={() => goTo(pageNo - 1)}
            >
              Previous
            </button>
            <span className="pagination-info">
              page {pageNo + 1} of {pages}
            </span>
            <button
              type="button"
              className="btn-small"
              disabled={pageNo + 1 >= pages}
              onClick={() => goTo(pageNo + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
