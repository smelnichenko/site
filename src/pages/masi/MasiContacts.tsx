import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchMasiContacts, MasiContact, Paged, patchMasiContact } from '../../services/api';
import MasiNav from '../../components/MasiNav';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage, formatDateTime } from './format';

const PAGE_SIZE = 50;

/** Every recorded contact person across companies; the do-not-contact flag is honoured by the letter's addressee line. */
export default function MasiContacts() {
  const [params, setParams] = useSearchParams();
  const pageNo = Number(params.get('page') ?? '0');
  const [page, setPage] = useState<Paged<MasiContact> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchMasiContacts({ page: pageNo, size: PAGE_SIZE }, controller.signal)
      .then(setPage)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e, 'Failed to load contacts'));
      });
    return () => controller.abort();
  }, [pageNo]);

  async function toggle(c: MasiContact) {
    setBusy(true);
    try {
      const next = await patchMasiContact(c.id, { doNotContact: !c.doNotContact });
      setPage((cur) =>
        cur ? { ...cur, content: cur.content.map((x) => (x.id === next.id ? next : x)) } : cur,
      );
    } catch (e: unknown) {
      setError(errorMessage(e, 'Saving the contact failed'));
    } finally {
      setBusy(false);
    }
  }

  const total = page?.totalElements ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">Contacts</span>
          <span className="muted">{page ? `${total}` : ''}</span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!page && !error && <div className="loading">Loading contacts...</div>}
        {page && page.content.length === 0 && (
          <div className="empty-state">No contacts recorded yet.</div>
        )}
        {page && page.content.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Title</th>
                <th>Email</th>
                <th>Seen</th>
                <th>Contact?</th>
              </tr>
            </thead>
            <tbody>
              {page.content.map((c) => (
                <tr key={c.id}>
                  <td>{c.name ?? <span className="muted">{c.kind.toLowerCase()}</span>}</td>
                  <td>
                    <Link to={`/masi/companies/${c.companyId}`}>
                      {c.companyName ?? `company ${c.companyId}`}
                    </Link>
                  </td>
                  <td>{c.title ?? ''}</td>
                  <td>{c.email ?? ''}</td>
                  <td>{formatDateTime(c.lastSeenAt)}</td>
                  <td>
                    <LoadingButton
                      className={c.doNotContact ? 'status-badge error' : 'status-badge success'}
                      onClick={() => void toggle(c)}
                      loading={busy}
                      label={c.doNotContact ? 'do not contact' : 'ok to contact'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn-small"
              disabled={pageNo <= 0}
              onClick={() => setParams({ page: String(pageNo - 1) })}
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
              onClick={() => setParams({ page: String(pageNo + 1) })}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
