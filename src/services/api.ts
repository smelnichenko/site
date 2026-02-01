export interface MonitorResult {
  id: number;
  pageName: string;
  url: string;
  pattern: string;
  extractedValue: number | null;
  matched: boolean;
  rawMatch: string | null;
  checkedAt: string;
  responseTimeMs: number;
  httpStatus: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
}

export interface PageConfig {
  name: string;
  url: string;
  pattern: string;
  cron: string;
}

export interface PageStats {
  pageName: string;
  last24Hours: {
    total: number;
    matches: number;
    noMatches: number;
  };
}

const API_BASE = '/api';

export async function fetchPages(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/monitor/pages`);
  if (!response.ok) throw new Error('Failed to fetch pages');
  return response.json();
}

export async function fetchPageConfig(): Promise<PageConfig[]> {
  const response = await fetch(`${API_BASE}/monitor/config`);
  if (!response.ok) throw new Error('Failed to fetch config');
  return response.json();
}

export async function fetchResults(
  pageName?: string,
  page = 0,
  size = 100
): Promise<PagedResponse<MonitorResult>> {
  const endpoint = pageName
    ? `${API_BASE}/monitor/results/${encodeURIComponent(pageName)}`
    : `${API_BASE}/monitor/results`;
  const response = await fetch(`${endpoint}?page=${page}&size=${size}`);
  if (!response.ok) throw new Error('Failed to fetch results');
  return response.json();
}

export async function fetchLatestResult(pageName: string): Promise<MonitorResult | null> {
  const response = await fetch(`${API_BASE}/monitor/results/${encodeURIComponent(pageName)}/latest`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest result');
  return response.json();
}

export async function fetchPageStats(pageName: string): Promise<PageStats> {
  const response = await fetch(`${API_BASE}/monitor/stats/${encodeURIComponent(pageName)}`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function triggerCheck(pageName: string): Promise<MonitorResult> {
  const response = await fetch(`${API_BASE}/monitor/check/${encodeURIComponent(pageName)}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger check');
  return response.json();
}

// RSS Feed Types

export interface RssMetricCount {
  collectionName: string;
  metricName: string;
  count: number;
}

export interface RssFeedResult {
  id: number;
  feedName: string;
  url: string;
  checkedAt: string;
  responseTimeMs: number | null;
  httpStatus: number | null;
  articleCount: number | null;
  errorMessage: string | null;
  metricCounts: RssMetricCount[];
}

export interface MetricConfig {
  name: string;
  keywords: string[];
}

export interface MetricsCollectionConfig {
  name: string;
  metrics: MetricConfig[];
}

export interface RssFeedConfig {
  name: string;
  url: string;
  collections: MetricsCollectionConfig[];
  cron: string;
  fetchContent: boolean;
  maxArticles: number;
}

export interface MetricChartPoint {
  time: string;
  timestamp: number;
  [metricName: string]: string | number;
}

export type ChartDataByCollection = Record<string, MetricChartPoint[]>;

// RSS Feed API Functions

export async function fetchRssFeeds(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/rss/feeds`);
  if (!response.ok) throw new Error('Failed to fetch RSS feeds');
  return response.json();
}

export async function fetchRssConfig(): Promise<RssFeedConfig[]> {
  const response = await fetch(`${API_BASE}/rss/config`);
  if (!response.ok) throw new Error('Failed to fetch RSS config');
  return response.json();
}

export async function fetchRssResults(
  feedName: string,
  page = 0,
  size = 100
): Promise<PagedResponse<RssFeedResult>> {
  const response = await fetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}?page=${page}&size=${size}`
  );
  if (!response.ok) throw new Error('Failed to fetch RSS results');
  return response.json();
}

export async function fetchRssLatestResult(feedName: string): Promise<RssFeedResult | null> {
  const response = await fetch(`${API_BASE}/rss/results/${encodeURIComponent(feedName)}/latest`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest RSS result');
  return response.json();
}

export async function fetchRssChartData(
  feedName: string,
  limit = 100
): Promise<ChartDataByCollection> {
  const response = await fetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}/chart-data?limit=${limit}`
  );
  if (!response.ok) throw new Error('Failed to fetch RSS chart data');
  return response.json();
}

export async function triggerRssCheck(feedName: string): Promise<RssFeedResult> {
  const response = await fetch(`${API_BASE}/rss/check/${encodeURIComponent(feedName)}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger RSS check');
  return response.json();
}
