import { useEffect, useState } from 'react';
import { fetchPages, fetchLatestResult, fetchResults, MonitorResult } from '../services/api';
import PageCard from '../components/PageCard';
import ValueChart from '../components/ValueChart';

function Dashboard() {
  const [pages, setPages] = useState<string[]>([]);
  const [latestResults, setLatestResults] = useState<Map<string, MonitorResult | null>>(new Map());
  const [allResults, setAllResults] = useState<MonitorResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const pageNames = await fetchPages();
        setPages(pageNames);

        const results = new Map<string, MonitorResult | null>();
        for (const name of pageNames) {
          const result = await fetchLatestResult(name);
          results.set(name, result);
        }
        setLatestResults(results);

        const allResultsResponse = await fetchResults(undefined, 0, 200);
        setAllResults(allResultsResponse.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && pages.length === 0) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const resultsByPage = new Map<string, MonitorResult[]>();
  for (const result of allResults) {
    const existing = resultsByPage.get(result.pageName) || [];
    existing.push(result);
    resultsByPage.set(result.pageName, existing);
  }

  return (
    <div>
      <div className="grid">
        {pages.map((pageName) => (
          <PageCard
            key={pageName}
            pageName={pageName}
            latestResult={latestResults.get(pageName) || null}
          />
        ))}
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
