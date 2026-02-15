import { useEffect, useMemo, useState } from 'react';
import { fetchPages, fetchLatestResult, fetchResults, fetchPageMonitorConfigs, MonitorResult, PageMonitorConfig } from '../services/api';
import PageCard from '../components/PageCard';
import ValueChart from '../components/ValueChart';

function Dashboard() {
  const [pages, setPages] = useState<string[] | null>(null);
  const [latestResults, setLatestResults] = useState<Map<string, MonitorResult | null>>(new Map());
  const [allResults, setAllResults] = useState<MonitorResult[]>([]);
  const [configs, setConfigs] = useState<Map<string, PageMonitorConfig>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        const pageNames = await fetchPages(controller.signal);
        if (cancelled) return;
        setPages(pageNames);

        const configList = await fetchPageMonitorConfigs(controller.signal);
        if (cancelled) return;
        const configMap = new Map<string, PageMonitorConfig>();
        for (const c of configList) {
          configMap.set(c.name, c);
        }
        setConfigs(configMap);

        const results = new Map<string, MonitorResult | null>();
        for (const name of pageNames) {
          if (cancelled) return;
          const result = await fetchLatestResult(name, controller.signal);
          results.set(name, result);
        }
        if (cancelled) return;
        setLatestResults(results);

        const allResultsResponse = await fetchResults(undefined, 0, 200, controller.signal);
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

  if (pages === null) {
    return <div className="loading">Loading...</div>;
  }

  const resultsByPage = useMemo(() => {
    const map = new Map<string, MonitorResult[]>();
    for (const result of allResults) {
      const existing = map.get(result.pageName) || [];
      existing.push(result);
      map.set(result.pageName, existing);
    }
    // Cap per chart to avoid rendering too many points
    for (const [key, values] of map) {
      if (values.length > 50) {
        map.set(key, values.slice(-50));
      }
    }
    return map;
  }, [allResults]);

  return (
    <div>
      <div className="grid">
        {pages.map((pageName) => {
          const config = configs.get(pageName);
          return (
            <PageCard
              key={pageName}
              pageName={pageName}
              latestResult={latestResults.get(pageName) || null}
              editUrl={config ? `/monitors?editPage=${config.id}` : undefined}
            />
          );
        })}
      </div>

      {pages.map((pageName) => {
        const pageResults = resultsByPage.get(pageName) || [];
        if (pageResults.length === 0) return null;
        return (
          <ValueChart
            key={pageName}
            data={pageResults}
            title={`${pageName} - Value History`}
          />
        );
      })}
    </div>
  );
}

export default Dashboard;
