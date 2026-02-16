import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchRssFeedMonitorConfigs,
  fetchRssLatestResult,
  fetchRssChartData,
  RssFeedResult,
  RssFeedMonitorConfig,
  ChartDataByCollection,
} from '../services/api';
import MetricChart from '../components/MetricChart';

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

function RssDashboard() {
  const [configs, setConfigs] = useState<RssFeedMonitorConfig[] | null>(null);
  const [latestResults, setLatestResults] = useState<Map<string, RssFeedResult | null>>(new Map());
  const [chartData, setChartData] = useState<Map<string, ChartDataByCollection>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        const configList = await fetchRssFeedMonitorConfigs(controller.signal);
        if (cancelled) return;
        setConfigs(configList);

        const [latestArr, chartArr] = await Promise.all([
          Promise.all(configList.map(c =>
            fetchRssLatestResult(c.name, controller.signal).catch(() => null)
          )),
          Promise.all(configList.map(c =>
            fetchRssChartData(c.name, 50, controller.signal).catch(() => ({} as ChartDataByCollection))
          )),
        ]);
        if (cancelled) return;

        const results = new Map<string, RssFeedResult | null>();
        const charts = new Map<string, ChartDataByCollection>();
        configList.forEach((config, i) => {
          results.set(config.name, latestArr[i]);
          charts.set(config.name, chartArr[i]);
        });
        setLatestResults(results);
        setChartData(charts);
      } catch {
        // Ignore errors from aborted requests
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (configs === null) {
    return <div className="loading">Loading RSS feeds...</div>;
  }

  if (configs.length === 0) {
    return (
      <div className="card">
        <p>No RSS feeds configured. <a href="/monitors">Add a feed monitor</a> to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid">
        {configs.map((config) => {
          const result = latestResults.get(config.name);

          return (
            <div key={config.name} className="card" data-testid="rss-feed-card">
              <div className="card-header">
                <Link to={`/rss/${encodeURIComponent(config.name)}`} className="card-title">
                  {config.name}
                </Link>
                <div className="badge-group">
                  <Link to={`/monitors?editFeed=${config.id}`} className="status-badge edit">Edit</Link>
                  {result && !result.errorMessage && (
                    <span className="status-badge success">OK</span>
                  )}
                  {result?.errorMessage && (
                    <span className="status-badge error">Error</span>
                  )}
                </div>
              </div>

              {result ? (
                <div style={{ marginTop: '1rem' }}>
                  <div className="stat-value">{result.articleCount ?? 0}</div>
                  <div className="stat-label">Articles processed</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                    Last check: {formatTimeAgo(result.checkedAt)}
                  </div>
                </div>
              ) : (
                <div className="loading">No data yet</div>
              )}

              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                {config.collections.length} collection(s),{' '}
                {config.collections.reduce((sum, c) => sum + c.metrics.length, 0)} metric(s)
              </div>

              {result?.errorMessage && (
                <div style={{ marginTop: '0.5rem', color: '#dc3545', fontSize: '0.85rem' }}>
                  {result.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {configs.map((config) => {
        const data = chartData.get(config.name);
        if (!data) return null;

        return Object.entries(data).map(([collectionName, points]) => {
          const collection = config.collections.find((c) => c.name === collectionName);
          const metricNames = collection?.metrics.map((m) => m.name)
            || [...new Set(points.flatMap((p) => Object.keys(p).filter((k) => k !== 'time' && k !== 'timestamp')))];

          return (
            <MetricChart
              key={`${config.name}-${collectionName}`}
              data={points}
              metrics={metricNames}
              title={`${config.name} - ${collectionName}`}
            />
          );
        });
      })}
    </div>
  );
}

export default RssDashboard;
