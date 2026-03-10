import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RssDashboard from './RssDashboard'

vi.mock('../services/api', () => ({
  fetchRssFeedMonitorConfigs: vi.fn(),
  fetchRssLatestResult: vi.fn(),
  fetchRssChartData: vi.fn(),
}))

vi.mock('../components/MetricChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid="metric-chart">{title}</div>,
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.mocked(api.fetchRssFeedMonitorConfigs).mockReset()
  vi.mocked(api.fetchRssLatestResult).mockReset()
  vi.mocked(api.fetchRssChartData).mockReset()
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <RssDashboard />
    </MemoryRouter>,
  )
}

describe('RssDashboard', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(screen.getByText('Loading RSS feeds...')).toBeInTheDocument()
  })

  it('shows empty state when no feeds', async () => {
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([])
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/No RSS feeds configured/)).toBeInTheDocument()
    })
  })

  it('renders feed cards with data', async () => {
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([
      { id: 1, name: 'Tech Feed', url: 'http://x.com/rss', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [{ name: 'col1', metrics: [{ name: 'm1', keywords: ['k1'] }] }] },
    ])
    vi.mocked(api.fetchRssLatestResult).mockResolvedValue({
      id: 1, feedName: 'Tech Feed', url: 'http://x.com/rss', checkedAt: new Date().toISOString(),
      responseTimeMs: 100, httpStatus: 200, articleCount: 25, errorMessage: null, metricCounts: [],
    })
    vi.mocked(api.fetchRssChartData).mockResolvedValue({})

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Tech Feed')).toBeInTheDocument()
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('1 collection(s), 1 metric(s)')).toBeInTheDocument()
    })
  })

  it('shows error badge when feed has error', async () => {
    vi.mocked(api.fetchRssFeedMonitorConfigs).mockResolvedValue([
      { id: 1, name: 'Bad Feed', url: 'http://x.com', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true, collections: [] },
    ])
    vi.mocked(api.fetchRssLatestResult).mockResolvedValue({
      id: 1, feedName: 'Bad Feed', url: 'http://x.com', checkedAt: new Date().toISOString(),
      responseTimeMs: null, httpStatus: null, articleCount: null, errorMessage: 'Connection failed', metricCounts: [],
    })
    vi.mocked(api.fetchRssChartData).mockResolvedValue({})

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })
  })
})
