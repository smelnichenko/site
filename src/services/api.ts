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

export interface PageMonitorConfig {
  id: number;
  name: string;
  url: string;
  pattern: string;
  cron: string;
  enabled: boolean;
}

export interface PageMonitorRequest {
  name: string;
  url: string;
  pattern: string;
  cron: string;
  enabled: boolean;
}

export interface RssFeedMonitorConfig {
  id: number;
  name: string;
  url: string;
  cron: string;
  fetchContent: boolean;
  maxArticles: number;
  enabled: boolean;
  collections: MetricsCollectionConfig[];
}

export interface RssFeedMonitorRequest {
  name: string;
  url: string;
  cron: string;
  fetchContent: boolean;
  maxArticles: number;
  enabled: boolean;
  collections: { name: string; metrics: { name: string; keywords: string[] }[] }[];
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

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Add CSRF token for state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }

  const response = await fetch(url, { ...options, headers, credentials: 'include' });

  if (response.status === 401) {
    localStorage.removeItem('email');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response;
}

export async function fetchPages(signal?: AbortSignal): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/monitor/pages`, { signal });
  if (!response.ok) throw new Error('Failed to fetch pages');
  return response.json();
}

export async function fetchPageConfig(signal?: AbortSignal): Promise<PageConfig[]> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch config');
  return response.json();
}

export async function fetchResults(
  pageName?: string,
  page = 0,
  size = 100,
  signal?: AbortSignal
): Promise<PagedResponse<MonitorResult>> {
  const endpoint = pageName
    ? `${API_BASE}/monitor/results/${encodeURIComponent(pageName)}`
    : `${API_BASE}/monitor/results`;
  const response = await apiFetch(`${endpoint}?page=${page}&size=${size}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch results');
  return response.json();
}

export async function fetchLatestResult(pageName: string, signal?: AbortSignal): Promise<MonitorResult | null> {
  const response = await apiFetch(`${API_BASE}/monitor/results/${encodeURIComponent(pageName)}/latest`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest result');
  return response.json();
}

export async function fetchPageStats(pageName: string, signal?: AbortSignal): Promise<PageStats> {
  const response = await apiFetch(`${API_BASE}/monitor/stats/${encodeURIComponent(pageName)}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function triggerCheck(pageName: string): Promise<MonitorResult> {
  const response = await apiFetch(`${API_BASE}/monitor/check/${encodeURIComponent(pageName)}`, {
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
  id: number;
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

export async function fetchRssFeeds(signal?: AbortSignal): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/rss/feeds`, { signal });
  if (!response.ok) throw new Error('Failed to fetch RSS feeds');
  return response.json();
}

export async function fetchRssConfig(signal?: AbortSignal): Promise<RssFeedConfig[]> {
  const response = await apiFetch(`${API_BASE}/rss/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch RSS config');
  return response.json();
}

export async function fetchRssResults(
  feedName: string,
  page = 0,
  size = 100,
  signal?: AbortSignal
): Promise<PagedResponse<RssFeedResult>> {
  const response = await apiFetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}?page=${page}&size=${size}`,
    { signal }
  );
  if (!response.ok) throw new Error('Failed to fetch RSS results');
  return response.json();
}

export async function fetchRssLatestResult(feedName: string, signal?: AbortSignal): Promise<RssFeedResult | null> {
  const response = await apiFetch(`${API_BASE}/rss/results/${encodeURIComponent(feedName)}/latest`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest RSS result');
  return response.json();
}

export async function fetchRssChartData(
  feedName: string,
  limit = 100,
  signal?: AbortSignal
): Promise<ChartDataByCollection> {
  const response = await apiFetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}/chart-data?limit=${limit}`,
    { signal }
  );
  if (!response.ok) throw new Error('Failed to fetch RSS chart data');
  return response.json();
}

export async function triggerRssCheck(feedName: string): Promise<RssFeedResult> {
  const response = await apiFetch(`${API_BASE}/rss/check/${encodeURIComponent(feedName)}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger RSS check');
  return response.json();
}

// Page Monitor CRUD

export async function fetchPageMonitorConfigs(signal?: AbortSignal): Promise<PageMonitorConfig[]> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch page monitor configs');
  return response.json();
}

export async function createPageMonitor(request: PageMonitorRequest): Promise<PageMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create page monitor');
  }
  return response.json();
}

export async function updatePageMonitor(id: number, request: PageMonitorRequest): Promise<PageMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/monitor/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update page monitor');
  return response.json();
}

export async function deletePageMonitor(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/monitor/config/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete page monitor');
}

// RSS Feed Monitor CRUD

export async function fetchRssFeedMonitorConfigs(signal?: AbortSignal): Promise<RssFeedMonitorConfig[]> {
  const response = await apiFetch(`${API_BASE}/rss/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch RSS feed monitor configs');
  return response.json();
}

export async function createRssFeedMonitor(request: RssFeedMonitorRequest): Promise<RssFeedMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/rss/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create RSS feed monitor');
  }
  return response.json();
}

export async function updateRssFeedMonitor(id: number, request: RssFeedMonitorRequest): Promise<RssFeedMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/rss/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update RSS feed monitor');
  return response.json();
}

export async function deleteRssFeedMonitor(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/rss/config/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete RSS feed monitor');
}

// AI Collection Generation

export interface GenerateCollectionsRequest { url: string; prompt: string }
export interface GeneratedCollection { name: string; metrics: { name: string; keywords: string[] }[] }

export async function generateRssCollections(request: GenerateCollectionsRequest): Promise<GeneratedCollection[]> {
  const response = await apiFetch(`${API_BASE}/rss/generate-collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Generation failed');
  }
  return (await response.json()).collections;
}

// Game Types & API

export interface GameState {
  id: number;
  player1Position: number;
  player2Position: number;
  currentTurn: number;
  totalSpins: number;
  completed: boolean;
  winner: number | null;
}

export interface SpinResult {
  colors: string[];
  player1Position: number;
  player2Position: number;
  currentTurn: number;
  completed: boolean;
  winner: number;
  totalSpins: number;
}

export async function fetchGameState(signal?: AbortSignal): Promise<GameState> {
  const response = await apiFetch(`${API_BASE}/game/state`, { signal });
  if (!response.ok) throw new Error('Failed to fetch game state');
  return response.json();
}

export async function spinGame(): Promise<SpinResult> {
  const response = await apiFetch(`${API_BASE}/game/spin`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Spin failed');
  }
  return response.json();
}

export async function resetGame(): Promise<GameState> {
  const response = await apiFetch(`${API_BASE}/game/reset`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to reset game');
  return response.json();
}

// User preferences

export async function saveLastPath(path: string): Promise<void> {
  await apiFetch(`${API_BASE}/user/last-path`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

// Test endpoints (run check with inline config, no save)

export async function testPageMonitor(request: PageMonitorRequest): Promise<MonitorResult> {
  const response = await apiFetch(`${API_BASE}/monitor/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Test failed');
  return response.json();
}

export async function testRssFeedMonitor(request: RssFeedMonitorRequest): Promise<RssFeedResult> {
  const response = await apiFetch(`${API_BASE}/rss/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Test failed');
  return response.json();
}
