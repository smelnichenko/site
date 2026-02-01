import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import {
  fetchResults,
  fetchPageStats,
  triggerCheck,
  MonitorResult,
  PageStats,
} from '../services/api';
import ValueChart from '../components/ValueChart';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

const PAGE_SIZE = 20;

function PageDetail() {
  const { pageName } = useParams<{ pageName: string }>();
  const [results, setResults] = useState<MonitorResult[]>([]);
  const [stats, setStats] = useState<PageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const decodedPageName = pageName ? decodeURIComponent(pageName) : '';
  const totalPages = Math.ceil(totalElements / PAGE_SIZE);

  async function loadData(page = 0) {
    if (!decodedPageName) return;
    try {
      setError(null);
      const [resultsResponse, statsResponse] = await Promise.all([
        fetchResults(decodedPageName, page, PAGE_SIZE),
        fetchPageStats(decodedPageName),
      ]);
      setResults(resultsResponse.content);
      setTotalElements(resultsResponse.totalElements);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setCurrentPage(0);
    loadData(0);
  }, [decodedPageName]);

  function handlePageChange({ selected }: { selected: number }) {
    setCurrentPage(selected);
    loadData(selected);
  }

  async function handleManualCheck() {
    if (!decodedPageName) return;
    try {
      setChecking(true);
      setError(null);
      await triggerCheck(decodedPageName);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!decodedPageName) {
    return <div className="error">Invalid page name</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/">&larr; Back to Dashboard</Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{decodedPageName}</span>
          <button
            className="btn btn-primary"
            onClick={handleManualCheck}
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Check Now'}
          </button>
        </div>

        {stats && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <div className="stat-value">{stats.last24Hours.total}</div>
              <div className="stat-label">Total Checks (24h)</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: '#28a745' }}>
                {stats.last24Hours.matches}
              </div>
              <div className="stat-label">Successful</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: '#dc3545' }}>
                {stats.last24Hours.noMatches}
              </div>
              <div className="stat-label">Failed</div>
            </div>
          </div>
        )}
      </div>

      <ValueChart data={results} title="Value History" />

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Results</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Value</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>HTTP Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{formatDate(result.checkedAt)}</td>
                <td>
                  {result.extractedValue !== null
                    ? result.extractedValue.toLocaleString()
                    : '-'}
                </td>
                <td>
                  <span
                    className={`status-badge ${result.matched ? 'success' : 'error'}`}
                  >
                    {result.matched ? 'OK' : 'Failed'}
                  </span>
                </td>
                <td>{result.responseTimeMs}ms</td>
                <td>{result.httpStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <>
            <ReactPaginate
              pageCount={totalPages}
              pageRangeDisplayed={3}
              marginPagesDisplayed={1}
              onPageChange={handlePageChange}
              forcePage={currentPage}
              containerClassName="pagination"
              activeClassName="selected"
              disabledClassName="disabled"
              previousLabel="← Prev"
              nextLabel="Next →"
            />
            <div className="pagination-info">
              Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalElements)} of {totalElements}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PageDetail;
