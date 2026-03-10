import { useEffect, useMemo, useState } from 'react';
import { fetchLatestResult, fetchResults, fetchPageMonitorConfigs, MonitorResult, PageMonitorConfig } from '../services/api';
import PageCard from '../components/PageCard';
import ValueChart from '../components/ValueChart';

function fetchLatestSafe(name: string, signal: AbortSignal): Promise<MonitorResult | null> {
  return fetchLatestResult(name, signal).catch(() => null);
}

function Dashboard() {
  const [configs, setConfigs] = useState<PageMonitorConfig[] | null>(null);
  const [latestResults, setLatestResults] = useState<Map<string, MonitorResult | null>>(new Map());
  const [allResults, setAllResults] = useState<MonitorResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        const configList = await fetchPageMonitorConfigs(controller.signal);
        if (cancelled) return;
        setConfigs(configList);

        const pageNames = configList.map(c => c.name);

        const [latestArr, allResultsResponse] = await Promise.all([
          Promise.all(pageNames.map(name => fetchLatestSafe(name, controller.signal))),
          fetchResults(undefined, 0, 50, controller.signal),
        ]);
        if (cancelled) return;
        const results = new Map<string, MonitorResult | null>();
        pageNames.forEach((name, i) => results.set(name, latestArr[i]));
        setLatestResults(results);
        if (cancelled) return;
        setAllResults(allResultsResponse.content);
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

  // Must be before the early return to satisfy React's Rules of Hooks
  const resultsByPage = useMemo(() => {
    const map = new Map<string, MonitorResult[]>();
    for (const result of allResults) {
      const existing = map.get(result.pageName) || [];
      existing.push(result);
      map.set(result.pageName, existing);
    }
    for (const [key, values] of map) {
      if (values.length > 50) {
        map.set(key, values.slice(-50));
      }
    }
    return map;
  }, [allResults]);

  if (configs === null) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="grid">
        {configs.map((config) => (
          <PageCard
            key={config.name}
            pageName={config.name}
            latestResult={latestResults.get(config.name) || null}
            editUrl={`/monitors?editPage=${config.id}`}
          />
        ))}
      </div>

      {configs.map((config) => {
        const pageResults = resultsByPage.get(config.name) || [];
        if (pageResults.length === 0) return null;
        return (
          <ValueChart
            key={config.name}
            data={pageResults}
            title={`${config.name} - Value History`}
          />
        );
      })}
    </div>
  );
}

export default Dashboard;
