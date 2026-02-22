import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test the module's internal functions via exports.
// apiFetch is not exported, so we test it indirectly through the exported functions.
// We also test exported helpers directly.

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
  // Clear cookies
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  // Clear localStorage
  localStorage.clear()
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
      expect.objectContaining({ credentials: 'include' }),
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
  it('includes credentials in requests', async () => {
    const { fetchPages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchPages()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('redirects to /login on 401 response', async () => {
    const { fetchPages } = await import('./api')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 401 }))
    await expect(fetchPages()).rejects.toThrow('Unauthorized')
    expect(window.location.href).toBe('/login')
  })

  it('removes email from localStorage on 401', async () => {
    const { fetchPages } = await import('./api')
    localStorage.setItem('email', 'test@example.com')
    mockFetch.mockResolvedValueOnce(mockResponse(null, { status: 401 }))
    await expect(fetchPages()).rejects.toThrow('Unauthorized')
    expect(localStorage.getItem('email')).toBeNull()
  })

  it('includes CSRF token for POST requests when cookie exists', async () => {
    const { triggerCheck } = await import('./api')
    document.cookie = 'XSRF-TOKEN=test-csrf-token'
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }))
    await triggerCheck('test-page')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/monitor/check/test-page',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'test-csrf-token' }),
      }),
    )
  })

  it('does not include CSRF token for GET requests', async () => {
    const { fetchPages } = await import('./api')
    document.cookie = 'XSRF-TOKEN=test-csrf-token'
    mockFetch.mockResolvedValueOnce(mockResponse([]))
    await fetchPages()
    const callHeaders = mockFetch.mock.calls[0][1].headers
    expect(callHeaders['X-XSRF-TOKEN']).toBeUndefined()
  })
})

describe('api - CRUD functions', () => {
  it('createPageMonitor sends POST with JSON body', async () => {
    const { createPageMonitor } = await import('./api')
    const request = { name: 'Test', url: 'http://test.com', pattern: '\\d+', cron: '0 * * * * *', enabled: true }
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
    const request = { name: 'Test', url: 'http://test.com', pattern: '\\d+', cron: '0 * * * * *', enabled: true }
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
})
