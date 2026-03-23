import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock oidcClient before importing api
vi.mock('./oidcClient', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  login: vi.fn(),
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Helper to create mock Response objects
function mockResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => init.headers?.[name] ?? null,
    },
  } as unknown as Response
}

beforeEach(() => {
  mockFetch.mockReset()
  // Reset location
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
})

describe('api - fetchPages', () => {
  it('calls /api/monitor/pages and returns page list', async () => {
    const { fetchPages } = await import('./api')
    const pages = ['page1', 'page2']
    mockFetch.mockResolvedValueOnce(mockResponse(pages))

    const result = await fetchPages()
    expect(result).toEqual(pages)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/pages',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    const { fetchPages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 500 }))
    await expect(fetchPages()).rejects.toThrow('Failed to fetch pages')
  })
})

describe('api - fetchLatestResult', () => {
  it('returns null for 404', async () => {
    const { fetchLatestResult } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }))
    const result = await fetchLatestResult('test')
    expect(result).toBeNull()
  })
})

describe('api - apiFetch internals (tested via exported functions)', () => {
  it('includes Bearer token in requests', async () => {
    const { fetchPages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchPages()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
      }),
    )
  })

  it('calls oidcClient.login on 401 response', async () => {
    const { fetchPages } = await import('./api')
    const { login } = await import('./oidcClient')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 401 }))
    await expect(fetchPages()).rejects.toThrow('Unauthorized')
    expect(login).toHaveBeenCalled()
  })

  it('does not include credentials: include (no cookies)', async () => {
    const { fetchPages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchPages()
    const callOptions = mockFetch.mock.calls[0][1]
    expect(callOptions.credentials).toBeUndefined()
  })
})

describe('api - CRUD functions', () => {
  it('createPageMonitor sends POST with JSON body', async () => {
    const { createPageMonitor } = await import('./api')
    const request = { name: 'Test', url: 'http://test.com', pattern: String.raw`\d+`, cron: '0 * * * * *', enabled: true }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...request }))
    const result = await createPageMonitor(request)
    expect(result.id).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      }),
    )
  })

  it('createPageMonitor throws error message from response body', async () => {
    const { createPageMonitor } = await import('./api')
    const request = { name: 'Test', url: 'http://test.com', pattern: String.raw`\d+`, cron: '0 * * * * *', enabled: true }
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Name already exists' }, { status: 400 }))
    await expect(createPageMonitor(request)).rejects.toThrow('Name already exists')
  })

  it('deletePageMonitor sends DELETE', async () => {
    const { deletePageMonitor } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 204 }))
    // 204 is not ok (our mock), let's use 200
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await deletePageMonitor(5)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config/5',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('api - RSS functions', () => {
  it('fetchRssFeeds returns feed list', async () => {
    const { fetchRssFeeds } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(['feed1', 'feed2']))
    const result = await fetchRssFeeds()
    expect(result).toEqual(['feed1', 'feed2'])
  })

  it('triggerRssCheck sends POST', async () => {
    const { triggerRssCheck } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, feedName: 'test' }))
    await triggerRssCheck('test-feed')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/check/test-feed',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('generateRssCollections sends POST and extracts collections', async () => {
    const { generateRssCollections } = await import('./api')
    const collections = [{ name: 'Tech', metrics: [{ name: 'AI', keywords: ['ai', 'ml'] }] }]
    mockFetch.mockResolvedValueOnce(mockResponse({ collections }))
    const result = await generateRssCollections({ url: 'http://feed.com/rss', prompt: 'tech topics' })
    expect(result).toEqual(collections)
  })
})

describe('api - fetchResults', () => {
  it('uses pageName in URL when provided', async () => {
    const { fetchResults } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ content: [], totalPages: 0 }))
    await fetchResults('my-page', 0, 50)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/results/my-page?page=0&size=50',
      expect.any(Object),
    )
  })

  it('omits pageName from URL when not provided', async () => {
    const { fetchResults } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ content: [], totalPages: 0 }))
    await fetchResults(undefined, 0, 100)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/results?page=0&size=100',
      expect.any(Object),
    )
  })
})

describe('api - page monitor CRUD extended', () => {
  it('updatePageMonitor sends PUT', async () => {
    const { updatePageMonitor } = await import('./api')
    const req = { name: 'Updated', url: 'http://x.com', pattern: String.raw`\d+`, cron: '0 0 * * * *', enabled: true }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }))
    await updatePageMonitor(1, req)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/config/1',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('fetchPageMonitorConfigs returns configs', async () => {
    const { fetchPageMonitorConfigs } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'test' }]))
    const result = await fetchPageMonitorConfigs()
    expect(result).toEqual([{ id: 1, name: 'test' }])
  })

  it('fetchPageConfig returns page configs', async () => {
    const { fetchPageConfig } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ name: 'p1' }]))
    const result = await fetchPageConfig()
    expect(result).toEqual([{ name: 'p1' }])
  })

  it('fetchPageStats returns stats', async () => {
    const { fetchPageStats } = await import('./api')
    const stats = { pageName: 'test', last24Hours: { total: 10, matches: 8, noMatches: 2 } }
    mockFetch.mockResolvedValueOnce(mockResponse(stats))
    const result = await fetchPageStats('test')
    expect(result).toEqual(stats)
  })
})

describe('api - RSS feed monitor CRUD', () => {
  it('fetchRssFeedMonitorConfigs returns configs', async () => {
    const { fetchRssFeedMonitorConfigs } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'feed' }]))
    const result = await fetchRssFeedMonitorConfigs()
    expect(result).toEqual([{ id: 1, name: 'feed' }])
  })

  it('createRssFeedMonitor sends POST', async () => {
    const { createRssFeedMonitor } = await import('./api')
    const req = { name: 'f', url: 'http://x.com', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }))
    await createRssFeedMonitor(req)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createRssFeedMonitor throws with error message', async () => {
    const { createRssFeedMonitor } = await import('./api')
    const req = { name: 'f', url: 'http://x.com', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] }
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Duplicate' }, { status: 400 }))
    await expect(createRssFeedMonitor(req)).rejects.toThrow('Duplicate')
  })

  it('updateRssFeedMonitor sends PUT', async () => {
    const { updateRssFeedMonitor } = await import('./api')
    const req = { name: 'f', url: 'http://x.com', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, ...req }))
    await updateRssFeedMonitor(1, req)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config/1',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('deleteRssFeedMonitor sends DELETE', async () => {
    const { deleteRssFeedMonitor } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await deleteRssFeedMonitor(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/rss/config/1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('fetchRssConfig returns configs', async () => {
    const { fetchRssConfig } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ name: 'feed1' }]))
    const result = await fetchRssConfig()
    expect(result).toEqual([{ name: 'feed1' }])
  })

  it('fetchRssResults returns paged results', async () => {
    const { fetchRssResults } = await import('./api')
    const paged = { content: [], totalElements: 0 }
    mockFetch.mockResolvedValueOnce(mockResponse(paged))
    const result = await fetchRssResults('feed1', 0, 100)
    expect(result).toEqual(paged)
  })

  it('fetchRssLatestResult returns null on 404', async () => {
    const { fetchRssLatestResult } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }))
    const result = await fetchRssLatestResult('feed1')
    expect(result).toBeNull()
  })

  it('fetchRssChartData returns chart data', async () => {
    const { fetchRssChartData } = await import('./api')
    const chartData = { col1: [] }
    mockFetch.mockResolvedValueOnce(mockResponse(chartData))
    const result = await fetchRssChartData('feed1', 50)
    expect(result).toEqual(chartData)
  })
})

describe('api - game', () => {
  it('fetchGameState returns state', async () => {
    const { fetchGameState } = await import('./api')
    const state = { id: 1, player1Position: 0 }
    mockFetch.mockResolvedValueOnce(mockResponse(state))
    const result = await fetchGameState()
    expect(result).toEqual(state)
  })

  it('spinGame sends POST', async () => {
    const { spinGame } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ colors: ['red'] }))
    await spinGame()
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/game/spin',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('spinGame throws with error message', async () => {
    const { spinGame } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not your turn' }, { status: 400 }))
    await expect(spinGame()).rejects.toThrow('Not your turn')
  })

  it('resetGame sends POST', async () => {
    const { resetGame } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }))
    await resetGame()
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/game/reset',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('api - user preferences', () => {
  it('saveLastPath sends PUT', async () => {
    const { saveLastPath } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await saveLastPath('/dashboard')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/last-path',
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})

describe('api - inbox', () => {
  it('fetchInboxEmails returns paged emails', async () => {
    const { fetchInboxEmails } = await import('./api')
    const paged = { content: [{ id: 1 }], totalElements: 1 }
    mockFetch.mockResolvedValueOnce(mockResponse(paged))
    const result = await fetchInboxEmails(0, 20)
    expect(result).toEqual(paged)
  })

  it('fetchInboxEmail returns single email', async () => {
    const { fetchInboxEmail } = await import('./api')
    const email = { id: 1, subject: 'test' }
    mockFetch.mockResolvedValueOnce(mockResponse(email))
    const result = await fetchInboxEmail(1)
    expect(result).toEqual(email)
  })

  it('fetchEmailAttachments returns attachments', async () => {
    const { fetchEmailAttachments } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, filename: 'doc.pdf' }]))
    const result = await fetchEmailAttachments(1)
    expect(result).toEqual([{ id: 1, filename: 'doc.pdf' }])
  })

  it('getAttachmentDownloadUrl returns correct URL', async () => {
    const { getAttachmentDownloadUrl } = await import('./api')
    expect(getAttachmentDownloadUrl(1, 2)).toBe('/api/inbox/emails/1/attachments/2')
  })
})

describe('api - chat', () => {
  it('fetchChatChannels returns channels', async () => {
    const { fetchChatChannels } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'general' }]))
    const result = await fetchChatChannels()
    expect(result).toEqual([{ id: 1, name: 'general' }])
  })

  it('createChatChannel sends POST', async () => {
    const { createChatChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'test' }))
    await createChatChannel('test', true)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/channels',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createChatChannel throws with error', async () => {
    const { createChatChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Name taken' }, { status: 400 }))
    await expect(createChatChannel('test')).rejects.toThrow('Name taken')
  })

  it('leaveChatChannel sends POST', async () => {
    const { leaveChatChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await leaveChatChannel(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/leave', expect.objectContaining({ method: 'POST' }))
  })

  it('deleteChatChannel sends DELETE', async () => {
    const { deleteChatChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await deleteChatChannel(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('fetchChatMessages returns messages', async () => {
    const { fetchChatMessages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ messageId: 'abc' }]))
    const result = await fetchChatMessages(1, 50)
    expect(result).toEqual([{ messageId: 'abc' }])
  })

  it('sendChatMessage sends POST', async () => {
    const { sendChatMessage } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ messageId: 'abc' }))
    await sendChatMessage(1, 'hello', undefined, 1)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/messages', expect.objectContaining({ method: 'POST' }))
  })

  it('markChannelRead sends POST', async () => {
    const { markChannelRead } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await markChannelRead(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/read', expect.objectContaining({ method: 'POST' }))
  })

  it('editChatMessage sends PUT', async () => {
    const { editChatMessage } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await editChatMessage(1, 'msg-1', 'updated')
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/messages/msg-1', expect.objectContaining({ method: 'PUT' }))
  })

  it('editChatMessage throws with error', async () => {
    const { editChatMessage } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Too late' }, { status: 400 }))
    await expect(editChatMessage(1, 'msg-1', 'x')).rejects.toThrow('Too late')
  })

  it('fetchMessageEdits returns edits', async () => {
    const { fetchMessageEdits } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ editId: 'e1' }]))
    const result = await fetchMessageEdits(1, 'msg-1')
    expect(result).toEqual([{ editId: 'e1' }])
  })

  it('verifyChannelChain returns verification', async () => {
    const { verifyChannelChain } = await import('./api')
    const v = { messageCount: 10, validCount: 10, intact: true }
    mockFetch.mockResolvedValueOnce(mockResponse(v))
    const result = await verifyChannelChain(1)
    expect(result).toEqual(v)
  })

  it('fetchChatUsers returns users', async () => {
    const { fetchChatUsers } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1 }]))
    const result = await fetchChatUsers()
    expect(result).toEqual([{ id: 1 }])
  })

  it('inviteToChannel sends POST', async () => {
    const { inviteToChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await inviteToChannel(1, 2)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/invite', expect.objectContaining({ method: 'POST' }))
  })

  it('inviteToChannel throws with error', async () => {
    const { inviteToChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Already member' }, { status: 400 }))
    await expect(inviteToChannel(1, 2)).rejects.toThrow('Already member')
  })

  it('fetchChannelMembers returns members', async () => {
    const { fetchChannelMembers } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, email: 'a@b.com' }]))
    const result = await fetchChannelMembers(1)
    expect(result).toEqual([{ id: 1, email: 'a@b.com' }])
  })

  it('kickFromChannel sends POST', async () => {
    const { kickFromChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await kickFromChannel(1, 2)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/kick', expect.objectContaining({ method: 'POST' }))
  })

  it('kickFromChannel throws with error', async () => {
    const { kickFromChannel } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot kick owner' }, { status: 400 }))
    await expect(kickFromChannel(1, 2)).rejects.toThrow('Cannot kick owner')
  })
})

describe('api - E2E encryption keys', () => {
  it('fetchUserKeys returns null on 404', async () => {
    const { fetchUserKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 404 }))
    const result = await fetchUserKeys()
    expect(result).toBeNull()
  })

  it('fetchUserKeys returns keys', async () => {
    const { fetchUserKeys } = await import('./api')
    const keys = { publicKey: 'pk', encryptedPrivateKey: 'epk' }
    mockFetch.mockResolvedValueOnce(mockResponse(keys))
    const result = await fetchUserKeys()
    expect(result).toEqual(keys)
  })

  it('uploadUserKeys sends POST', async () => {
    const { uploadUserKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ publicKey: 'pk' }))
    await uploadUserKeys({ publicKey: 'pk', encryptedPrivateKey: 'epk', pbkdf2Salt: 'salt', pbkdf2Iterations: 600000 })
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/keys', expect.objectContaining({ method: 'POST' }))
  })

  it('updateUserKeys sends PUT', async () => {
    const { updateUserKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await updateUserKeys({ publicKey: 'pk', encryptedPrivateKey: 'epk', pbkdf2Salt: 'salt', pbkdf2Iterations: 600000 })
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/keys', expect.objectContaining({ method: 'PUT' }))
  })

  it('fetchPublicKeys builds query params', async () => {
    const { fetchPublicKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchPublicKeys([1, 2])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/keys/public?userIds=1&userIds=2',
      expect.any(Object),
    )
  })

  it('fetchChannelKeys with version param', async () => {
    const { fetchChannelKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchChannelKeys(1, 2)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/keys?keyVersion=2', expect.any(Object))
  })

  it('fetchChannelKeys without version param', async () => {
    const { fetchChannelKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchChannelKeys(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/keys', expect.any(Object))
  })

  it('setChannelKeys sends POST', async () => {
    const { setChannelKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await setChannelKeys(1, [{ userId: 1, encryptedChannelKey: 'eck', wrapperPublicKey: 'wpk' }])
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/channels/1/keys', expect.objectContaining({ method: 'POST' }))
  })

  it('rotateChannelKeys sends POST and returns version', async () => {
    const { rotateChannelKeys } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ newKeyVersion: 2 }))
    const result = await rotateChannelKeys(1, [])
    expect(result).toEqual({ newKeyVersion: 2 })
  })
})

describe('api - test endpoints', () => {
  it('testPageMonitor sends POST', async () => {
    const { testPageMonitor } = await import('./api')
    const req = { name: 'test', url: 'http://x.com', pattern: String.raw`\d+`, cron: '0 0 * * * *', enabled: true }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }))
    await testPageMonitor(req)
    expect(mockFetch).toHaveBeenCalledWith('/api/monitor/test', expect.objectContaining({ method: 'POST' }))
  })

  it('testRssFeedMonitor sends POST', async () => {
    const { testRssFeedMonitor } = await import('./api')
    const req = { name: 'f', url: 'http://x.com', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] }
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }))
    await testRssFeedMonitor(req)
    expect(mockFetch).toHaveBeenCalledWith('/api/rss/test', expect.objectContaining({ method: 'POST' }))
  })
})

describe('api - admin', () => {
  it('fetchAdminUsers returns users', async () => {
    const { fetchAdminUsers } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, email: 'admin@test.com' }]))
    const result = await fetchAdminUsers()
    expect(result).toEqual([{ id: 1, email: 'admin@test.com' }])
  })

  it('setUserEnabled sends PUT', async () => {
    const { setUserEnabled } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await setUserEnabled(1, false)
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/1/enabled', expect.objectContaining({ method: 'PUT' }))
  })

  it('setUserEnabled throws with error', async () => {
    const { setUserEnabled } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot disable self' }, { status: 400 }))
    await expect(setUserEnabled(1, false)).rejects.toThrow('Cannot disable self')
  })

  it('setUserGroups sends PUT', async () => {
    const { setUserGroups } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await setUserGroups(1, [1, 2])
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/1/groups', expect.objectContaining({ method: 'PUT' }))
  })

  it('setUserGroups throws with error', async () => {
    const { setUserGroups } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot remove self' }, { status: 400 }))
    await expect(setUserGroups(1, [])).rejects.toThrow('Cannot remove self')
  })

  it('fetchAdminGroups returns groups', async () => {
    const { fetchAdminGroups } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([{ id: 1, name: 'Admins' }]))
    const result = await fetchAdminGroups()
    expect(result).toEqual([{ id: 1, name: 'Admins' }])
  })

  it('createGroup sends POST', async () => {
    const { createGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 2, name: 'Editors' }))
    const result = await createGroup('Editors', 'Can edit', ['METRICS'])
    expect(result).toEqual({ id: 2, name: 'Editors' })
  })

  it('createGroup throws with error', async () => {
    const { createGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Name taken' }, { status: 400 }))
    await expect(createGroup('Admins', '', [])).rejects.toThrow('Name taken')
  })

  it('updateGroup sends PUT', async () => {
    const { updateGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'Updated' }))
    await updateGroup(1, 'Updated', 'desc', ['METRICS'])
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/groups/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('updateGroup throws with error', async () => {
    const { updateGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, { status: 400 }))
    await expect(updateGroup(99, 'x', '', [])).rejects.toThrow('Not found')
  })

  it('deleteGroup sends DELETE', async () => {
    const { deleteGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null))
    await deleteGroup(2)
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/groups/2', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteGroup throws with error', async () => {
    const { deleteGroup } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Cannot delete Admins' }, { status: 400 }))
    await expect(deleteGroup(1)).rejects.toThrow('Cannot delete Admins')
  })
})

