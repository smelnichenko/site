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

import { getAccessToken } from './oidcClient';

const API_BASE = '/api';

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add Bearer token
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    console.error('API 401:', url);
    // Don't auto-redirect — let the UI handle it
    throw new Error('Unauthorized');
  }

  return response;
}

/**
 * Parse a JSON body as `T`.
 *
 * `Response.json()` is typed `Promise<any>`, so `return response.json()` silently hands an untyped
 * value to a caller that believes it has a `MonitorResult`. Confining that one cast here means the
 * `any` cannot spread: `T` is inferred from each caller's declared return type. It is still an
 * unchecked assertion — the server's contract is the guarantee, not the compiler.
 */
async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Best-effort parse of an error body. A failing endpoint may answer HTML or nothing at all, so the
 * parse is allowed to fail — but the fallback must stay typed, or `err.error` reads through `any`
 * and a later typo in the field name compiles clean.
 */
async function readErrorBody(response: Response): Promise<{ error?: string }> {
  return (await response.json().catch(() => ({}))) as { error?: string };
}

export async function fetchPages(signal?: AbortSignal): Promise<string[]> {
  const response = await apiFetch(`${API_BASE}/monitor/pages`, { signal });
  if (!response.ok) throw new Error('Failed to fetch pages');
  return readJson(response);
}

export async function fetchPageConfig(signal?: AbortSignal): Promise<PageConfig[]> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch config');
  return readJson(response);
}

export async function fetchResults(
  pageName?: string,
  page = 0,
  size = 100,
  signal?: AbortSignal,
): Promise<PagedResponse<MonitorResult>> {
  const endpoint = pageName
    ? `${API_BASE}/monitor/results/${encodeURIComponent(pageName)}`
    : `${API_BASE}/monitor/results`;
  const response = await apiFetch(`${endpoint}?page=${page}&size=${size}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch results');
  return readJson(response);
}

export async function fetchLatestResult(
  pageName: string,
  signal?: AbortSignal,
): Promise<MonitorResult | null> {
  const response = await apiFetch(
    `${API_BASE}/monitor/results/${encodeURIComponent(pageName)}/latest`,
    { signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest result');
  return readJson(response);
}

export async function fetchPageStats(pageName: string, signal?: AbortSignal): Promise<PageStats> {
  const response = await apiFetch(`${API_BASE}/monitor/stats/${encodeURIComponent(pageName)}`, {
    signal,
  });
  if (!response.ok) throw new Error('Failed to fetch stats');
  return readJson(response);
}

export async function triggerCheck(pageName: string): Promise<MonitorResult> {
  const response = await apiFetch(`${API_BASE}/monitor/check/${encodeURIComponent(pageName)}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger check');
  return readJson(response);
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
  return readJson(response);
}

export async function fetchRssConfig(signal?: AbortSignal): Promise<RssFeedConfig[]> {
  const response = await apiFetch(`${API_BASE}/rss/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch RSS config');
  return readJson(response);
}

export async function fetchRssResults(
  feedName: string,
  page = 0,
  size = 100,
  signal?: AbortSignal,
): Promise<PagedResponse<RssFeedResult>> {
  const response = await apiFetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}?page=${page}&size=${size}`,
    { signal },
  );
  if (!response.ok) throw new Error('Failed to fetch RSS results');
  return readJson(response);
}

export async function fetchRssLatestResult(
  feedName: string,
  signal?: AbortSignal,
): Promise<RssFeedResult | null> {
  const response = await apiFetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}/latest`,
    { signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch latest RSS result');
  return readJson(response);
}

export async function fetchRssChartData(
  feedName: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<ChartDataByCollection> {
  const response = await apiFetch(
    `${API_BASE}/rss/results/${encodeURIComponent(feedName)}/chart-data?limit=${limit}`,
    { signal },
  );
  if (!response.ok) throw new Error('Failed to fetch RSS chart data');
  return readJson(response);
}

export async function triggerRssCheck(feedName: string): Promise<RssFeedResult> {
  const response = await apiFetch(`${API_BASE}/rss/check/${encodeURIComponent(feedName)}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger RSS check');
  return readJson(response);
}

// Page Monitor CRUD

export async function fetchPageMonitorConfigs(signal?: AbortSignal): Promise<PageMonitorConfig[]> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch page monitor configs');
  return readJson(response);
}

export async function createPageMonitor(request: PageMonitorRequest): Promise<PageMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/monitor/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to create page monitor');
  }
  return readJson(response);
}

export async function updatePageMonitor(
  id: number,
  request: PageMonitorRequest,
): Promise<PageMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/monitor/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update page monitor');
  return readJson(response);
}

export async function deletePageMonitor(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/monitor/config/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete page monitor');
}

// RSS Feed Monitor CRUD

export async function fetchRssFeedMonitorConfigs(
  signal?: AbortSignal,
): Promise<RssFeedMonitorConfig[]> {
  const response = await apiFetch(`${API_BASE}/rss/config`, { signal });
  if (!response.ok) throw new Error('Failed to fetch RSS feed monitor configs');
  return readJson(response);
}

export async function createRssFeedMonitor(
  request: RssFeedMonitorRequest,
): Promise<RssFeedMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/rss/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to create RSS feed monitor');
  }
  return readJson(response);
}

export async function updateRssFeedMonitor(
  id: number,
  request: RssFeedMonitorRequest,
): Promise<RssFeedMonitorConfig> {
  const response = await apiFetch(`${API_BASE}/rss/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update RSS feed monitor');
  return readJson(response);
}

export async function deleteRssFeedMonitor(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/rss/config/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete RSS feed monitor');
}

// AI Collection Generation

export interface GenerateCollectionsRequest {
  url: string;
  prompt: string;
}
export interface GeneratedCollection {
  name: string;
  metrics: { name: string; keywords: string[] }[];
}

export async function generateRssCollections(
  request: GenerateCollectionsRequest,
): Promise<GeneratedCollection[]> {
  const response = await apiFetch(`${API_BASE}/rss/generate-collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Generation failed');
  }
  return (await readJson<{ collections: GeneratedCollection[] }>(response)).collections;
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
  return readJson(response);
}

export async function spinGame(): Promise<SpinResult> {
  const response = await apiFetch(`${API_BASE}/game/spin`, { method: 'POST' });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Spin failed');
  }
  return readJson(response);
}

export async function resetGame(): Promise<GameState> {
  const response = await apiFetch(`${API_BASE}/game/reset`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to reset game');
  return readJson(response);
}

// User preferences

export async function saveLastPath(path: string): Promise<void> {
  await apiFetch(`${API_BASE}/user/last-path`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

// Inbox (received emails)

export interface ReceivedEmail {
  id: number;
  resendEmailId: string;
  fromAddress: string;
  toAddresses: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: string;
  createdAt: string;
}

export async function fetchInboxEmails(
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<PagedResponse<ReceivedEmail>> {
  const response = await apiFetch(`${API_BASE}/inbox/emails?page=${page}&size=${size}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch emails');
  return readJson(response);
}

export async function fetchInboxEmail(id: number, signal?: AbortSignal): Promise<ReceivedEmail> {
  const response = await apiFetch(`${API_BASE}/inbox/emails/${id}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch email');
  return readJson(response);
}

export interface EmailAttachment {
  id: number;
  emailId: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function fetchEmailAttachments(
  emailId: number,
  signal?: AbortSignal,
): Promise<EmailAttachment[]> {
  const response = await apiFetch(`${API_BASE}/inbox/emails/${emailId}/attachments`, { signal });
  if (!response.ok) throw new Error('Failed to fetch attachments');
  return readJson(response);
}

export function getAttachmentDownloadUrl(emailId: number, attachmentId: number): string {
  return `${API_BASE}/inbox/emails/${emailId}/attachments/${attachmentId}`;
}

// Chat API

export interface ChatChannel {
  id: number;
  name: string;
  createdAt: string;
  memberCount: number;
  joined: boolean;
  isOwner: boolean;
  isSystem: boolean;
  unreadCount: number;
  encrypted: boolean;
  currentKeyVersion: number;
}

export interface ChatUser {
  id: number;
  uuid: string;
  email: string;
}

export interface ChatMessage {
  messageId: string;
  channelId: number;
  userUuid: string;
  username: string;
  content: string;
  parentMessageId?: string;
  createdAt: string;
  hash?: string;
  prevHash?: string;
  editedContent?: string;
  keyVersion?: number;
  messageType?: string;
  metadata?: string;
}

export interface MessageEdit {
  editId: string;
  userUuid: string;
  content: string;
  hash: string;
  createdAt: string;
}

export interface ChainVerification {
  messageCount: number;
  validCount: number;
  intact: boolean;
  firstBrokenMessageId?: string;
}

export async function fetchChatChannels(signal?: AbortSignal): Promise<ChatChannel[]> {
  const response = await apiFetch(`${API_BASE}/chat/channels`, { signal });
  if (!response.ok) throw new Error('Failed to fetch channels');
  return readJson(response);
}

export async function createChatChannel(name: string, encrypted?: boolean): Promise<ChatChannel> {
  const response = await apiFetch(`${API_BASE}/chat/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, encrypted }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to create channel');
  }
  return readJson(response);
}

export async function leaveChatChannel(channelId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/leave`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to leave channel');
}

export async function deleteChatChannel(channelId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete channel');
}

export async function fetchChatMessages(
  channelId: number,
  limit = 50,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const response = await apiFetch(
    `${API_BASE}/chat/channels/${channelId}/messages?limit=${limit}`,
    { signal },
  );
  if (!response.ok) throw new Error('Failed to fetch messages');
  return readJson(response);
}

export async function sendChatMessage(
  channelId: number,
  content: string,
  parentMessageId?: string,
  keyVersion?: number,
): Promise<ChatMessage> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, parentMessageId, keyVersion }),
  });
  if (!response.ok) throw new Error('Failed to send message');
  return readJson(response);
}

export async function markChannelRead(channelId: number): Promise<void> {
  await apiFetch(`${API_BASE}/chat/channels/${channelId}/read`, { method: 'POST' });
}

export async function editChatMessage(
  channelId: number,
  messageId: string,
  content: string,
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages/${messageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to edit message');
  }
}

export async function fetchMessageEdits(
  channelId: number,
  messageId: string,
  signal?: AbortSignal,
): Promise<MessageEdit[]> {
  const response = await apiFetch(
    `${API_BASE}/chat/channels/${channelId}/messages/${messageId}/edits`,
    { signal },
  );
  if (!response.ok) throw new Error('Failed to fetch edits');
  return readJson(response);
}

export async function verifyChannelChain(
  channelId: number,
  signal?: AbortSignal,
): Promise<ChainVerification> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/verify`, { signal });
  if (!response.ok) throw new Error('Failed to verify chain');
  return readJson(response);
}

export async function fetchChatUsers(signal?: AbortSignal): Promise<ChatUser[]> {
  const response = await apiFetch(`${API_BASE}/chat/users`, { signal });
  if (!response.ok) throw new Error('Failed to fetch users');
  return readJson(response);
}

export async function inviteToChannel(channelId: number, userUuid: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userUuid }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to invite user');
  }
}

export interface ChannelMember {
  id: number;
  uuid: string;
  email: string;
  joinedAt: string;
}

export async function fetchChannelMembers(
  channelId: number,
  signal?: AbortSignal,
): Promise<ChannelMember[]> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/members`, { signal });
  if (!response.ok) throw new Error('Failed to fetch members');
  return readJson(response);
}

export async function kickFromChannel(channelId: number, userUuid: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userUuid }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Failed to kick user');
  }
}

// E2E Encryption Key Management

export interface UserKeysResponse {
  publicKey: string;
  encryptedPrivateKey: string;
  pbkdf2Salt: string;
  pbkdf2Iterations: number;
  keyVersion: number;
}

export interface PublicKeyInfo {
  userUuid: string;
  publicKey: string;
  keyVersion: number;
}

export interface ChannelKeyBundleResponse {
  userUuid: string;
  keyVersion: number;
  encryptedChannelKey: string;
  wrapperPublicKey: string;
}

export interface MemberKeyBundle {
  userUuid: string;
  encryptedChannelKey: string;
  wrapperPublicKey: string;
}

export async function fetchUserKeys(signal?: AbortSignal): Promise<UserKeysResponse | null> {
  const response = await apiFetch(`${API_BASE}/chat/keys`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch keys');
  return readJson(response);
}

export async function uploadUserKeys(request: {
  publicKey: string;
  encryptedPrivateKey: string;
  pbkdf2Salt: string;
  pbkdf2Iterations: number;
}): Promise<UserKeysResponse> {
  const response = await apiFetch(`${API_BASE}/chat/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to upload keys');
  return readJson(response);
}

export async function updateUserKeys(request: {
  publicKey: string;
  encryptedPrivateKey: string;
  pbkdf2Salt: string;
  pbkdf2Iterations: number;
}): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/keys`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Failed to update keys');
}

export async function fetchPublicKeys(
  userUuids: string[],
  signal?: AbortSignal,
): Promise<PublicKeyInfo[]> {
  const params = userUuids.map((id) => `userUuids=${id}`).join('&');
  const response = await apiFetch(`${API_BASE}/chat/keys/public?${params}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch public keys');
  return readJson(response);
}

export async function fetchChannelKeys(
  channelId: number,
  keyVersion?: number,
  signal?: AbortSignal,
): Promise<ChannelKeyBundleResponse[]> {
  const params = keyVersion == null ? '' : `?keyVersion=${keyVersion}`;
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys${params}`, {
    signal,
  });
  if (!response.ok) throw new Error('Failed to fetch channel keys');
  return readJson(response);
}

export async function setChannelKeys(channelId: number, bundles: MemberKeyBundle[]): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundles }),
  });
  if (!response.ok) throw new Error('Failed to set channel keys');
}

export async function rotateChannelKeys(
  channelId: number,
  bundles: MemberKeyBundle[],
): Promise<{ newKeyVersion: number }> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundles }),
  });
  if (!response.ok) throw new Error('Failed to rotate channel keys');
  return readJson(response);
}

// Chess API

export interface ChessGameDto {
  gameUuid: string;
  fen: string;
  pgn: string | null;
  status: 'WAITING_FOR_OPPONENT' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  result: 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW' | null;
  resultReason:
    'CHECKMATE' | 'RESIGNATION' | 'STALEMATE' | 'AGREEMENT' | 'INSUFFICIENT_MATERIAL' | null;
  gameType: 'AI' | 'PVP';
  moveCount: number;
  lastMove: string | null;
  whitePlayerUuid: string;
  blackPlayerUuid: string | null;
  drawOfferedByUuid: string | null;
  aiDifficulty: number | null;
  updatedAt: string;
}

export async function createChessGame(
  type: 'AI' | 'PVP',
  difficulty?: number,
): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, difficulty }),
  });
  if (!response.ok) throw new Error('Failed to create game');
  return readJson(response);
}

export async function fetchChessGame(uuid: string, signal?: AbortSignal): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch game');
  return readJson(response);
}

export async function fetchActiveChessGames(signal?: AbortSignal): Promise<ChessGameDto[]> {
  const response = await apiFetch(`${API_BASE}/chess/games`, { signal });
  if (!response.ok) throw new Error('Failed to fetch games');
  return readJson(response);
}

export async function fetchOpenChessGames(signal?: AbortSignal): Promise<ChessGameDto[]> {
  const response = await apiFetch(`${API_BASE}/chess/games/open`, { signal });
  if (!response.ok) throw new Error('Failed to fetch open games');
  return readJson(response);
}

export async function fetchChessHistory(
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<PagedResponse<ChessGameDto>> {
  const response = await apiFetch(`${API_BASE}/chess/games/history?page=${page}&size=${size}`, {
    signal,
  });
  if (!response.ok) throw new Error('Failed to fetch history');
  return readJson(response);
}

export async function joinChessGame(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/join`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to join game');
  return readJson(response);
}

export async function makeChessMove(uuid: string, move: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Invalid move');
  }
  return readJson(response);
}

export async function makeChessAiMove(uuid: string, move: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/ai-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new Error(err.error || 'Invalid AI move');
  }
  return readJson(response);
}

export async function resignChessGame(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/resign`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to resign');
  return readJson(response);
}

export async function offerChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to offer draw');
  return readJson(response);
}

export async function acceptChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw/accept`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to accept draw');
  return readJson(response);
}

export async function declineChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw/decline`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to decline draw');
  return readJson(response);
}

export async function abandonChessGame(uuid: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to abandon game');
}

// Test endpoints (run check with inline config, no save)

export async function testPageMonitor(request: PageMonitorRequest): Promise<MonitorResult> {
  const response = await apiFetch(`${API_BASE}/monitor/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Test failed');
  return readJson(response);
}

export async function testRssFeedMonitor(request: RssFeedMonitorRequest): Promise<RssFeedResult> {
  const response = await apiFetch(`${API_BASE}/rss/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Test failed');
  return readJson(response);
}

// Admin API

export interface AdminUser {
  uuid: string;
  email: string;
  enabled: boolean;
  groups: string[];
  permissions: string[];
  createdAt: string;
}

export interface AppGroup {
  id: number;
  name: string;
  description: string | null;
  permissions: { id: number; permission: string }[];
  createdAt: string;
}

export async function fetchAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  const response = await apiFetch(`${API_BASE}/admin/users`, { signal });
  return readJson(response);
}

export async function setUserEnabled(userUuid: string, enabled: boolean): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userUuid}/enabled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to update user');
  }
}

export async function setUserGroups(userUuid: string, groupIds: number[]): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userUuid}/groups`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupIds }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to update groups');
  }
}

export async function fetchAdminGroups(signal?: AbortSignal): Promise<AppGroup[]> {
  const response = await apiFetch(`${API_BASE}/admin/groups`, { signal });
  return readJson(response);
}

export async function createGroup(
  name: string,
  description: string,
  permissions: string[],
): Promise<AppGroup> {
  const response = await apiFetch(`${API_BASE}/admin/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to create group');
  }
  return readJson(response);
}

export async function updateGroup(
  id: number,
  name: string,
  description: string,
  permissions: string[],
): Promise<AppGroup> {
  const response = await apiFetch(`${API_BASE}/admin/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to update group');
  }
  return readJson(response);
}

export async function deleteGroup(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/groups/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to delete group');
  }
}

// Registration Approval API

export interface ApprovalStatus {
  status: string;
  reason?: string;
}

export interface PendingApprovalItem {
  id: number;
  userUuid: string;
  status: string;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export async function fetchApprovalStatus(signal?: AbortSignal): Promise<ApprovalStatus> {
  const response = await apiFetch(`${API_BASE}/auth/approval-status`, { signal });
  if (!response.ok) throw new Error('Failed to fetch approval status');
  return readJson(response);
}

export async function fetchApprovalMode(): Promise<{ mode: string }> {
  const response = await fetch(`${API_BASE}/auth/approval-mode`);
  if (!response.ok) throw new Error('Failed to fetch approval mode');
  return readJson(response);
}

export async function fetchPendingApprovals(signal?: AbortSignal): Promise<PendingApprovalItem[]> {
  const response = await apiFetch(`${API_BASE}/admin/approvals`, { signal });
  if (!response.ok) throw new Error('Failed to fetch pending approvals');
  return readJson(response);
}

export async function approveRegistration(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/approvals/${id}/approve`, { method: 'POST' });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to approve');
  }
}

export async function declineRegistration(id: number, reason?: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/approvals/${id}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to decline');
  }
}

// ---------------------------------------------------------------------------
// masi — CV master (the candidate's evidence bank; JOBS permission)
// ---------------------------------------------------------------------------

export interface CvVersionMeta {
  version: number;
  note: string | null;
  active: boolean;
  activatedAt: string | null;
  createdAt: string;
  schemaVersion: string;
  /** The language the version is written in (en, et, ru). */
  language: string | null;
  /** For a translation: the version it was translated from; null for a master the operator wrote. */
  translatedFrom: number | null;
  /** For a translation: when the operator approved it. */
  reviewedAt: string | null;
  /** For a translation: reviewed, still passing, and its source is the active master — packages may be tuned from it. */
  current: boolean | null;
  /** For a translation: what stands between it and its approval; empty when nothing does. */
  parity: string[] | null;
}

/** A translation of the master being made, or the last one made: it takes the model half a minute or more. */
export interface CvTranslationStatus {
  state: 'RUNNING' | 'DONE' | 'FAILED';
  sourceVersion: number;
  language: string;
  version: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface CvCompleteness {
  score: number;
  gaps: string[];
}

export interface CvMaster {
  active: CvVersionMeta | null;
  yaml: string | null;
  completeness: CvCompleteness | null;
}

export interface CvValidation {
  valid: boolean;
  errors: string[];
}

export async function fetchCvMaster(signal?: AbortSignal): Promise<CvMaster> {
  const response = await apiFetch(`${API_BASE}/masi/cv`, { signal });
  if (!response.ok) throw new Error('Failed to fetch the CV master');
  return readJson(response);
}

export async function fetchCvVersions(signal?: AbortSignal): Promise<CvVersionMeta[]> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions`, { signal });
  if (!response.ok) throw new Error('Failed to fetch CV versions');
  return readJson(response);
}

export async function fetchCvVersion(version: number, signal?: AbortSignal): Promise<CvMaster> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions/${version}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch the CV version');
  return readJson(response);
}

export async function validateCv(yaml: string): Promise<CvValidation> {
  const response = await apiFetch(`${API_BASE}/masi/cv/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml }),
  });
  if (!response.ok) throw new Error('Validation request failed');
  return readJson(response);
}

/**
 * Creates a new, inactive version; a schema refusal comes back as the error list, not a throw. With
 * {@code translatedFrom} it is an edited translation of that version, checked for parity the same way.
 */
export async function createCvVersion(
  yaml: string,
  note: string,
  translatedFrom?: number,
): Promise<{ version: CvVersionMeta | null; errors: string[] }> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml, note, translatedFrom }),
  });
  if (response.status === 400 || response.status === 409) {
    const body = (await response.json().catch(() => ({}))) as { errors?: string[]; error?: string };
    return { version: null, errors: body.errors ?? [body.error ?? 'Invalid CV master'] };
  }
  if (!response.ok) throw new Error('Failed to save the CV version');
  return { version: await readJson<CvVersionMeta>(response), errors: [] };
}

export async function activateCvVersion(version: number): Promise<CvVersionMeta> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions/${version}/activate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to activate the CV version');
  return readJson(response);
}

/** Starts translating a version into {@code language}; the model works in the background (202). */
export async function startCvTranslation(version: number, language: string): Promise<CvTranslationStatus> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions/${version}/translations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to start the translation');
  }
  return readJson(response);
}

/** The latest translation since masi started: running, made or failed; null when there has been none. */
export async function fetchCvTranslationStatus(signal?: AbortSignal): Promise<CvTranslationStatus | null> {
  const response = await apiFetch(`${API_BASE}/masi/cv/translation`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch the translation status');
  return readJson(response);
}

/** Approves a translation; refused (with its parity problems) while one stands. */
export async function reviewCvTranslation(version: number): Promise<CvVersionMeta> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions/${version}/review`, { method: 'POST' });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to approve the translation');
  }
  return readJson(response);
}

/** The preview is a PDF the browser opens itself; the token rides in a header, so fetch it as a blob. */
export async function fetchCvPreview(version: number): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/masi/cv/versions/${version}/preview.pdf`);
  if (!response.ok) throw new Error('Failed to render the preview');
  return response.blob();
}

// ---------------------------------------------------------------------------
// masi — registry, companies, contacts, sources, packages, dashboard (JOBS)
// ---------------------------------------------------------------------------

export interface Paged<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface MasiListing {
  id: number;
  sourceId: number;
  sourceKey: string | null;
  url: string;
  titleRaw: string | null;
  companyRaw: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  missCount: number;
  closedAt: string | null;
}

export interface MasiJob {
  id: number;
  title: string;
  companyId: number | null;
  companyName: string | null;
  location: string | null;
  remote: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  /** MERGED: found to be another job's duplicate; its listings live there, see mergedIntoId. */
  status: 'OPEN' | 'CLOSED' | 'MERGED';
  firstSeenAt: string;
  lastSeenAt: string;
  closedAt: string | null;
  reopenedCount: number;
  userNote: string | null;
  descriptionText: string | null;
  listings: MasiListing[];
  /** The keys of the sources with an open listing of the job — where it is present now, each once, sorted. */
  sources: string[];
  mergedIntoId: number | null;
  /**
   * A merged job's last stop through any chain of merges — where its listings, notes, bookings and log rows are; null
   * when not merged. Sent with the detail only: mergedIntoId is one hop, which may itself be merged.
   */
  becameId: number | null;
  packageId: number | null;
  packageStatus: string | null;
  /** How far the caller's active CV master covers what the posting asks for, 0-100; null = not scored (yet, or not scorable). */
  matchScore: number | null;
  /** The reasons, on the job's own page only. */
  match: MasiMatch | null;
}

/** Why a job has no score: a zero would be a statement about the candidate, and these are not. */
export type MasiUnscored = 'NOTHING_STATED' | 'OTHER_LANGUAGE' | 'UNREADABLE';

export interface MasiMatch {
  score: number | null;
  supportedMustHave: string[];
  missingMustHave: string[];
  /** Must-haves that are about nothing a CV shows in words ("strong experience"). */
  notScored: string[];
  unscored: MasiUnscored | null;
  /** Who judged: the free word scorer, or the AI match checked against the master. Absent on rows older than the AI match. */
  method?: 'WORDS' | 'AI';
  /** The AI match only: every requirement with its verdict and the evidence it stands on. */
  requirements?: MasiMatchRequirement[];
}

export type MasiMatchVerdict = 'MET' | 'PARTLY' | 'NOT_MET' | 'NOT_A_CV_THING';

/** An item of the CV master a verdict stands on: its catalogue id (S3, R1, R1.A2 …) and what it is. */
export interface MasiMatchEvidence {
  id: string;
  label: string;
}

export interface MasiMatchRequirement {
  id: string;
  category: 'MUST' | 'KEYWORD' | 'NICE';
  /** The posting's own words. */
  text: string;
  /** The model's English for a requirement written in another language; null for one in English. */
  english: string | null;
  kind: string | null;
  verdict: MasiMatchVerdict;
  evidence: MasiMatchEvidence[];
  reason: string | null;
  /** Who decided: the model on its evidence, the master's role dates (years), or its languages list (a level). */
  decidedBy: 'model' | 'dates' | 'languages';
}

export interface MasiManualJob {
  url: string;
  company: string;
  title: string;
  location?: string;
  description?: string;
  /** ISO instant; absent = the server's default lifetime for a pasted posting. */
  expiresAt?: string;
}

export interface MasiSimilarJob {
  id: number;
  title: string;
  similarity: number;
  firstSeenAt: string;
}

export interface MasiJobFilter {
  status?: 'OPEN' | 'CLOSED' | 'ALL';
  q?: string;
  company?: number;
  remote?: string;
  packageStatus?: string;
  /** "match,desc" orders by the caller's score, unscored jobs last; absent = newest first. */
  sort?: string;
  page?: number;
  size?: number;
}

export interface MasiCompany {
  id: number;
  name: string;
  registryCode: string | null;
  website: string | null;
  careersUrl: string | null;
  atsVendor: string | null;
  emtakCode: string | null;
  sizeBand: string | null;
  hqCity: string | null;
  tags: string | null;
  status: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  registerSeenAt: string | null;
  blacklisted: boolean;
  /** Whether it places people at others: the operator's mark if given, else the register's line of business (EMTAK 78). */
  agency: boolean;
  /** The operator's own word either way; null when they gave none and the register decides. */
  agencyMark: boolean | null;
  userNote: string | null;
}

/** What a person is to a company; each is claimed only by the evidence that can say it. */
export type MasiTieRole = 'POSTED_FOR' | 'REPRESENTS' | 'WORKS_AT' | 'RECRUITS_FOR' | 'TALKED_TO';
/** Who says so. */
export type MasiTieEvidence = 'LISTING' | 'REGISTER' | 'PARTNER' | 'OPERATOR';
/** Whether the address a person published is the company's: SOMEWHERE_ELSE is a recruiter writing from outside it. */
export type MasiEmailDomain = 'THE_COMPANYS' | 'SOMEWHERE_ELSE' | 'COMPANY_UNKNOWN' | 'NO_ADDRESS';

/** One tie of a person to a company, with what says so. */
export interface MasiPersonTie {
  companyId: number;
  companyName: string | null;
  agency: boolean;
  role: MasiTieRole;
  evidence: MasiTieEvidence;
  evidenceRef: string | null;
  since: string | null;
  until: string | null;
  where: MasiEmailDomain;
  /** The person's contact at that company, which a log written with them goes to; null for a tie made by word alone. */
  contactId: number | null;
}

/** A row the company page lists apart from its people: a desk, a company address, a contact nobody was made of. */
export interface MasiContact {
  id: number;
  companyId: number | null;
  companyName: string | null;
  kind: string;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  doNotContact: boolean;
  userNote: string | null;
  /** The person the contact is; null for a desk or a company address. */
  personId: number | null;
}

export interface MasiPerson {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  doNotContact: boolean;
  userNote: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  ties: MasiPersonTie[];
}

/** A registered company an employer might be; `sure` is the one masi would attach without asking. */
export interface MasiRegisterCandidate {
  registryCode: string;
  name: string;
  legalForm: string | null;
  emtakCode: string | null;
  hqCity: string | null;
  sizeBand: string | null;
  website: string | null;
  /** EXACT: the whole name; PREFIX: the registered name begins with it; CODE: the operator typed its code. */
  how: 'EXACT' | 'PREFIX' | 'CODE';
  sure: boolean;
  employerForm: boolean;
  heldById: number | null;
  heldByName: string | null;
}

/** The candidates, and why there are few or none: the register not read yet, or too many names beginning with it. */
export interface MasiRegisterCandidates {
  indexed: boolean;
  truncated: boolean;
  candidates: MasiRegisterCandidate[];
}

/** A placement the operator or the weekly pass made, and what it replaced — which taking it back restores. */
export interface MasiRegisterPlacement {
  registryCode: string;
  placedAt: string;
  priorWebsite: string | null;
  priorHqCity: string | null;
  priorEmtakCode: string | null;
  priorSizeBand: string | null;
}

export interface MasiSource {
  id: number;
  key: string;
  name: string;
  kind: string;
  scope: string;
  baseUrl: string | null;
  cron: string;
  enabled: boolean;
  configJson: string | null;
  termsNote: string | null;
  health: string;
  consecutiveFailures: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  running: boolean;
}

export interface MasiSourceRun {
  id: number;
  sourceId: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  complete: boolean;
  fetched: number;
  parsed: number;
  newJobs: number;
  updatedListings: number;
  closedListings: number;
  newCompanies: number;
  newContacts: number;
  error: string | null;
}

export interface MasiArtifact {
  kind: 'CV_PDF' | 'LETTER_TXT';
  contentType: string;
  size: number;
  sha256: string;
  available: boolean;
}

export interface MasiTunedBullet {
  achievementIndex: number;
  text: string;
}

export interface MasiTunedRole {
  company: string;
  title: string;
  collapsed: boolean;
  bullets: MasiTunedBullet[];
}

export interface MasiTunedCv {
  summary: string;
  title: string;
  roles: MasiTunedRole[];
  skills: string[];
  coverLetter: string;
}

export interface MasiFinding {
  rule: string;
  detail: string;
}

export interface MasiPackage {
  id: number;
  jobId: number;
  jobTitle: string | null;
  companyName: string | null;
  cvVersionId: number;
  cvVersion: number | null;
  /** The language the operator asked for; null follows the posting. */
  language: string | null;
  /** The version the last tune was made from (the master or its translation), and the language it is written in. */
  tunedFromVersion: number | null;
  writtenIn: string | null;
  status: string;
  attempts: number;
  tunedCv: MasiTunedCv | null;
  coverLetter: string | null;
  claims: MasiFinding[] | null;
  lint: MasiFinding[] | null;
  model: string | null;
  costUsd: number | null;
  error: string | null;
  userNotes: string | null;
  appliedAt: string | null;
  response: string;
  createdAt: string;
  updatedAt: string;
  artifacts: MasiArtifact[];
}

export interface MasiDashboard {
  openJobs: number;
  newJobs7d: number;
  closedJobs7d: number;
  companiesHiring: number;
  packages: Record<string, number>;
  llm: {
    today: number;
    dailyBudget: number;
    month: number;
    monthlyBudget: number;
    enabled: boolean;
    monthByPurpose: Record<string, number>;
    averagePackageCostMonth: number | null;
  };
  cv: { activeVersion: number | null; completeness: number | null; gaps: string[] };
  sources: Array<{
    id: number;
    key: string;
    name: string;
    enabled: boolean;
    health: string;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    running: boolean;
  }>;
  tuningPausedUntil: string | null;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function masiGet<T>(path: string, signal?: AbortSignal, what = 'load'): Promise<T> {
  const response = await apiFetch(`${API_BASE}/masi${path}`, { signal });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || `Failed to ${what}`);
  }
  return readJson<T>(response);
}

async function masiSend<T>(
  path: string,
  method: string,
  body?: unknown,
  what = 'save',
): Promise<T> {
  const response = await apiFetch(`${API_BASE}/masi${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || `Failed to ${what}`);
  }
  if (response.status === 204) {
    // a delete answers no content: parsing it as JSON would throw and the caller would read a success as a failure
    return undefined as T;
  }
  return readJson<T>(response);
}

export function fetchMasiDashboard(signal?: AbortSignal): Promise<MasiDashboard> {
  return masiGet('/dashboard', signal, 'load the dashboard');
}

export function fetchMasiJobs(
  filter: MasiJobFilter,
  signal?: AbortSignal,
): Promise<Paged<MasiJob>> {
  return masiGet(`/jobs${query({ ...filter })}`, signal, 'load jobs');
}

export function fetchMasiJob(id: number, signal?: AbortSignal): Promise<MasiJob> {
  return masiGet(`/jobs/${id}`, signal, 'load the job');
}

/** A posting pasted in from a board masi never contacts; the answer is the job it became (maybe one a board already shows). */
export function addMasiJobManually(posting: MasiManualJob): Promise<MasiJob> {
  return masiSend('/jobs/manual', 'POST', posting, 'add the job');
}

/**
 * One entry of a position's timeline. LISTED: a board first showed it (detail: the board's own title where it
 * differs); GONE: that listing closed; CLOSED; REPOSTED (sourceKey: the board that brought it back); MERGED_IN
 * (jobId: the duplicate absorbed, detail: its title); MERGED_INTO (jobId: the survivor).
 */
export interface MasiJobHistoryEntry {
  at: string;
  kind: 'LISTED' | 'GONE' | 'CLOSED' | 'REPOSTED' | 'MERGED_IN' | 'MERGED_INTO';
  sourceKey: string | null;
  jobId: number | null;
  detail: string | null;
}

/** The position's timeline, oldest first. */
export function fetchMasiJobHistory(
  id: number,
  signal?: AbortSignal,
): Promise<MasiJobHistoryEntry[]> {
  return masiGet(`/jobs/${id}/history`, signal, 'load the job history');
}

/** One row of the search's log. `mine`: the caller's own row (a system row is everyone's). */
export interface MasiActivity {
  id: number;
  at: string;
  kind:
    | 'COLLECTED'
    | 'ANALYSED'
    | 'PREPARED'
    | 'APPLIED'
    | 'SENT_MESSAGE'
    | 'RECEIVED_MESSAGE'
    | 'CALL'
    | 'INTERVIEW'
    | 'OFFER'
    | 'REJECTED'
    | 'NOTE'
    | 'SCHEDULED';
  origin: 'SYSTEM' | 'OPERATOR' | 'MAIL';
  jobId: number | null;
  jobTitle: string | null;
  companyId: number | null;
  companyName: string | null;
  contactId: number | null;
  contactName: string | null;
  /** The person the contact is: their page is where the row links. */
  personId: number | null;
  packageId: number | null;
  summary: string;
  detail: string | null;
  mine: boolean;
}

/** The kinds the operator logs by hand. */
export const MASI_ACTIVITY_KINDS = [
  'CALL',
  'SENT_MESSAGE',
  'RECEIVED_MESSAGE',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'NOTE',
] as const;

export interface MasiActivityFilter {
  from?: string;
  to?: string;
  kind?: string;
  job?: number;
  company?: number;
  contact?: number;
  /** Everything with this person, at whichever company: their contacts' rows. */
  person?: number;
  page?: number;
  size?: number;
}

/** The log, newest first: the caller's rows and masi's own. */
export function fetchMasiActivity(
  filter: MasiActivityFilter,
  signal?: AbortSignal,
): Promise<Paged<MasiActivity>> {
  return masiGet(`/activity${query({ ...filter })}`, signal, 'load the activity log');
}

/** The operator logs a call, a message, a note: one of their kinds, tied to a job, a company or a contact. */
export function logMasiActivity(entry: {
  at?: string;
  kind: string;
  jobId?: number;
  companyId?: number;
  contactId?: number;
  /** With a company: the person's contact there is the one the row is with. */
  personId?: number;
  summary: string;
  detail?: string;
}): Promise<MasiActivity> {
  return masiSend('/activity', 'POST', entry, 'log the activity');
}

/** One day of the calendar: what was collected, sent and communicated. */
export interface MasiDayCounts {
  day: string;
  collected: number;
  sent: number;
  communicated: number;
}

/** One booking of the operator's calendar: a call, an interview, a deadline they set themselves, a follow-up. */
export interface MasiCalendarEvent {
  id: number;
  kind: 'CALL' | 'INTERVIEW' | 'DEADLINE' | 'FOLLOW_UP' | 'OTHER';
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  title: string;
  jobId: number | null;
  jobTitle: string | null;
  companyId: number | null;
  companyName: string | null;
  contactId: number | null;
  contactName: string | null;
  location: string | null;
  notes: string | null;
  outcome: 'NONE' | 'DONE' | 'CANCELLED' | 'NO_SHOW';
}

/**
 * What each of a day's three numbers counted, so a link opens exactly those rows — as the calendar's answer states it.
 * masi owns these groupings; nothing here keeps a second copy of them.
 */
export interface MasiDayKinds {
  sent: string[];
  collected: string[];
  communicated: string[];
}

export const MASI_EVENT_KINDS = ['CALL', 'INTERVIEW', 'FOLLOW_UP', 'DEADLINE', 'OTHER'] as const;
export const MASI_EVENT_OUTCOMES = ['NONE', 'DONE', 'CANCELLED', 'NO_SHOW'] as const;

/** A posting's own deadline, shown on the calendar without an event row: nobody books it, the board set it. */
export interface MasiDeadline {
  jobId: number;
  title: string;
  companyName: string | null;
  expiresAt: string;
}

/** What a range of days holds: the operator's events, the postings closing, and the numbers of each day. */
export interface MasiCalendar {
  days: MasiDayCounts[];
  events: MasiCalendarEvent[];
  deadlines: MasiDeadline[];
  dayKinds: MasiDayKinds;
}

/** `from`..`to` are calendar days (YYYY-MM-DD) in masi's zone, both ends inclusive. */
export function fetchMasiCalendar(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<MasiCalendar> {
  return masiGet(`/calendar${query({ from, to })}`, signal, 'load the calendar');
}

/** What a caller may set on an event; the backend fills the rest. */
export interface MasiCalendarEventInput {
  kind: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  title: string;
  jobId?: number;
  companyId?: number;
  contactId?: number;
  location?: string;
  notes?: string;
  outcome?: string;
}

export function createMasiCalendarEvent(event: MasiCalendarEventInput): Promise<MasiCalendarEvent> {
  return masiSend('/calendar', 'POST', event, 'save the event');
}

export function updateMasiCalendarEvent(
  id: number,
  patch: Partial<MasiCalendarEventInput>,
): Promise<MasiCalendarEvent> {
  return masiSend(`/calendar/${id}`, 'PATCH', patch, 'save the event');
}

/** A job's own bookings, oldest first: what is arranged about this position. */
export function fetchMasiJobBookings(
  jobId: number,
  signal?: AbortSignal,
): Promise<MasiCalendarEvent[]> {
  return masiGet(`/calendar/job/${jobId}`, signal, 'load the bookings');
}

export function deleteMasiCalendarEvent(id: number): Promise<void> {
  return masiSend(`/calendar/${id}`, 'DELETE', undefined, 'delete the event');
}

export function fetchMasiActivityDays(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<MasiDayCounts[]> {
  return masiGet(`/activity/days${query({ from, to })}`, signal, 'load the day counts');
}

/** Open jobs of the same company that read like this one: a hint, never a merge. */
export function fetchMasiSimilarJobs(id: number, signal?: AbortSignal): Promise<MasiSimilarJob[]> {
  return masiGet(`/jobs/${id}/similar`, signal, 'load similar jobs');
}

export function saveMasiJobNote(id: number, userNote: string): Promise<MasiJob> {
  return masiSend(`/jobs/${id}`, 'PATCH', { userNote }, 'save the note');
}

export function fetchMasiCompanies(
  filter: { q?: string; status?: string; hiring?: boolean; page?: number; size?: number },
  signal?: AbortSignal,
): Promise<Paged<MasiCompany>> {
  return masiGet(`/companies${query({ ...filter })}`, signal, 'load companies');
}

export function fetchMasiCompany(id: number, signal?: AbortSignal): Promise<MasiCompany> {
  return masiGet(`/companies/${id}`, signal, 'load the company');
}

export function patchMasiCompany(
  id: number,
  patch: {
    userNote?: string;
    blacklisted?: boolean;
    userRating?: number;
    careersUrl?: string;
    agency?: boolean;
    agencyFromRegister?: boolean;
  },
): Promise<MasiCompany> {
  return masiSend(`/companies/${id}`, 'PATCH', patch, 'save the company');
}

/** The registered companies this employer might be; with a code, the one company the register has under it, or none. */
export function fetchMasiRegisterCandidates(
  id: number,
  signal?: AbortSignal,
  code?: string,
): Promise<MasiRegisterCandidates> {
  return masiGet(
    `/companies/${id}/register-candidates${query({ code })}`,
    signal,
    'look in the register',
  );
}

/** The company's own rows — its desks and addresses among them, which are nobody's person. */
export function fetchMasiCompanyContacts(
  id: number,
  signal?: AbortSignal,
): Promise<Paged<MasiContact>> {
  return masiGet(`/companies/${id}/contacts?size=200`, signal, 'load the addresses');
}

export function patchMasiContact(
  id: number,
  patch: { doNotContact?: boolean; userNote?: string },
): Promise<MasiContact> {
  return masiSend(`/contacts/${id}`, 'PATCH', patch, 'save the address');
}

/** The company's placement on the register, or null (204) when none was made: a code from the register import itself. */
export async function fetchMasiRegisterPlacement(
  id: number,
  signal?: AbortSignal,
): Promise<MasiRegisterPlacement | null> {
  const response = await apiFetch(`${API_BASE}/masi/companies/${id}/register-match`, { signal });
  if (response.status === 204) return null;
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to load the placement');
  }
  return readJson<MasiRegisterPlacement>(response);
}

/** The operator's word: this employer is the registered company with that code. */
export function placeMasiCompany(id: number, registryCode: string): Promise<MasiCompany> {
  return masiSend(`/companies/${id}/register-match`, 'POST', { registryCode }, 'place the company');
}

export function takeBackMasiPlacement(id: number): Promise<MasiCompany> {
  return masiSend(
    `/companies/${id}/register-match`,
    'DELETE',
    undefined,
    'take the placement back',
  );
}

export function fetchMasiPersons(
  filter: { q?: string; company?: number; agency?: boolean; page?: number; size?: number },
  signal?: AbortSignal,
): Promise<Paged<MasiPerson>> {
  return masiGet(`/persons${query({ ...filter })}`, signal, 'load people');
}

export function fetchMasiPerson(id: number, signal?: AbortSignal): Promise<MasiPerson> {
  return masiGet(`/persons/${id}`, signal, 'load the person');
}

/** The people tied to one company: who posted for it, who represents it, who was spoken to. */
export function fetchMasiCompanyPersons(id: number, signal?: AbortSignal): Promise<MasiPerson[]> {
  return masiGet(`/persons/of-company/${id}`, signal, 'load the people');
}

export function patchMasiPerson(
  id: number,
  patch: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    doNotContact?: boolean;
    userNote?: string;
  },
): Promise<MasiPerson> {
  return masiSend(`/persons/${id}`, 'PATCH', patch, 'save the person');
}

export function fetchMasiSources(signal?: AbortSignal): Promise<MasiSource[]> {
  return masiGet('/sources', signal, 'load sources');
}

export function patchMasiSource(
  id: number,
  patch: { cron?: string; enabled?: boolean; configJson?: string },
): Promise<MasiSource> {
  return masiSend(`/sources/${id}`, 'PATCH', patch, 'save the source');
}

export function runMasiSource(id: number): Promise<void> {
  return masiSend(`/sources/${id}/run`, 'POST', undefined, 'start the run');
}

export function fetchMasiSourceRuns(
  id: number,
  signal?: AbortSignal,
): Promise<Paged<MasiSourceRun>> {
  return masiGet(`/sources/${id}/runs?size=20`, signal, 'load runs');
}

export function fetchMasiPackages(
  filter: { status?: string; job?: number },
  signal?: AbortSignal,
): Promise<MasiPackage[]> {
  return masiGet(`/packages${query({ ...filter })}`, signal, 'load packages');
}

export function fetchMasiPackage(id: number, signal?: AbortSignal): Promise<MasiPackage> {
  return masiGet(`/packages/${id}`, signal, 'load the package');
}

/** A package language: a language masi writes, or 'auto' to follow the posting. */
export type MasiPackageLanguage = 'auto' | 'en' | 'et';

export function requestMasiPackage(jobId: number, language?: MasiPackageLanguage): Promise<MasiPackage> {
  const asked = language === undefined || language === 'auto' ? undefined : language;
  return masiSend(`/jobs/${jobId}/packages${query({ language: asked })}`, 'POST', undefined, 'prepare the package');
}

export function reviewMasiPackage(
  id: number,
  action: 'REVIEWED' | 'APPLIED' | 'SKIPPED',
  notes?: string,
  response?: string,
): Promise<MasiPackage> {
  return masiSend(
    `/packages/${id}/review`,
    'POST',
    { action, notes, response },
    'review the package',
  );
}

/** Regenerates; a language changes the package's (and 'auto' hands it back to the posting), none keeps it. */
export function regenerateMasiPackage(id: number, language?: MasiPackageLanguage): Promise<MasiPackage> {
  return masiSend(`/packages/${id}/regenerate${query({ language })}`, 'POST', undefined, 'regenerate the package');
}

export function fetchMasiRetuneEstimate(
  signal?: AbortSignal,
): Promise<{ count: number; estimatedUsd: number }> {
  return masiGet('/packages/retune', signal, 'estimate the re-tune');
}

export function retuneMasi(): Promise<{ count: number; estimatedUsd: number }> {
  return masiSend('/packages/retune', 'POST', undefined, 're-tune');
}

/** The artifact is a file the browser opens itself; the token rides in a header, so fetch it as a blob. */
export async function fetchMasiArtifact(id: number, kind: 'CV_PDF' | 'LETTER_TXT'): Promise<Blob> {
  const response = await apiFetch(
    `${API_BASE}/masi/packages/${id}/artifacts/${kind.toLowerCase()}`,
  );
  if (!response.ok) throw new Error('Failed to fetch the artifact');
  return response.blob();
}

/** A period's figures, every one from a timestamp later ticks never rewrite; the funnel is the caller's own. */
export interface MasiStats {
  from: string;
  to: string;
  registry: {
    newJobs: number;
    closedJobs: number;
    /** Closed jobs that came back in the period: neither new nor closed in it. */
    repostedJobs: number;
    newListings: number;
    closedListings: number;
    medianListingLifetimeHours: number | null;
  };
  sources: Array<{
    key: string;
    name: string;
    newListings: number;
    closedListings: number;
    runs: Record<string, number>;
  }>;
  topCompanies: Array<{ id: number; name: string | null; newJobs: number }>;
  titles: Array<{ value: string; count: number }>;
  seniority: Record<string, number>;
  remote: Record<string, number>;
  techTags: Record<string, number>;
  salary: {
    posted: number;
    lowest: number | null;
    medianMin: number | null;
    medianMax: number | null;
    highest: number | null;
  };
  funnel: { requested: number; applied: number; averagePackageCostUsd: number | null };
  llm: {
    totalUsd: number;
    byPurpose: Record<string, number>;
    byModel: Record<string, number>;
    calls: Record<string, number>;
    tokens: { input: number; cacheRead: number; cacheWrite: number; output: number };
  };
}

export interface MasiReportSummary {
  id: number;
  kind: 'WEEKLY' | 'MONTHLY';
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
}

/** A stored report: the period's stats plus what the registry looked like when it was written. */
export interface MasiReport extends MasiReportSummary {
  stats: MasiStats;
  snapshot: {
    asOf: string;
    openJobs: number;
    companiesHiring: number;
    sourceHealth: Record<string, string>;
    packagesNow: Record<string, number>;
  };
}

/** Calendar days in the registry's zone, both ends inclusive. */
export function fetchMasiStats(from: string, to: string, signal?: AbortSignal): Promise<MasiStats> {
  return masiGet(`/stats${query({ from, to })}`, signal, 'load stats');
}

export function fetchMasiReports(
  kind?: 'WEEKLY' | 'MONTHLY',
  signal?: AbortSignal,
): Promise<MasiReportSummary[]> {
  return masiGet(`/reports${query({ kind })}`, signal, 'load reports');
}

export function fetchMasiReport(id: number, signal?: AbortSignal): Promise<MasiReport> {
  return masiGet(`/reports/${id}`, signal, 'load the report');
}

/** "Mail me this report": the weekly digest of a stored report, now, to the caller. The answer has no body. */
export async function mailMasiReportDigest(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/masi/reports/${id}/digest`, { method: 'POST' });
  if (!response.ok) {
    const data = await readErrorBody(response);
    throw new Error(data.error || 'Failed to mail the digest');
  }
}

/** Writes (or returns) the report for the period containing `day`; without a day, the last complete one. */
export function generateMasiReport(kind: 'WEEKLY' | 'MONTHLY', day?: string): Promise<MasiReport> {
  return masiSend('/reports/generate', 'POST', { kind, day }, 'generate the report');
}
