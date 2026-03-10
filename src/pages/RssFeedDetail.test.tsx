import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RssFeedDetail from './RssFeedDetail'

vi.mock('../services/api', () => ({
  fetchRssResults: vi.fn(),
  fetchRssChartData: vi.fn(),
  fetchRssConfig: vi.fn(),
  triggerRssCheck: vi.fn(),
}))

vi.mock('../components/MetricChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid="metric-chart">{title}</div>,
}))

vi.mock('react-paginate', () => ({
  default: () => <div data-testid="paginate" />,
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.mocked(api.fetchRssResults).mockReset()
  vi.mocked(api.fetchRssChartData).mockReset()
  vi.mocked(api.fetchRssConfig).mockReset()
  vi.mocked(api.triggerRssCheck).mockReset()
})

function renderDetail(feedName = 'test-feed') {
  return render(
    <MemoryRouter initialEntries={[`/rss/${feedName}`]}>
      <Routes>
        <Route path="/rss/:feedName" element={<RssFeedDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const mockResult = {
  id: 1, feedName: 'test-feed', url: 'http://x.com/rss',
  checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 150, httpStatus: 200,
  articleCount: 20, errorMessage: null, metricCounts: [{ collectionName: 'c1', metricName: 'AI', count: 5 }],
}

describe('RssFeedDetail', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchRssResults).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchRssChartData).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchRssConfig).mockReturnValue(new Promise(() => {}))
    renderDetail()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays feed details with stats', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchRssChartData).mockResolvedValue({})
    vi.mocked(api.fetchRssConfig).mockResolvedValue([
      { id: 1, name: 'test-feed', url: 'http://x.com/rss', collections: [], cron: '0 0 * * * *', fetchContent: false, maxArticles: 30 },
    ])

    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('test-feed')).toBeInTheDocument()
      expect(screen.getAllByText('20').length).toBeGreaterThan(0) // article count
    })
  })

  it('triggers manual check', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchRssChartData).mockResolvedValue({})
    vi.mocked(api.fetchRssConfig).mockResolvedValue([])
    vi.mocked(api.triggerRssCheck).mockResolvedValue(mockResult)

    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Check Now')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Check Now'))
    expect(api.triggerRssCheck).toHaveBeenCalledWith('test-feed')
  })

  it('shows metric counts in results table', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchRssChartData).mockResolvedValue({})
    vi.mocked(api.fetchRssConfig).mockResolvedValue([])

    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('AI: 5')).toBeInTheDocument()
    })
  })
})
