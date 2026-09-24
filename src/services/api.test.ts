import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';

// Mock oidcClient before importing api
vi.mock('./oidcClient', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  login: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to create mock Response objects
function mockResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => init.headers?.[name] ?? null,
    },
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  // Reset location
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

describe('api - fetchPages', () => {
  it('calls /api/monitor/pages and returns page list', async () => {
    const { fetchPages } = await import('./api');
    const pages = ['page1', 'page2'];
    mockFetch.mockResolvedValueOnce(mockResponse(pages));

    const result = await fetchPages();
    expect(result).toEqual(pages);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/pages',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }) as Record<
          string,
          string
        >,
      }),
    );
  });

  it('throws on non-ok response', async () => {
    const { fetchPages } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 500 }));
    await expect(fetchPages()).rejects.toThrow('Failed to fetch pages');
  });
});

describe('api - fetchLatestResult', () => {
  it('returns null for 404', async () => {
    const { fetchLatestResult } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }));
    const result = await fetchLatestResult('test');
    expect(result).toBeNull();
  });
});

describe('api - apiFetch internals (tested via exported functions)', () => {
  it('includes Bearer token in requests', async () => {
    const { fetchPages } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await fetchPages();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }) as Record<
          string,
          string
        >,
      }),
    );
  });

  it('throws on 401 response without redirecting', async () => {
    const { fetchPages } = await import('./api');
    const { login } = await import('./oidcClient');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 401 }));
    await expect(fetchPages()).rejects.toThrow('Unauthorized');
    expect(login).not.toHaveBeenCalled();
  });

  it('does not include credentials: include (no cookies)', async () => {
    const { fetchPages } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await fetchPages();
    const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(callOptions.credentials).toBeUndefined();
  });
});

describe('api - CRUD functions', () => {
  it('createPageMonitor sends POST with JSON body', async () => {
    const { createPageMonitor } = await import('./api');
    const request = {
      name: 'Test',
      url: 'http://test.com',
      pattern: String.raw`\d+`,
      cron: '0 * * * * *',
      enabled: true,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...request }));
    const result = await createPageMonitor(request);
    expect(result.id).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      }),
    );
  });

  it('createPageMonitor throws error message from response body', async () => {
    const { createPageMonitor } = await import('./api');
    const request = {
      name: 'Test',
      url: 'http://test.com',
      pattern: String.raw`\d+`,
      cron: '0 * * * * *',
      enabled: true,
    };
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Name already exists' }, { status: 400 }),
    );
    await expect(createPageMonitor(request)).rejects.toThrow('Name already exists');
  });

  it('deletePageMonitor sends DELETE', async () => {
    const { deletePageMonitor } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 204 }));
    // 204 is not ok (our mock), let's use 200
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await deletePageMonitor(5);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config/5',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('api - RSS functions', () => {
  it('fetchRssFeeds returns feed list', async () => {
    const { fetchRssFeeds } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(['feed1', 'feed2']));
    const result = await fetchRssFeeds();
    expect(result).toEqual(['feed1', 'feed2']);
  });

  it('triggerRssCheck sends POST', async () => {
    const { triggerRssCheck } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, feedName: 'test' }));
    await triggerRssCheck('test-feed');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/check/test-feed',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('generateRssCollections sends POST and extracts collections', async () => {
    const { generateRssCollections } = await import('./api');
    const collections = [{ name: 'Tech', metrics: [{ name: 'AI', keywords: ['ai', 'ml'] }] }];
    mockFetch.mockResolvedValueOnce(mockResponse({ collections }));
    const result = await generateRssCollections({
      url: 'http://feed.com/rss',
      prompt: 'tech topics',
    });
    expect(result).toEqual(collections);
  });
});

describe('api - fetchResults', () => {
  it('uses pageName in URL when provided', async () => {
    const { fetchResults } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ content: [], totalPages: 0 }));
    await fetchResults('my-page', 0, 50);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/results/my-page?page=0&size=50',
      expect.any(Object),
    );
  });

  it('omits pageName from URL when not provided', async () => {
    const { fetchResults } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ content: [], totalPages: 0 }));
    await fetchResults(undefined, 0, 100);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/results?page=0&size=100',
      expect.any(Object),
    );
  });
});

describe('api - page monitor CRUD extended', () => {
  it('updatePageMonitor sends PUT', async () => {
    const { updatePageMonitor } = await import('./api');
    const req = {
      name: 'Updated',
      url: 'http://x.com',
      pattern: String.raw`\d+`,
      cron: '0 0 * * * *',
      enabled: true,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }));
    await updatePageMonitor(1, req);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('fetchPageMonitorConfigs returns configs', async () => {
    const { fetchPageMonitorConfigs } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'test' }]));
    const result = await fetchPageMonitorConfigs();
    expect(result).toEqual([{ id: 1, name: 'test' }]);
  });

  it('fetchPageConfig returns page configs', async () => {
    const { fetchPageConfig } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ name: 'p1' }]));
    const result = await fetchPageConfig();
    expect(result).toEqual([{ name: 'p1' }]);
  });

  it('fetchPageStats returns stats', async () => {
    const { fetchPageStats } = await import('./api');
    const stats = { pageName: 'test', last24Hours: { total: 10, matches: 8, noMatches: 2 } };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));
    const result = await fetchPageStats('test');
    expect(result).toEqual(stats);
  });
});

describe('api - RSS feed monitor CRUD', () => {
  it('fetchRssFeedMonitorConfigs returns configs', async () => {
    const { fetchRssFeedMonitorConfigs } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'feed' }]));
    const result = await fetchRssFeedMonitorConfigs();
    expect(result).toEqual([{ id: 1, name: 'feed' }]);
  });

  it('createRssFeedMonitor sends POST', async () => {
    const { createRssFeedMonitor } = await import('./api');
    const req = {
      name: 'f',
      url: 'http://x.com',
      cron: '0 0 * * * *',
      fetchContent: false,
      maxArticles: 30,
      enabled: true,
      collections: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }));
    await createRssFeedMonitor(req);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createRssFeedMonitor throws with error message', async () => {
    const { createRssFeedMonitor } = await import('./api');
    const req = {
      name: 'f',
      url: 'http://x.com',
      cron: '0 0 * * * *',
      fetchContent: false,
      maxArticles: 30,
      enabled: true,
      collections: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Duplicate' }, { status: 400 }));
    await expect(createRssFeedMonitor(req)).rejects.toThrow('Duplicate');
  });

  it('updateRssFeedMonitor sends PUT', async () => {
    const { updateRssFeedMonitor } = await import('./api');
    const req = {
      name: 'f',
      url: 'http://x.com',
      cron: '0 0 * * * *',
      fetchContent: false,
      maxArticles: 30,
      enabled: true,
      collections: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }));
    await updateRssFeedMonitor(1, req);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('deleteRssFeedMonitor sends DELETE', async () => {
    const { deleteRssFeedMonitor } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await deleteRssFeedMonitor(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('fetchRssConfig returns configs', async () => {
    const { fetchRssConfig } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ name: 'feed1' }]));
    const result = await fetchRssConfig();
    expect(result).toEqual([{ name: 'feed1' }]);
  });

  it('fetchRssResults returns paged results', async () => {
    const { fetchRssResults } = await import('./api');
    const paged = { content: [], totalElements: 0 };
    mockFetch.mockResolvedValueOnce(mockResponse(paged));
    const result = await fetchRssResults('feed1', 0, 100);
    expect(result).toEqual(paged);
  });

  it('fetchRssLatestResult returns null on 404', async () => {
    const { fetchRssLatestResult } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }));
    const result = await fetchRssLatestResult('feed1');
    expect(result).toBeNull();
  });

  it('fetchRssChartData returns chart data', async () => {
    const { fetchRssChartData } = await import('./api');
    const chartData = { col1: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(chartData));
    const result = await fetchRssChartData('feed1', 50);
    expect(result).toEqual(chartData);
  });
});

describe('api - game', () => {
  it('fetchGameState returns state', async () => {
    const { fetchGameState } = await import('./api');
    const state = { id: 1, player1Position: 0 };
    mockFetch.mockResolvedValueOnce(mockResponse(state));
    const result = await fetchGameState();
    expect(result).toEqual(state);
  });

  it('spinGame sends POST', async () => {
    const { spinGame } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ colors: ['red'] }));
    await spinGame();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/game/spin',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('spinGame throws with error message', async () => {
    const { spinGame } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not your turn' }, { status: 400 }));
    await expect(spinGame()).rejects.toThrow('Not your turn');
  });

  it('resetGame sends POST', async () => {
    const { resetGame } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));
    await resetGame();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/game/reset',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('api - user preferences', () => {
  it('saveLastPath sends PUT', async () => {
    const { saveLastPath } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await saveLastPath('/dashboard');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/last-path',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('api - inbox', () => {
  it('fetchInboxEmails returns paged emails', async () => {
    const { fetchInboxEmails } = await import('./api');
    const paged = { content: [{ id: 1 }], totalElements: 1 };
    mockFetch.mockResolvedValueOnce(mockResponse(paged));
    const result = await fetchInboxEmails(0, 20);
    expect(result).toEqual(paged);
  });

  it('fetchInboxEmail returns single email', async () => {
    const { fetchInboxEmail } = await import('./api');
    const email = { id: 1, subject: 'test' };
    mockFetch.mockResolvedValueOnce(mockResponse(email));
    const result = await fetchInboxEmail(1);
    expect(result).toEqual(email);
  });

  it('fetchEmailAttachments returns attachments', async () => {
    const { fetchEmailAttachments } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, filename: 'doc.pdf' }]));
    const result = await fetchEmailAttachments(1);
    expect(result).toEqual([{ id: 1, filename: 'doc.pdf' }]);
  });

  it('getAttachmentDownloadUrl returns correct URL', async () => {
    const { getAttachmentDownloadUrl } = await import('./api');
    expect(getAttachmentDownloadUrl(1, 2)).toBe('/api/inbox/emails/1/attachments/2');
  });
});

describe('api - chat', () => {
  it('fetchChatChannels returns channels', async () => {
    const { fetchChatChannels } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'general' }]));
    const result = await fetchChatChannels();
    expect(result).toEqual([{ id: 1, name: 'general' }]);
  });

  it('createChatChannel sends POST', async () => {
    const { createChatChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'test' }));
    await createChatChannel('test', true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createChatChannel throws with error', async () => {
    const { createChatChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Name taken' }, { status: 400 }));
    await expect(createChatChannel('test')).rejects.toThrow('Name taken');
  });

  it('leaveChatChannel sends POST', async () => {
    const { leaveChatChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await leaveChatChannel(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/leave',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deleteChatChannel sends DELETE', async () => {
    const { deleteChatChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await deleteChatChannel(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('fetchChatMessages returns messages', async () => {
    const { fetchChatMessages } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ messageId: 'abc' }]));
    const result = await fetchChatMessages(1, 50);
    expect(result).toEqual([{ messageId: 'abc' }]);
  });

  it('sendChatMessage sends POST', async () => {
    const { sendChatMessage } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ messageId: 'abc' }));
    await sendChatMessage(1, 'hello', undefined, 1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('markChannelRead sends POST', async () => {
    const { markChannelRead } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await markChannelRead(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/read',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('editChatMessage sends PUT', async () => {
    const { editChatMessage } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await editChatMessage(1, 'msg-1', 'updated');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/messages/msg-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('editChatMessage throws with error', async () => {
    const { editChatMessage } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Too late' }, { status: 400 }));
    await expect(editChatMessage(1, 'msg-1', 'x')).rejects.toThrow('Too late');
  });

  it('fetchMessageEdits returns edits', async () => {
    const { fetchMessageEdits } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ editId: 'e1' }]));
    const result = await fetchMessageEdits(1, 'msg-1');
    expect(result).toEqual([{ editId: 'e1' }]);
  });

  it('verifyChannelChain returns verification', async () => {
    const { verifyChannelChain } = await import('./api');
    const v = { messageCount: 10, validCount: 10, intact: true };
    mockFetch.mockResolvedValueOnce(mockResponse(v));
    const result = await verifyChannelChain(1);
    expect(result).toEqual(v);
  });

  it('fetchChatUsers returns users', async () => {
    const { fetchChatUsers } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1 }]));
    const result = await fetchChatUsers();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('inviteToChannel sends POST', async () => {
    const { inviteToChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await inviteToChannel(1, 'uuid-2');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/invite',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('inviteToChannel throws with error', async () => {
    const { inviteToChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Already member' }, { status: 400 }));
    await expect(inviteToChannel(1, 'uuid-2')).rejects.toThrow('Already member');
  });

  it('fetchChannelMembers returns members', async () => {
    const { fetchChannelMembers } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, email: 'a@b.com' }]));
    const result = await fetchChannelMembers(1);
    expect(result).toEqual([{ id: 1, email: 'a@b.com' }]);
  });

  it('kickFromChannel sends POST', async () => {
    const { kickFromChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await kickFromChannel(1, 'uuid-2');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/kick',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('kickFromChannel throws with error', async () => {
    const { kickFromChannel } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot kick owner' }, { status: 400 }));
    await expect(kickFromChannel(1, 'uuid-2')).rejects.toThrow('Cannot kick owner');
  });
});

describe('api - E2E encryption keys', () => {
  it('fetchUserKeys returns null on 404', async () => {
    const { fetchUserKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }));
    const result = await fetchUserKeys();
    expect(result).toBeNull();
  });

  it('fetchUserKeys returns keys', async () => {
    const { fetchUserKeys } = await import('./api');
    const keys = { publicKey: 'pk', encryptedPrivateKey: 'epk' };
    mockFetch.mockResolvedValueOnce(mockResponse(keys));
    const result = await fetchUserKeys();
    expect(result).toEqual(keys);
  });

  it('uploadUserKeys sends POST', async () => {
    const { uploadUserKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ publicKey: 'pk' }));
    await uploadUserKeys({
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      pbkdf2Salt: 'salt',
      pbkdf2Iterations: 600000,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/keys',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateUserKeys sends PUT', async () => {
    const { updateUserKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await updateUserKeys({
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      pbkdf2Salt: 'salt',
      pbkdf2Iterations: 600000,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/keys',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('fetchPublicKeys builds query params', async () => {
    const { fetchPublicKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await fetchPublicKeys(['uuid-1', 'uuid-2']);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/keys/public?userUuids=uuid-1&userUuids=uuid-2',
      expect.any(Object),
    );
  });

  it('fetchChannelKeys with version param', async () => {
    const { fetchChannelKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await fetchChannelKeys(1, 2);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/keys?keyVersion=2',
      expect.any(Object),
    );
  });

  it('fetchChannelKeys without version param', async () => {
    const { fetchChannelKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await fetchChannelKeys(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/keys', expect.any(Object));
  });

  it('setChannelKeys sends POST', async () => {
    const { setChannelKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await setChannelKeys(1, [
      { userUuid: 'uuid-1', encryptedChannelKey: 'eck', wrapperPublicKey: 'wpk' },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels/1/keys',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rotateChannelKeys sends POST and returns version', async () => {
    const { rotateChannelKeys } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ newKeyVersion: 2 }));
    const result = await rotateChannelKeys(1, []);
    expect(result).toEqual({ newKeyVersion: 2 });
  });
});

describe('api - test endpoints', () => {
  it('testPageMonitor sends POST', async () => {
    const { testPageMonitor } = await import('./api');
    const req = {
      name: 'test',
      url: 'http://x.com',
      pattern: String.raw`\d+`,
      cron: '0 0 * * * *',
      enabled: true,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));
    await testPageMonitor(req);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('testRssFeedMonitor sends POST', async () => {
    const { testRssFeedMonitor } = await import('./api');
    const req = {
      name: 'f',
      url: 'http://x.com',
      cron: '0 0 * * * *',
      fetchContent: false,
      maxArticles: 30,
      enabled: true,
      collections: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));
    await testRssFeedMonitor(req);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('api - admin', () => {
  it('fetchAdminUsers returns users', async () => {
    const { fetchAdminUsers } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, email: 'admin@test.com' }]));
    const result = await fetchAdminUsers();
    expect(result).toEqual([{ id: 1, email: 'admin@test.com' }]);
  });

  it('setUserEnabled sends PUT', async () => {
    const { setUserEnabled } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await setUserEnabled('uuid-1', false);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/users/uuid-1/enabled',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('setUserEnabled throws with error', async () => {
    const { setUserEnabled } = await import('./api');
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Cannot disable self' }, { status: 400 }),
    );
    await expect(setUserEnabled('uuid-1', false)).rejects.toThrow('Cannot disable self');
  });

  it('setUserGroups sends PUT', async () => {
    const { setUserGroups } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await setUserGroups('uuid-1', [1, 2]);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/users/uuid-1/groups',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('setUserGroups throws with error', async () => {
    const { setUserGroups } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot remove self' }, { status: 400 }));
    await expect(setUserGroups('uuid-1', [])).rejects.toThrow('Cannot remove self');
  });

  it('fetchAdminGroups returns groups', async () => {
    const { fetchAdminGroups } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'Admins' }]));
    const result = await fetchAdminGroups();
    expect(result).toEqual([{ id: 1, name: 'Admins' }]);
  });

  it('createGroup sends POST', async () => {
    const { createGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 2, name: 'Editors' }));
    const result = await createGroup('Editors', 'Can edit', ['METRICS']);
    expect(result).toEqual({ id: 2, name: 'Editors' });
  });

  it('createGroup throws with error', async () => {
    const { createGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Name taken' }, { status: 400 }));
    await expect(createGroup('Admins', '', [])).rejects.toThrow('Name taken');
  });

  it('updateGroup sends PUT', async () => {
    const { updateGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'Updated' }));
    await updateGroup(1, 'Updated', 'desc', ['METRICS']);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/groups/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('updateGroup throws with error', async () => {
    const { updateGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, { status: 400 }));
    await expect(updateGroup(99, 'x', '', [])).rejects.toThrow('Not found');
  });

  it('deleteGroup sends DELETE', async () => {
    const { deleteGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(mockResponse(null));
    await deleteGroup(2);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/groups/2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('deleteGroup throws with error', async () => {
    const { deleteGroup } = await import('./api');
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Cannot delete Admins' }, { status: 400 }),
    );
    await expect(deleteGroup(1)).rejects.toThrow('Cannot delete Admins');
  });
});

describe('api - masi calendar', () => {
  it('asks for the calendar over inclusive days', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ days: [], events: [], deadlines: [] }));
    await api.fetchMasiCalendar('2026-08-31', '2026-10-11');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/masi/calendar?from=2026-08-31&to=2026-10-11');
  });

  /**
   * A delete answers 204 with NO body: Response.json() rejects on one. Before the 204 branch the caller read a
   * successful delete as "Failed to delete the event". The shared mockResponse helper resolves json() whatever the
   * status, so it cannot see this at all — the response here rejects, as a real one does.
   */
  it('reads a 204 delete as a success, though its empty body cannot be parsed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      headers: { get: () => null },
    });
    await expect(api.deleteMasiCalendarEvent(5)).resolves.toBeUndefined();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/masi/calendar/5');
    expect(init.method).toBe('DELETE');
  });

  it('books and changes an event', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 5 }));
    await api.createMasiCalendarEvent({
      kind: 'CALL',
      startsAt: '2026-09-22T11:00:00.000Z',
      title: 'Call',
    });
    const [createUrl, createInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(createUrl).toBe('/api/masi/calendar');
    expect(createInit.method).toBe('POST');
    expect(JSON.parse(createInit.body as string)).toEqual({
      kind: 'CALL',
      startsAt: '2026-09-22T11:00:00.000Z',
      title: 'Call',
    });
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 5 }));
    await api.updateMasiCalendarEvent(5, { outcome: 'DONE' });
    const [patchUrl, patchInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toBe('/api/masi/calendar/5');
    expect(patchInit.method).toBe('PATCH');
  });
});

describe('api - masi', () => {
  it('drops empty filter values and keeps false and zero', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ content: [], page: 0, size: 50, totalElements: 0 }),
    );
    await api.fetchMasiCompanies({ q: '', status: undefined, hiring: false, page: 0 });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/masi/companies?hiring=false&page=0');
    mockFetch.mockResolvedValueOnce(
      mockResponse({ content: [], page: 0, size: 50, totalElements: 0 }),
    );
    await api.fetchMasiJobs({ q: 'java', packageStatus: 'NONE' });
    expect(mockFetch.mock.calls[1][0]).toBe('/api/masi/jobs?q=java&packageStatus=NONE');
  });

  it('asks for stats over inclusive days, lists and reads reports, and generates one', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ from: 'x' }));
    await api.fetchMasiStats('2026-03-23', '2026-03-29');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/masi/stats?from=2026-03-23&to=2026-03-29');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await api.fetchMasiReports('WEEKLY');
    expect(mockFetch.mock.calls[1][0]).toBe('/api/masi/reports?kind=WEEKLY');
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await api.fetchMasiReports();
    expect(mockFetch.mock.calls[2][0]).toBe('/api/masi/reports');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 5 }));
    await api.fetchMasiReport(5);
    expect(mockFetch.mock.calls[3][0]).toBe('/api/masi/reports/5');
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 6 }));
    await api.generateMasiReport('MONTHLY', '2026-08-15');
    const [url, init] = mockFetch.mock.calls[4] as [string, RequestInit];
    expect(url).toBe('/api/masi/reports/generate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ kind: 'MONTHLY', day: '2026-08-15' });
    mockFetch.mockResolvedValueOnce(
      mockResponse(
        { error: 'the WEEKLY period containing 2026-09-19 has not ended yet' },
        { status: 400 },
      ),
    );
    await expect(api.generateMasiReport('WEEKLY', '2026-09-19')).rejects.toThrow(
      'has not ended yet',
    );
  });

  it('posts the review body as the backend reads it and surfaces the server error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 11, status: 'APPLIED' }));
    await api.reviewMasiPackage(11, 'APPLIED', 'notes', 'OFFER');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/masi/packages/11/review');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'APPLIED',
      notes: 'notes',
      response: 'OFFER',
    });
    mockFetch.mockResolvedValueOnce(
      mockResponse(
        { error: 'AI is disabled (masi.ai.enabled=false or no API key)' },
        { status: 409 },
      ),
    );
    await expect(api.requestMasiPackage(7)).rejects.toThrow(
      'AI is disabled (masi.ai.enabled=false or no API key)',
    );
    mockFetch.mockResolvedValueOnce(mockResponse({}, { status: 500 }));
    await expect(api.regenerateMasiPackage(7)).rejects.toThrow('Failed to regenerate the package');
    const [, plain] = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(plain.body).toBeUndefined();
  });

  it('CV translations: start, status (404 is none), review — URLs, bodies and server reasons', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ state: 'RUNNING' }, { status: 202 }));
    await api.startCvTranslation(1, 'et');
    const [startUrl, startInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(startUrl).toBe('/api/masi/cv/versions/1/translations');
    expect(startInit.method).toBe('POST');
    expect(JSON.parse(startInit.body as string)).toEqual({ language: 'et' });
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'a translation is already running' }, { status: 409 }),
    );
    await expect(api.startCvTranslation(1, 'et')).rejects.toThrow(
      'a translation is already running',
    );

    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }));
    await expect(api.fetchCvTranslationStatus()).resolves.toBeNull();
    expect(mockFetch.mock.calls[2][0]).toBe('/api/masi/cv/translation');
    mockFetch.mockResolvedValueOnce(mockResponse({}, { status: 500 }));
    await expect(api.fetchCvTranslationStatus()).rejects.toThrow(
      'Failed to fetch the translation status',
    );

    mockFetch.mockResolvedValueOnce(mockResponse({ version: 3 }));
    await api.reviewCvTranslation(3);
    const [reviewUrl, reviewInit] = mockFetch.mock.calls[4] as [string, RequestInit];
    expect(reviewUrl).toBe('/api/masi/cv/versions/3/review');
    expect(reviewInit.method).toBe('POST');
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'v3 has 1 parity problem' }, { status: 409 }),
    );
    await expect(api.reviewCvTranslation(3)).rejects.toThrow('v3 has 1 parity problem');
  });

  it('saves an edited translation with its source, and reads a 409 refusal as the error list', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ version: 3 }));
    await api.createCvVersion('a: 1', 'n', 1);
    expect(
      JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string),
    ).toEqual({
      yaml: 'a: 1',
      note: 'n',
      translatedFrom: 1,
    });
    // the body masi's GlobalExceptionHandler.handleParity sends with its 409: the message and every violation
    mockFetch.mockResolvedValueOnce(
      mockResponse(
        {
          error: 'v3 does not match v1',
          errors: ['/summary: "juhtisin" claims more than the source\'s wording'],
        },
        { status: 409 },
      ),
    );
    await expect(api.createCvVersion('a: 1', 'n', 1)).resolves.toEqual({
      version: null,
      errors: ['/summary: "juhtisin" claims more than the source\'s wording'],
    });
  });

  it("asks for a package's language: 'auto' is left out on request, sent on regenerate", async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 11 }));
    await api.requestMasiPackage(7, 'auto');
    await api.requestMasiPackage(7, 'et');
    await api.regenerateMasiPackage(11, 'auto');
    await api.regenerateMasiPackage(11, 'en');
    await api.regenerateMasiPackage(11);
    expect(mockFetch.mock.calls.map((c: unknown[]) => c[0] as string)).toEqual([
      '/api/masi/jobs/7/packages',
      '/api/masi/jobs/7/packages?language=et',
      '/api/masi/packages/11/regenerate?language=auto',
      '/api/masi/packages/11/regenerate?language=en',
      '/api/masi/packages/11/regenerate',
    ]);
  });

  it('fetches an artifact by its lower-cased kind as a blob', async () => {
    const blob = new Blob(['%PDF-'], { type: 'application/pdf' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    });
    expect(await api.fetchMasiArtifact(11, 'CV_PDF')).toBe(blob);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/masi/packages/11/artifacts/cv_pdf');
  });
});

/**
 * The people and register functions, run for real: every page test mocks this module, so a wrong URL, method or body
 * here — or a 204 read as JSON — would reach the operator with every page test green.
 */
describe('api - masi people and register', () => {
  const calls = () => mockFetch.mock.calls as Array<[string, RequestInit | undefined]>;
  const bodyOf = (call: number): unknown => JSON.parse(calls()[call][1]?.body as string) as unknown;

  it("reads a company's placement: the body, nothing for a 204, and the server's word for a failure", async () => {
    const placement = { registryCode: '14532901', placedAt: '2026-09-24T01:00:00Z' };
    mockFetch.mockResolvedValueOnce(mockResponse(placement));
    await expect(api.fetchMasiRegisterPlacement(82)).resolves.toEqual(placement);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/masi/companies/82/register-match');

    // a 204 has no body: reading it as JSON would throw, and every imported company would show an error
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      headers: { get: () => null },
    });
    await expect(api.fetchMasiRegisterPlacement(82)).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'company 82 not found' }, { status: 404 }),
    );
    await expect(api.fetchMasiRegisterPlacement(82)).rejects.toThrow('company 82 not found');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError('not json')),
      headers: { get: () => null },
    });
    await expect(api.fetchMasiRegisterPlacement(82)).rejects.toThrow(
      'Failed to load the placement',
    );
  });

  it("asks for one job's bookings where the server serves them, and says what failed", async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    await expect(api.fetchMasiJobBookings(7, controller.signal)).resolves.toEqual([]);
    expect(calls()[0][0]).toBe('/api/masi/calendar/job/7');
    expect(calls()[0][1]?.signal).toBe(controller.signal);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError('not json')),
      headers: { get: () => null },
    });
    await expect(api.fetchMasiJobBookings(7)).rejects.toThrow('Failed to load the bookings');
  });

  it('sends each people and register request where, how and with what the server expects', async () => {
    mockFetch.mockResolvedValue(mockResponse({}));
    await api.fetchMasiRegisterCandidates(82);
    await api.fetchMasiRegisterCandidates(82, undefined, '14532901');
    await api.placeMasiCompany(82, '14532901');
    await api.takeBackMasiPlacement(82);
    await api.fetchMasiPersons({ q: 'kask', company: 3, agency: true, page: 1, size: 50 });
    await api.fetchMasiPerson(20);
    await api.fetchMasiCompanyPersons(3);
    await api.patchMasiPerson(20, { doNotContact: true });
    await api.fetchMasiCompanyContacts(3);
    await api.patchMasiContact(91, { doNotContact: true });
    await api.patchMasiCompany(3, { agencyFromRegister: true });
    await api.logMasiActivity({ kind: 'CALL', personId: 20, companyId: 3, summary: 'called' });

    expect(calls().map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      ['/api/masi/companies/82/register-candidates', 'GET'],
      ['/api/masi/companies/82/register-candidates?code=14532901', 'GET'],
      ['/api/masi/companies/82/register-match', 'POST'],
      ['/api/masi/companies/82/register-match', 'DELETE'],
      ['/api/masi/persons?q=kask&company=3&agency=true&page=1&size=50', 'GET'],
      ['/api/masi/persons/20', 'GET'],
      ['/api/masi/persons/of-company/3', 'GET'],
      ['/api/masi/persons/20', 'PATCH'],
      ['/api/masi/companies/3/contacts?size=200', 'GET'],
      ['/api/masi/contacts/91', 'PATCH'],
      ['/api/masi/companies/3', 'PATCH'],
      ['/api/masi/activity', 'POST'],
    ]);
    expect(bodyOf(2)).toEqual({ registryCode: '14532901' });
    expect(bodyOf(7)).toEqual({ doNotContact: true });
    expect(bodyOf(9)).toEqual({ doNotContact: true });
    expect(bodyOf(10)).toEqual({ agencyFromRegister: true });
    expect(bodyOf(11)).toEqual({ kind: 'CALL', personId: 20, companyId: 3, summary: 'called' });
  });
});
