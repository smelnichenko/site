import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PageCard from './PageCard'
import { MonitorResult } from '../services/api'

function renderCard(pageName: string, latestResult: MonitorResult | null) {
  return render(
    <MemoryRouter>
      <PageCard pageName={pageName} latestResult={latestResult} />
    </MemoryRouter>,
  )
}

function makeResult(overrides: Partial<MonitorResult> = {}): MonitorResult {
  return {
    id: 1,
    pageName: 'Test Page',
    url: 'http://example.com',
    pattern: String.raw`\d+`,
    extractedValue: 42,
    matched: true,
    rawMatch: '42',
    checkedAt: new Date().toISOString(),
    responseTimeMs: 200,
    httpStatus: 200,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('PageCard', () => {
  it('renders page name', () => {
    renderCard('My Monitor', null)
    expect(screen.getByText('My Monitor')).toBeInTheDocument()
  })

  it('shows extracted value for matched result', () => {
    renderCard('Test', makeResult({ extractedValue: 1234, matched: true }))
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('shows N/A when extractedValue is null but matched', () => {
    renderCard('Test', makeResult({ extractedValue: null, matched: true }))
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('shows Failed badge for unmatched result', () => {
    renderCard('Test', makeResult({ matched: false }))
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows error message when present', () => {
    renderCard('Test', makeResult({ errorMessage: 'Connection timeout' }))
    expect(screen.getByText('Connection timeout')).toBeInTheDocument()
  })

  it('shows "No data yet" when no results', () => {
    renderCard('Test', null)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('links to page detail', () => {
    renderCard('My Page', null)
    const link = screen.getByText('My Page')
    expect(link.closest('a')).toHaveAttribute('href', '/page/My%20Page')
  })

  it('renders edit link when editUrl provided', () => {
    render(
      <MemoryRouter>
        <PageCard pageName="Test" latestResult={null} editUrl="/monitors?editPage=1" />
      </MemoryRouter>,
    )
    const editLink = screen.getByText('Edit')
    expect(editLink.closest('a')).toHaveAttribute('href', '/monitors?editPage=1')
  })
})
