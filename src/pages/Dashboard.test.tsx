import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

vi.mock('../services/api', () => ({
  fetchPageMonitorConfigs: vi.fn(),
  fetchLatestResult: vi.fn(),
  fetchResults: vi.fn(),
}))

vi.mock('../components/PageCard', () => ({
  default: ({ pageName }: { pageName: string }) => <div data-testid="page-card">{pageName}</div>,
}))

vi.mock('../components/ValueChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid="value-chart">{title}</div>,
}))

const api = await import('../services/api')

beforeEach(() => {
  vi.mocked(api.fetchPageMonitorConfigs).mockReset()
  vi.mocked(api.fetchLatestResult).mockReset()
  vi.mocked(api.fetchResults).mockReset()
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders page cards for each config', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([
      { id: 1, name: 'Page1', url: 'http://x.com', pattern: '\\d+', cron: '0 0 * * * *', enabled: true },
      { id: 2, name: 'Page2', url: 'http://y.com', pattern: '\\d+', cron: '0 0 * * * *', enabled: true },
    ])
    vi.mocked(api.fetchLatestResult).mockResolvedValue(null)
    vi.mocked(api.fetchResults).mockResolvedValue({ content: [], pageable: { pageNumber: 0, pageSize: 50 }, totalElements: 0, totalPages: 0, last: true, first: true })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Page1')).toBeInTheDocument()
      expect(screen.getByText('Page2')).toBeInTheDocument()
    })
  })

  it('renders value charts when results exist', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([
      { id: 1, name: 'Page1', url: 'http://x.com', pattern: '\\d+', cron: '0 0 * * * *', enabled: true },
    ])
    vi.mocked(api.fetchLatestResult).mockResolvedValue(null)
    vi.mocked(api.fetchResults).mockResolvedValue({
      content: [{ id: 1, pageName: 'Page1', url: '', pattern: '', extractedValue: 42, matched: true, rawMatch: '42', checkedAt: '2026-01-01T00:00:00Z', responseTimeMs: 100, httpStatus: 200, errorMessage: null, createdAt: '2026-01-01T00:00:00Z' }],
      pageable: { pageNumber: 0, pageSize: 50 }, totalElements: 1, totalPages: 1, last: true, first: true,
    })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Page1 - Value History')).toBeInTheDocument()
    })
  })

  it('handles empty config list', async () => {
    vi.mocked(api.fetchPageMonitorConfigs).mockResolvedValue([])
    vi.mocked(api.fetchResults).mockResolvedValue({ content: [], pageable: { pageNumber: 0, pageSize: 50 }, totalElements: 0, totalPages: 0, last: true, first: true })

    renderDashboard()
    await waitFor(() => {
      expect(screen.queryByTestId('page-card')).not.toBeInTheDocument()
    })
  })
})
