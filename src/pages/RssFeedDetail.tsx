import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import {
  fetchRssResults,
  fetchRssChartData,
  fetchRssConfig,
  triggerRssCheck,
  RssFeedResult,
  RssFeedConfig,
  ChartDataByCollection,
} from '../services/api';
import MetricChart from '../components/MetricChart';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

const PAGE_SIZE = 20;

function RssFeedDetail() {
  const { feedName } = useParams<{ feedName: string }>();
  const [results, setResults] = useState<RssFeedResult[]>([]);
  const [config, setConfig] = useState<RssFeedConfig | null>(null);
  const [chartData, setChartData] = useState<ChartDataByCollection>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const decodedFeedName = feedName ? decodeURIComponent(feedName) : '';
  const totalPages = Math.ceil(totalElements / PAGE_SIZE);

  async function loadData(page = 0) {
    if (!decodedFeedName) return;

    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    try {
      setError(null);
      const [resultsResponse, chartDataResponse, configList] = await Promise.all([
        fetchRssResults(decodedFeedName, page, PAGE_SIZE, signal),
        fetchRssChartData(decodedFeedName, 100, signal),
        fetchRssConfig(signal),
      ]);
      if (signal.aborted) return;
      setResults(resultsResponse.content);
      setTotalElements(resultsResponse.totalElements);
      setChartData(chartDataResponse);

      if (configList) {
        const feedConfig = configList.find((c) => c.name === decodedFeedName);
        setConfig(feedConfig || null);
      }
    } catch {
      if (signal.aborted) return;
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setLoading(true);
    setCurrentPage(0);
    loadData(0);

    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [decodedFeedName]);

  function handlePageChange({ selected }: { selected: number }) {
    setCurrentPage(selected);
    loadData(selected);
  }

  async function handleManualCheck() {
    if (!decodedFeedName) return;
    try {
      setChecking(true);
      setError(null);
      await triggerRssCheck(decodedFeedName);
      await loadData();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!decodedFeedName) {
    return <div className="error">Invalid feed name</div>;
  }

  const latestResult = results[0];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/rss" className="status-badge edit">&larr; Back to RSS Dashboard</Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{decodedFeedName}</span>
          <div className="badge-group">
            <button
              className="status-badge action"
              onClick={handleManualCheck}
              disabled={checking}
            >
              {checking ? 'Checking...' : 'Check Now'}
            </button>
            {config && (
              <Link to={`/monitors?editFeed=${config.id}`} className="status-badge edit">Edit</Link>
            )}
            {latestResult && !latestResult.errorMessage && (
              <span className="status-badge success">OK</span>
            )}
            {latestResult?.errorMessage && (
              <span className="status-badge error">Error</span>
            )}
          </div>
        </div>

        {latestResult && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '1rem' }}>
            <div>
              <div className="stat-value">{latestResult.articleCount ?? 0}</div>
              <div className="stat-label">Articles (last check)</div>
            </div>
            <div>
              <div className="stat-value">{latestResult.responseTimeMs ?? 0}ms</div>
              <div className="stat-label">Response Time</div>
            </div>
            <div>
              <div className="stat-value">{results.length}</div>
              <div className="stat-label">Total Checks</div>
            </div>
          </div>
        )}

        {config && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              URL: <a href={config.url} target="_blank" rel="noopener noreferrer">{config.url}</a>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              Schedule: {config.cron} | Fetch content: {config.fetchContent ? 'Yes' : 'No'} | Max articles: {config.maxArticles}
            </div>
          </div>
        )}
      </div>

      {config?.collections.map((collection) => {
        const points = chartData[collection.name];
        if (!points || points.length === 0) return null;
        const metricNames = collection.metrics.map((m) => m.name);

        return (
          <MetricChart
            key={collection.name}
            data={points}
            metrics={metricNames}
            title={collection.name}
          />
        );
      })}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Results</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Articles</th>
              <th>Response Time</th>
              <th>Status</th>
              <th>Metrics</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{formatDate(result.checkedAt)}</td>
                <td>{result.articleCount ?? '-'}</td>
                <td>{result.responseTimeMs ?? '-'}ms</td>
                <td>
                  <span
                    className={`status-badge ${result.errorMessage ? 'error' : 'success'}`}
                  >
                    {result.errorMessage ? 'Error' : 'OK'}
                  </span>
                </td>
                <td>
                  {result.metricCounts && result.metricCounts.length > 0 ? (
                    <span style={{ fontSize: '0.85rem' }}>
                      {result.metricCounts.slice(0, 3).map((m) => `${m.metricName}: ${m.count}`).join(', ')}
                      {result.metricCounts.length > 3 && '...'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
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

export default RssFeedDetail;
