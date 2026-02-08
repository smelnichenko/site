import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchRssFeeds,
  fetchRssLatestResult,
  fetchRssChartData,
  fetchRssConfig,
  RssFeedResult,
  RssFeedConfig,
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
  const [feeds, setFeeds] = useState<string[] | null>(null);
  const [configs, setConfigs] = useState<Map<string, RssFeedConfig>>(new Map());
  const [latestResults, setLatestResults] = useState<Map<string, RssFeedResult | null>>(new Map());
  const [chartData, setChartData] = useState<Map<string, ChartDataByCollection>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        const feedNames = await fetchRssFeeds(controller.signal);
        if (cancelled) return;
        setFeeds(feedNames);

        const configList = await fetchRssConfig(controller.signal);
        if (cancelled) return;
        const configMap = new Map<string, RssFeedConfig>();
        if (configList) {
          for (const config of configList) {
            configMap.set(config.name, config);
          }
        }
        setConfigs(configMap);

        const results = new Map<string, RssFeedResult | null>();
        const charts = new Map<string, ChartDataByCollection>();

        for (const name of feedNames) {
          if (cancelled) return;
          const result = await fetchRssLatestResult(name, controller.signal);
          results.set(name, result);

          if (cancelled) return;
          const data = await fetchRssChartData(name, 100, controller.signal);
          charts.set(name, data);
        }

        if (cancelled) return;
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

  if (feeds === null) {
    return <div className="loading">Loading RSS feeds...</div>;
  }

  if (feeds.length === 0) {
    return (
      <div className="card">
        <p>No RSS feeds configured. <a href="/monitors">Add a feed monitor</a> to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid">
        {feeds.map((feedName) => {
          const result = latestResults.get(feedName);
          const config = configs.get(feedName);

          return (
            <div key={feedName} className="card" data-testid="rss-feed-card">
              <div className="card-header">
                <Link to={`/rss/${encodeURIComponent(feedName)}`} className="card-title">
                  {feedName}
                </Link>
                {result && !result.errorMessage && (
                  <span className="status-badge success">OK</span>
                )}
                {result?.errorMessage && (
                  <span className="status-badge error">Error</span>
                )}
              </div>

              {result && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="stat-value">{result.articleCount ?? 0}</div>
                  <div className="stat-label">Articles processed</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                    Last check: {formatTimeAgo(result.checkedAt)}
                  </div>
                </div>
              )}

              {config && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                  {config.collections.length} collection(s),{' '}
                  {config.collections.reduce((sum, c) => sum + c.metrics.length, 0)} metric(s)
                </div>
              )}

              {result?.errorMessage && (
                <div style={{ marginTop: '0.5rem', color: '#dc3545', fontSize: '0.85rem' }}>
                  {result.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feeds.map((feedName) => {
        const data = chartData.get(feedName);
        const config = configs.get(feedName);
        if (!data || !config) return null;

        return Object.entries(data).map(([collectionName, points]) => {
          const collection = config.collections.find((c) => c.name === collectionName);
          const metricNames = collection?.metrics.map((m) => m.name) || [];

          return (
            <MetricChart
              key={`${feedName}-${collectionName}`}
              data={points}
              metrics={metricNames}
              title={`${feedName} - ${collectionName}`}
            />
          );
        });
      })}
    </div>
  );
}

export default RssDashboard;
