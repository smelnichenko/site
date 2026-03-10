import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MonitorConfig from './MonitorConfig'

vi.mock('../services/api', () => ({
  fetchPageMonitorConfigs: vi.fn(),
  createPageMonitor: vi.fn(),
  updatePageMonitor: vi.fn(),
  deletePageMonitor: vi.fn(),
  fetchRssFeedMonitorConfigs: vi.fn(),
  createRssFeedMonitor: vi.fn(),
  updateRssFeedMonitor: vi.fn(),
  deleteRssFeedMonitor: vi.fn(),
  testPageMonitor: vi.fn(),
  testRssFeedMonitor: vi.fn(),
  generateRssCollections: vi.fn(),
}))

vi.mock('../contexts/LoadingContext', () => ({
  useLoading: () => ({
    loading: false,
    withLoading: (fn: () => Promise<unknown>) => fn(),
  }),
}))

const api = await import('../services/api')

const mockPageMonitors = [
  { id: 1, name: 'Google', url: 'http://google.com', pattern: String.raw`\d+`, cron: '0 0 * * * *', enabled: true },
]

const mockRssMonitors = [
  { id: 1, name: 'Tech Feed', url: 'http://x.com/rss', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [{ name: 'col1', metrics: [{ name: 'AI', keywords: ['ai'] }] }] },
]

beforeEach(() => {
  vi.mocked(api.fetchPageMonitorConfigs).mockReset()
  vi.mocked(api.fetchRssFeedMonitorConfigs).mockReset()
  vi.mocked(api.createPageMonitor).mockReset()
  vi.mocked(api.createRssFeedMonitor).mockReset()
  vi.mocked(api.updatePageMonitor).mockReset()
  vi.mocked(api.updateRssFeedMonitor).mockReset()
  vi.mocked(api.deletePageMonitor).mockReset()
  vi.mocked(api.deleteRssFeedMonitor).mockReset()
  vi.mocked(api.testPageMonitor).mockReset()
  vi.mocked(api.testRssFeedMonitor).mockReset()
  vi.mocked(api.generateRssCollections).mockReset()
})

function renderConfig() {
  return render(
    <MemoryRouter>
      <MonitorConfig />
    </MemoryRouter>,
  )
}

describe('MonitorConfig', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockReturnValue(new Promise(() => {}))
    renderConfig()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders page and RSS monitors', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)

    renderConfig()
    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.getByText('Tech Feed')).toBeInTheDocument()
    })
  })

  it('shows empty state when no monitors', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    renderConfig()
    await waitFor(() => {
      expect(screen.getByText(/No page monitors configured/)).toBeInTheDocument()
      expect(screen.getByText(/No RSS feed monitors configured/)).toBeInTheDocument()
    })
  })

  it('shows add page monitor button', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    renderConfig()
    await waitFor(() => {
      expect(screen.getByText('+ Add Page Monitor')).toBeInTheDocument()
      expect(screen.getByText('+ Add RSS Feed')).toBeInTheDocument()
    })
  })

  it('opens new page monitor form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/URL/)).toBeInTheDocument()
  })

  it('deletes a page monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.deletePageMonitor).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Google'))

    await user.click(screen.getAllByText('Delete')[0])
    expect(api.deletePageMonitor).toHaveBeenCalledWith(1)
  })

  it('shows monitor details', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)

    renderConfig()
    await waitFor(() => {
      expect(screen.getByText('http://google.com')).toBeInTheDocument()
      expect(screen.getByText('http://x.com/rss')).toBeInTheDocument()
    })
  })

  it('creates a new page monitor via form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.createPageMonitor).mockResolvedValue({ id: 2, name: 'My Page', url: 'http://example.com', pattern: String.raw`\d+`, cron: '0 0 * * * *', enabled: true })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    await user.type(screen.getByLabelText(/Name/), 'My Page')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com')
    await user.type(screen.getByLabelText(/Pattern/), String.raw`\d+`)
    await user.click(screen.getByText('Save'))

    expect(api.createPageMonitor).toHaveBeenCalled()
  })

  it('cancels new page monitor form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByLabelText(/Pattern/)).not.toBeInTheDocument()
  })

  it('opens edit form for existing page monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Google'))

    await user.click(screen.getAllByText('Edit')[0])
    expect(screen.getByDisplayValue('Google')).toBeInTheDocument()
  })

  it('saves edit for page monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.updatePageMonitor).mockResolvedValue({ id: 1, name: 'Bing', url: 'http://google.com', pattern: String.raw`\d+`, cron: '0 0 * * * *', enabled: true })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Google'))

    await user.click(screen.getAllByText('Edit')[0])
    const nameInput = screen.getByDisplayValue('Google')
    await user.clear(nameInput)
    await user.type(nameInput, 'Bing')
    await user.click(screen.getByText('Save'))

    expect(api.updatePageMonitor).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Bing' }))
  })

  it('deletes an RSS feed monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)
    vi.mocked(api.deleteRssFeedMonitor).mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    await user.click(screen.getAllByText('Delete')[0])
    expect(api.deleteRssFeedMonitor).toHaveBeenCalledWith(1)
  })

  it('opens new RSS feed form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/URL/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Max Articles/)).toBeInTheDocument()
  })

  it('creates a new RSS feed monitor via form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.createRssFeedMonitor).mockResolvedValue({ id: 2, name: 'My Feed', url: 'http://example.com/rss', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    await user.type(screen.getByLabelText(/Name/), 'My Feed')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com/rss')
    await user.click(screen.getByText('Save'))

    expect(api.createRssFeedMonitor).toHaveBeenCalled()
  })

  it('tests a page monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testPageMonitor).mockResolvedValue({
      id: 1, pageName: 'Google', url: 'http://google.com', pattern: String.raw`\d+`,
      extractedValue: 42, matched: true, rawMatch: '42',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200,
      errorMessage: null, createdAt: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Google'))

    const testButtons = screen.getAllByText('Test')
    await user.click(testButtons[0])
    expect(api.testPageMonitor).toHaveBeenCalled()
  })

  it('tests an RSS feed monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)
    vi.mocked(api.testRssFeedMonitor).mockResolvedValue({
      id: 1, feedName: 'Tech Feed', url: 'http://x.com/rss',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200,
      articleCount: 10, errorMessage: null, metricCounts: [],
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    const testButtons = screen.getAllByText('Test')
    await user.click(testButtons[0])
    expect(api.testRssFeedMonitor).toHaveBeenCalled()
  })

  it('shows RSS collection details', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)

    renderConfig()
    await waitFor(() => {
      expect(screen.getByText(/col1/)).toBeInTheDocument()
      expect(screen.getByText(/AI/)).toBeInTheDocument()
    })
  })

  it('opens edit form for existing RSS monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    await user.click(screen.getAllByText('Edit')[0])
    expect(screen.getByDisplayValue('Tech Feed')).toBeInTheDocument()
  })

  it('saves edit for RSS monitor', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)
    vi.mocked(api.updateRssFeedMonitor).mockResolvedValue({ id: 1, name: 'Updated Feed', url: 'http://x.com/rss', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    await user.click(screen.getAllByText('Edit')[0])
    const nameInput = screen.getByDisplayValue('Tech Feed')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Feed')
    await user.click(screen.getByText('Save'))

    expect(api.updateRssFeedMonitor).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Updated Feed' }))
  })

  it('shows PageTestResultBanner with error state in page form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testPageMonitor).mockResolvedValue({
      id: 1, pageName: 'Test', url: 'http://fail.com', pattern: String.raw`\d+`,
      extractedValue: null, matched: false, rawMatch: null,
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 0, httpStatus: 0,
      errorMessage: 'Connection refused', createdAt: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    await user.type(screen.getByLabelText(/Name/), 'Test')
    await user.type(screen.getByLabelText(/URL/), 'http://fail.com')
    await user.type(screen.getByLabelText(/Pattern/), String.raw`\d+`)
    await user.click(screen.getByText('Test'))

    await waitFor(() => {
      expect(screen.getByText(/Error: Connection refused/)).toBeInTheDocument()
    })
  })

  it('shows PageTestResultBanner with matched state', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testPageMonitor).mockResolvedValue({
      id: 1, pageName: 'Test', url: 'http://example.com', pattern: String.raw`\d+`,
      extractedValue: 42, matched: true, rawMatch: '42',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 150, httpStatus: 200,
      errorMessage: null, createdAt: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    await user.type(screen.getByLabelText(/Name/), 'Test')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com')
    await user.type(screen.getByLabelText(/Pattern/), String.raw`\d+`)
    await user.click(screen.getByText('Test'))

    await waitFor(() => {
      expect(screen.getByText(/Matched/)).toBeInTheDocument()
      expect(screen.getByText(/Value:/)).toBeInTheDocument()
      expect(screen.getByText(/raw: /)).toBeInTheDocument()
      expect(screen.getByText(/HTTP 200/)).toBeInTheDocument()
      expect(screen.getByText(/150ms/)).toBeInTheDocument()
    })
  })

  it('shows PageTestResultBanner with no-match state', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testPageMonitor).mockResolvedValue({
      id: 1, pageName: 'Test', url: 'http://example.com', pattern: 'xyz',
      extractedValue: null, matched: false, rawMatch: null,
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 80, httpStatus: 200,
      errorMessage: null, createdAt: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    await user.type(screen.getByLabelText(/Name/), 'Test')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com')
    await user.type(screen.getByLabelText(/Pattern/), String.raw`xyz`)
    await user.click(screen.getByText('Test'))

    await waitFor(() => {
      expect(screen.getByText(/No match/)).toBeInTheDocument()
      expect(screen.getByText(/HTTP 200/)).toBeInTheDocument()
    })
  })

  it('shows RssTestResultBanner with error state in RSS form', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testRssFeedMonitor).mockResolvedValue({
      id: 1, feedName: 'Test', url: 'http://bad.com/rss',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 0, httpStatus: 0,
      articleCount: 0, errorMessage: 'Invalid RSS feed', metricCounts: [],
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    await user.type(screen.getByLabelText(/Name/), 'Test')
    await user.type(screen.getByLabelText(/URL/), 'http://bad.com/rss')
    await user.click(screen.getByText('Test'))

    await waitFor(() => {
      expect(screen.getByText(/Error: Invalid RSS feed/)).toBeInTheDocument()
    })
  })

  it('shows RssTestResultBanner with success and metric counts', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testRssFeedMonitor).mockResolvedValue({
      id: 1, feedName: 'Test', url: 'http://example.com/rss',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 200, httpStatus: 200,
      articleCount: 15, errorMessage: null,
      metricCounts: [
        { collectionName: 'Tech', metricName: 'AI', count: 5 },
        { collectionName: 'Tech', metricName: 'Cloud', count: 3 },
      ],
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    await user.type(screen.getByLabelText(/Name/), 'Test')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com/rss')
    await user.click(screen.getByText('Test'))

    await waitFor(() => {
      expect(screen.getByText(/15 articles/)).toBeInTheDocument()
      expect(screen.getByText(/HTTP 200/)).toBeInTheDocument()
      expect(screen.getByText(/AI: 5/)).toBeInTheDocument()
      expect(screen.getByText(/Cloud: 3/)).toBeInTheDocument()
    })
  })

  it('tests existing page monitor via Test button (buildTestPageRequest)', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue(mockPageMonitors)
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.testPageMonitor).mockResolvedValue({
      id: 1, pageName: 'Google', url: 'http://google.com', pattern: String.raw`\d+`,
      extractedValue: 42, matched: true, rawMatch: '42',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200,
      errorMessage: null, createdAt: '2026-01-01T00:00:00Z',
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Google'))

    await user.click(screen.getAllByText('Test')[0])
    expect(api.testPageMonitor).toHaveBeenCalledWith({
      name: 'Google', url: 'http://google.com', pattern: String.raw`\d+`,
      cron: '0 0 * * * *', enabled: true,
    })
  })

  it('tests existing RSS monitor via Test button (buildTestRssRequest)', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(mockRssMonitors)
    vi.mocked(api.testRssFeedMonitor).mockResolvedValue({
      id: 1, feedName: 'Tech Feed', url: 'http://x.com/rss',
      checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200,
      articleCount: 10, errorMessage: null, metricCounts: [],
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    await user.click(screen.getAllByText('Test')[0])
    expect(api.testRssFeedMonitor).toHaveBeenCalledWith({
      name: 'Tech Feed', url: 'http://x.com/rss', cron: '0 0 * * * *',
      fetchContent: false, maxArticles: 30, enabled: true,
      collections: [{ name: 'col1', metrics: [{ name: 'AI', keywords: ['ai'] }] }],
    })
  })

  it('edit RSS monitor populates form via toRssFormInitial (keywords joined)', async () => {
    const rssWithMultiKeywords = [{
      id: 1, name: 'Tech Feed', url: 'http://x.com/rss', cron: '0 0 * * * *',
      fetchContent: true, maxArticles: 50, enabled: false,
      collections: [{
        name: 'col1',
        metrics: [{ name: 'AI', keywords: ['ai', 'machine learning', 'deep learning'] }],
      }],
    }]
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue(rssWithMultiKeywords)

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('Tech Feed'))

    await user.click(screen.getAllByText('Edit')[0])

    // toRssFormInitial joins keywords with ', '
    await waitFor(() => {
      expect(screen.getByDisplayValue('ai, machine learning, deep learning')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Tech Feed')).toBeInTheDocument()
      expect(screen.getByDisplayValue('http://x.com/rss')).toBeInTheDocument()
      expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    })
  })

  it('saves RSS form with collections converting keywords via toCollectionRequests', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.createRssFeedMonitor).mockResolvedValue({
      id: 2, name: 'Feed', url: 'http://example.com/rss', cron: '0 0 * * * *',
      fetchContent: false, maxArticles: 30, enabled: true, collections: [],
    })

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    await user.type(screen.getByLabelText(/Name/), 'Feed')
    await user.type(screen.getByLabelText(/URL/), 'http://example.com/rss')

    // Add a collection with a metric
    // Use fireEvent.change for collection/metric name inputs because the React key
    // includes col.name (key={`col-${col.name || ci}`}), causing remount on each keystroke
    await user.click(screen.getByText('+ Collection'))
    fireEvent.change(screen.getByLabelText(/Collection Name/), { target: { value: 'Tech' } })
    await user.click(screen.getByText('+ Metric'))
    fireEvent.change(screen.getByPlaceholderText('Metric name'), { target: { value: 'AI' } })
    fireEvent.change(screen.getByPlaceholderText('Keywords (comma-separated)'), { target: { value: 'ai, ml, deep learning' } })
    await user.click(screen.getByText('Save'))

    expect(api.createRssFeedMonitor).toHaveBeenCalledWith(expect.objectContaining({
      collections: [{
        name: 'Tech',
        metrics: [{ name: 'AI', keywords: ['ai', 'ml', 'deep learning'] }],
      }],
    }))
  })

  it('generates collections with AI and maps them via mapGeneratedCollections', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.generateRssCollections).mockResolvedValue([
      { name: 'Generated', metrics: [{ name: 'Topic', keywords: ['kw1', 'kw2'] }] },
    ])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    await user.type(screen.getByLabelText(/URL/), 'http://example.com/rss')
    await user.click(screen.getByText('Generate with AI'))
    await user.type(screen.getByLabelText(/Describe what to track/), 'Track tech trends')
    await user.click(screen.getByText('Generate'))

    await waitFor(() => {
      // mapGeneratedCollections joins keywords with ', '
      expect(screen.getByDisplayValue('Generated')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Topic')).toBeInTheDocument()
      expect(screen.getByDisplayValue('kw1, kw2')).toBeInTheDocument()
    })
  })

  it('renders empty state messages with proper HTML entities', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    renderConfig()
    await waitFor(() => {
      // &quot; in JSX renders as " in the DOM — verify the quoted text appears
      expect(screen.getByText(/Click "\+ Add Page Monitor" to create one/)).toBeInTheDocument()
      expect(screen.getByText(/Click "\+ Add RSS Feed" to create one/)).toBeInTheDocument()
    })
  })

  it('page form has proper htmlFor/id label associations', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add Page Monitor'))

    await user.click(screen.getByText('+ Add Page Monitor'))
    // These work because htmlFor and id are correctly associated
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('id', 'page-name')
    expect(screen.getByLabelText(/URL/)).toHaveAttribute('id', 'page-url')
    expect(screen.getByLabelText(/Pattern/)).toHaveAttribute('id', 'page-pattern')
    expect(screen.getByLabelText(/Cron/)).toHaveAttribute('id', 'page-cron')
  })

  it('RSS form has proper htmlFor/id label associations', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])

    const user = userEvent.setup()
    renderConfig()
    await waitFor(() => screen.getByText('+ Add RSS Feed'))

    await user.click(screen.getByText('+ Add RSS Feed'))
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('id', 'rss-name')
    expect(screen.getByLabelText(/URL/)).toHaveAttribute('id', 'rss-url')
    expect(screen.getByLabelText(/Cron/)).toHaveAttribute('id', 'rss-cron')
    expect(screen.getByLabelText(/Max Articles/)).toHaveAttribute('id', 'rss-max-articles')
  })
})
