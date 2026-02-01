import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

function RssFeedDetail() {
  const { feedName } = useParams<{ feedName: string }>();
  const [results, setResults] = useState<RssFeedResult[]>([]);
  const [config, setConfig] = useState<RssFeedConfig | null>(null);
  const [chartData, setChartData] = useState<ChartDataByCollection>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decodedFeedName = feedName ? decodeURIComponent(feedName) : '';

  async function loadData() {
    if (!decodedFeedName) return;
    try {
      setError(null);
      const [resultsResponse, chartDataResponse, configList] = await Promise.all([
        fetchRssResults(decodedFeedName, 0, 100),
        fetchRssChartData(decodedFeedName),
        fetchRssConfig(),
      ]);
      setResults(resultsResponse.content);
      setChartData(chartDataResponse);

      if (configList) {
        const feedConfig = configList.find((c) => c.name === decodedFeedName);
        setConfig(feedConfig || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [decodedFeedName]);

  async function handleManualCheck() {
    if (!decodedFeedName) return;
    try {
      setChecking(true);
      setError(null);
      await triggerRssCheck(decodedFeedName);
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

  if (!decodedFeedName) {
    return <div className="error">Invalid feed name</div>;
  }

  const latestResult = results[0];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/rss">&larr; Back to RSS Dashboard</Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{decodedFeedName}</span>
          <button
            className="btn btn-primary"
            onClick={handleManualCheck}
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Check Now'}
          </button>
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

      {config && Object.entries(chartData).map(([collectionName, points]) => {
        const collection = config.collections.find((c) => c.name === collectionName);
        const metricNames = collection?.metrics.map((m) => m.name) || [];

        return (
          <MetricChart
            key={collectionName}
            data={points}
            metrics={metricNames}
            title={collectionName}
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
            {results.slice(0, 20).map((result) => (
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
      </div>
    </div>
  );
}

export default RssFeedDetail;
