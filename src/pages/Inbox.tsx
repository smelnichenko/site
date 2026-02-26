import { useEffect, useState } from 'react';
import { fetchInboxEmails, ReceivedEmail, PagedResponse } from '../services/api';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function extractName(address: string): string {
  const match = address.match(/^(.+?)\s*<.+>$/);
  if (match) return match[1].trim();
  return address;
}

function Inbox() {
  const [data, setData] = useState<PagedResponse<ReceivedEmail> | null>(null);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        const result = await fetchInboxEmails(page, 20, controller.signal);
        if (!cancelled) setData(result);
      } catch {
        // Ignore aborted requests
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [page]);

  if (data === null) {
    return <div className="loading">Loading inbox...</div>;
  }

  if (data.totalElements === 0) {
    return (
      <div className="card">
        <p>No emails received yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Inbox</span>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            {data.totalElements} email{data.totalElements !== 1 ? 's' : ''}
          </span>
        </div>

        <table className="results-table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>From</th>
              <th>Subject</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {data.content.map((email) => (
              <>
                <tr
                  key={email.id}
                  onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                  style={{ cursor: 'pointer' }}
                  className={expandedId === email.id ? 'active' : ''}
                >
                  <td title={email.fromAddress}>{extractName(email.fromAddress)}</td>
                  <td>{email.subject || '(no subject)'}</td>
                  <td title={formatDate(email.receivedAt)}>{formatTimeAgo(email.receivedAt)}</td>
                </tr>
                {expandedId === email.id && (
                  <tr key={`${email.id}-body`}>
                    <td colSpan={3} style={{ padding: '1rem', background: '#f8f9fa' }}>
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        <strong>From:</strong> {email.fromAddress}<br />
                        <strong>To:</strong> {email.toAddresses}<br />
                        <strong>Date:</strong> {formatDate(email.receivedAt)}
                      </div>
                      {email.bodyHtml ? (
                        <iframe
                          srcDoc={email.bodyHtml}
                          sandbox=""
                          style={{ width: '100%', minHeight: '300px', border: '1px solid #ddd', background: '#fff' }}
                          title="Email body"
                        />
                      ) : email.bodyText ? (
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{email.bodyText}</pre>
                      ) : (
                        <p style={{ color: '#999' }}>No body content available.</p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {data.totalPages > 1 && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              className="btn"
              disabled={data.first}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#666' }}>
              Page {data.pageable.pageNumber + 1} of {data.totalPages}
            </span>
            <button
              className="btn"
              disabled={data.last}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inbox;
