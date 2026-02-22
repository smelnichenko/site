import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ValueChart from './ValueChart'
import { MonitorResult } from '../services/api'

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function makeResult(overrides: Partial<MonitorResult> = {}): MonitorResult {
  return {
    id: 1,
    pageName: 'Test',
    url: 'http://example.com',
    pattern: '\\d+',
    extractedValue: 100,
    matched: true,
    rawMatch: '100',
    checkedAt: '2025-01-15T10:00:00Z',
    responseTimeMs: 200,
    httpStatus: 200,
    errorMessage: null,
    createdAt: '2025-01-15T10:00:00Z',
    ...overrides,
  }
}

describe('ValueChart', () => {
  it('renders chart with matched results', () => {
    const data = [
      makeResult({ id: 1, extractedValue: 100, checkedAt: '2025-01-15T10:00:00Z' }),
      makeResult({ id: 2, extractedValue: 200, checkedAt: '2025-01-15T11:00:00Z' }),
    ]
    render(<ValueChart data={data} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows "No data available" when all results are unmatched', () => {
    const data = [
      makeResult({ matched: false, extractedValue: null }),
    ]
    render(<ValueChart data={data} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('shows title when provided', () => {
    render(<ValueChart data={[]} title="My Chart" />)
    expect(screen.getByText('My Chart')).toBeInTheDocument()
  })
})
