import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

function PageDetail() {
  const { pageName } = useParams<{ pageName: string }>();
  const [results, setResults] = useState<MonitorResult[]>([]);
  const [stats, setStats] = useState<PageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decodedPageName = pageName ? decodeURIComponent(pageName) : '';

  async function loadData() {
    if (!decodedPageName) return;
    try {
      setError(null);
      const [resultsResponse, statsResponse] = await Promise.all([
        fetchResults(decodedPageName, 0, 100),
        fetchPageStats(decodedPageName),
      ]);
      setResults(resultsResponse.content);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [decodedPageName]);

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
            {results.slice(0, 20).map((result) => (
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
      </div>
    </div>
  );
}

export default PageDetail;
