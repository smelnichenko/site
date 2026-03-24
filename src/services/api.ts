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
  signal?: AbortSignal
): Promise<PagedResponse<ReceivedEmail>> {
  const response = await apiFetch(`${API_BASE}/inbox/emails?page=${page}&size=${size}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch emails');
  return response.json();
}

export async function fetchInboxEmail(id: number, signal?: AbortSignal): Promise<ReceivedEmail> {
  const response = await apiFetch(`${API_BASE}/inbox/emails/${id}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch email');
  return response.json();
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
  signal?: AbortSignal
): Promise<EmailAttachment[]> {
  const response = await apiFetch(`${API_BASE}/inbox/emails/${emailId}/attachments`, { signal });
  if (!response.ok) throw new Error('Failed to fetch attachments');
  return response.json();
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
  return response.json();
}

export async function createChatChannel(name: string, encrypted?: boolean): Promise<ChatChannel> {
  const response = await apiFetch(`${API_BASE}/chat/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, encrypted }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create channel');
  }
  return response.json();
}

export async function leaveChatChannel(channelId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/leave`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to leave channel');
}

export async function deleteChatChannel(channelId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete channel');
}

export async function fetchChatMessages(
  channelId: number,
  limit = 50,
  signal?: AbortSignal
): Promise<ChatMessage[]> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages?limit=${limit}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}

export async function sendChatMessage(
  channelId: number,
  content: string,
  parentMessageId?: string,
  keyVersion?: number
): Promise<ChatMessage> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, parentMessageId, keyVersion }),
  });
  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
}

export async function markChannelRead(channelId: number): Promise<void> {
  await apiFetch(`${API_BASE}/chat/channels/${channelId}/read`, { method: 'POST' });
}

export async function editChatMessage(channelId: number, messageId: string, content: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages/${messageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to edit message');
  }
}

export async function fetchMessageEdits(channelId: number, messageId: string, signal?: AbortSignal): Promise<MessageEdit[]> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages/${messageId}/edits`, { signal });
  if (!response.ok) throw new Error('Failed to fetch edits');
  return response.json();
}

export async function verifyChannelChain(channelId: number, signal?: AbortSignal): Promise<ChainVerification> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/verify`, { signal });
  if (!response.ok) throw new Error('Failed to verify chain');
  return response.json();
}

export async function fetchChatUsers(signal?: AbortSignal): Promise<ChatUser[]> {
  const response = await apiFetch(`${API_BASE}/chat/users`, { signal });
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export async function inviteToChannel(channelId: number, userUuid: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userUuid }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to invite user');
  }
}

export interface ChannelMember {
  id: number;
  uuid: string;
  email: string;
  joinedAt: string;
}

export async function fetchChannelMembers(channelId: number, signal?: AbortSignal): Promise<ChannelMember[]> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/members`, { signal });
  if (!response.ok) throw new Error('Failed to fetch members');
  return response.json();
}

export async function kickFromChannel(channelId: number, userUuid: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userUuid }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
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
  return response.json();
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
  return response.json();
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

export async function fetchPublicKeys(userUuids: string[], signal?: AbortSignal): Promise<PublicKeyInfo[]> {
  const params = userUuids.map(id => `userUuids=${id}`).join('&');
  const response = await apiFetch(`${API_BASE}/chat/keys/public?${params}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch public keys');
  return response.json();
}

export async function fetchChannelKeys(
  channelId: number,
  keyVersion?: number,
  signal?: AbortSignal
): Promise<ChannelKeyBundleResponse[]> {
  const params = keyVersion == null ? '' : `?keyVersion=${keyVersion}`;
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys${params}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch channel keys');
  return response.json();
}

export async function setChannelKeys(
  channelId: number,
  bundles: MemberKeyBundle[]
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundles }),
  });
  if (!response.ok) throw new Error('Failed to set channel keys');
}

export async function rotateChannelKeys(
  channelId: number,
  bundles: MemberKeyBundle[]
): Promise<{ newKeyVersion: number }> {
  const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/keys/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundles }),
  });
  if (!response.ok) throw new Error('Failed to rotate channel keys');
  return response.json();
}

// Chess API

export interface ChessGameDto {
  gameUuid: string;
  fen: string;
  pgn: string | null;
  status: 'WAITING_FOR_OPPONENT' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  result: 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW' | null;
  resultReason: 'CHECKMATE' | 'RESIGNATION' | 'STALEMATE' | 'AGREEMENT' | 'INSUFFICIENT_MATERIAL' | null;
  gameType: 'AI' | 'PVP';
  moveCount: number;
  lastMove: string | null;
  whitePlayerUuid: string;
  blackPlayerUuid: string | null;
  drawOfferedByUuid: string | null;
  aiDifficulty: number | null;
  updatedAt: string;
}

export async function createChessGame(type: 'AI' | 'PVP', difficulty?: number): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, difficulty }),
  });
  if (!response.ok) throw new Error('Failed to create game');
  return response.json();
}

export async function fetchChessGame(uuid: string, signal?: AbortSignal): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch game');
  return response.json();
}

export async function fetchActiveChessGames(signal?: AbortSignal): Promise<ChessGameDto[]> {
  const response = await apiFetch(`${API_BASE}/chess/games`, { signal });
  if (!response.ok) throw new Error('Failed to fetch games');
  return response.json();
}

export async function fetchOpenChessGames(signal?: AbortSignal): Promise<ChessGameDto[]> {
  const response = await apiFetch(`${API_BASE}/chess/games/open`, { signal });
  if (!response.ok) throw new Error('Failed to fetch open games');
  return response.json();
}

export async function fetchChessHistory(
  page = 0,
  size = 20,
  signal?: AbortSignal
): Promise<PagedResponse<ChessGameDto>> {
  const response = await apiFetch(`${API_BASE}/chess/games/history?page=${page}&size=${size}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

export async function joinChessGame(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/join`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to join game');
  return response.json();
}

export async function makeChessMove(uuid: string, move: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid move');
  }
  return response.json();
}

export async function makeChessAiMove(uuid: string, move: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/ai-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid AI move');
  }
  return response.json();
}

export async function resignChessGame(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/resign`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to resign');
  return response.json();
}

export async function offerChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to offer draw');
  return response.json();
}

export async function acceptChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw/accept`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to accept draw');
  return response.json();
}

export async function declineChessDraw(uuid: string): Promise<ChessGameDto> {
  const response = await apiFetch(`${API_BASE}/chess/games/${uuid}/draw/decline`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to decline draw');
  return response.json();
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
  return response.json();
}

export async function setUserEnabled(userUuid: string, enabled: boolean): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userUuid}/enabled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update groups');
  }
}

export async function fetchAdminGroups(signal?: AbortSignal): Promise<AppGroup[]> {
  const response = await apiFetch(`${API_BASE}/admin/groups`, { signal });
  return response.json();
}

export async function createGroup(name: string, description: string, permissions: string[]): Promise<AppGroup> {
  const response = await apiFetch(`${API_BASE}/admin/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create group');
  }
  return response.json();
}

export async function updateGroup(id: number, name: string, description: string, permissions: string[]): Promise<AppGroup> {
  const response = await apiFetch(`${API_BASE}/admin/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update group');
  }
  return response.json();
}

export async function deleteGroup(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/groups/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
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
  return response.json();
}

export async function fetchApprovalMode(): Promise<{ mode: string }> {
  const response = await fetch(`${API_BASE}/auth/approval-mode`);
  if (!response.ok) throw new Error('Failed to fetch approval mode');
  return response.json();
}

export async function fetchPendingApprovals(signal?: AbortSignal): Promise<PendingApprovalItem[]> {
  const response = await apiFetch(`${API_BASE}/admin/approvals`, { signal });
  if (!response.ok) throw new Error('Failed to fetch pending approvals');
  return response.json();
}

export async function approveRegistration(id: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/approvals/${id}/approve`, { method: 'POST' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to decline');
  }
}
