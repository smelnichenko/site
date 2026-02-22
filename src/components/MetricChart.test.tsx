import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MetricChart from './MetricChart'

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('MetricChart', () => {
  it('renders chart with data', () => {
    const data = [
      { time: 'Jan 15', timestamp: 1705300800000, AI: 5, ML: 3 },
      { time: 'Jan 16', timestamp: 1705387200000, AI: 8, ML: 2 },
    ]
    render(<MetricChart data={data} metrics={['AI', 'ML']} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows "No data available" for empty data', () => {
    render(<MetricChart data={[]} metrics={['AI']} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})
