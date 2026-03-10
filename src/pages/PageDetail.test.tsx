import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PageDetail from './PageDetail'

vi.mock('../services/api', () => ({
  fetchResults: vi.fn(),
  fetchPageStats: vi.fn(),
  fetchPageMonitorConfigs: vi.fn(),
  triggerCheck: vi.fn(),
}))

vi.mock('../components/ValueChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid="value-chart">{title}</div>,
}))

vi.mock('react-paginate', () => ({
  default: () => <div data-testid="paginate" />,
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.mocked(api.fetchResults).mockReset()
  vi.mocked(api.fetchPageStats).mockReset()
  vi.mocked(api.fetchPageMonitorConfigs).mockReset()
  vi.mocked(api.triggerCheck).mockReset()
})

function renderPageDetail(pageName = 'test-page') {
  return render(
    <MemoryRouter initialEntries={[`/page/${pageName}`]}>
      <Routes>
        <Route path="/page/:pageName" element={<PageDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const mockResult = {
  id: 1, pageName: 'test-page', url: 'http://x.com', pattern: '\\d+',
  extractedValue: 42, matched: true, rawMatch: '42',
  checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200,
  errorMessage: null, createdAt: '2026-01-01T00:00:00Z',
}

const mockStats = { pageName: 'test-page', last24Hours: { total: 10, matches: 8, noMatches: 2 } }

describe('PageDetail', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchResults).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchPageStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fetchPageMonitorConfigs).mockReturnValue(new Promise(() => {}))
    renderPageDetail()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays page name and results', async () => {
    vi.mocked(api.fetchResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchPageStats).mockResolvedValue(mockStats)
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([
      { id: 1, name: 'test-page', url: 'http://x.com', pattern: '\\d+', cron: '0 0 * * * *', enabled: true },
    ])

    renderPageDetail()
    await waitFor(() => {
      expect(screen.getByText('test-page')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // total checks
      expect(screen.getByText('8')).toBeInTheDocument() // successful
      expect(screen.getByText('2')).toBeInTheDocument() // failed
    })
  })

  it('shows Check Now button and triggers check', async () => {
    vi.mocked(api.fetchResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchPageStats).mockResolvedValue(mockStats)
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.triggerCheck).mockResolvedValue(mockResult)

    const user = userEvent.setup()
    renderPageDetail()
    await waitFor(() => {
      expect(screen.getByText('Check Now')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Check Now'))
    expect(api.triggerCheck).toHaveBeenCalledWith('test-page')
  })

  it('renders value chart', async () => {
    vi.mocked(api.fetchResults).mockResolvedValue({
      content: [mockResult], pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1, totalPages: 1, last: true, first: true,
    })
    vi.mocked(api.fetchPageStats).mockResolvedValue(mockStats)
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])

    renderPageDetail()
    await waitFor(() => {
      expect(screen.getByTestId('value-chart')).toBeInTheDocument()
    })
  })
})
