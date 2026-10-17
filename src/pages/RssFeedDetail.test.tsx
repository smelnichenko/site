import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RssFeedDetail from './RssFeedDetail';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    CHART_PERIODS: actual.CHART_PERIODS,
    CHART_PERIOD_LABELS: actual.CHART_PERIOD_LABELS,
    COUNT_WINDOW_LABELS: actual.COUNT_WINDOW_LABELS,
    fetchRssResults: vi.fn(),
    fetchRssChartData: vi.fn(),
    fetchRssConfig: vi.fn(),
    triggerRssCheck: vi.fn(),
    setRssChartPeriod: vi.fn(),
  };
});

vi.mock('../components/MetricChart', () => ({
  default: ({ title }: { title: string }) => <div data-testid="metric-chart">{title}</div>,
}));

vi.mock('react-paginate', () => ({
  default: () => <div data-testid="paginate" />,
}));

const api = await import('../services/api');

beforeEach(() => {
  vi.mocked(api.fetchRssResults).mockReset();
  vi.mocked(api.fetchRssChartData).mockReset();
  vi.mocked(api.fetchRssConfig).mockReset();
  vi.mocked(api.triggerRssCheck).mockReset();
  vi.mocked(api.setRssChartPeriod).mockReset();
});

function renderDetail(feedName = 'test-feed') {
  return render(
    <MemoryRouter initialEntries={[`/rss/${feedName}`]}>
      <Routes>
        <Route path="/rss/:feedName" element={<RssFeedDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockResult = {
  id: 1,
  feedName: 'test-feed',
  url: 'http://x.com/rss',
  checkedAt: '2026-01-01T00:00:00Z',
  responseTimeMs: 150,
  httpStatus: 200,
  articleCount: 20,
  errorMessage: null,
  metricCounts: [{ collectionName: 'c1', metricName: 'AI', count: 5 }],
};

describe('RssFeedDetail', () => {
  it('shows loading state', () => {
    vi.mocked(api.fetchRssResults).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.fetchRssChartData).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.fetchRssConfig).mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays feed details with stats', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult],
      pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1,
      totalPages: 1,
      last: true,
      first: true,
    });
    vi.mocked(api.fetchRssChartData).mockResolvedValue({});
    vi.mocked(api.fetchRssConfig).mockResolvedValue([
      {
        id: 1,
        name: 'test-feed',
        url: 'http://x.com/rss',
        collections: [],
        cron: '0 0 * * * *',
        fetchContent: false,
        countWindow: '1d' as const,
        chartPeriod: '2d',
      },
    ]);

    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('test-feed')).toBeInTheDocument();
      expect(screen.getAllByText('20').length).toBeGreaterThan(0); // article count
    });
  });

  it('triggers manual check', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult],
      pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1,
      totalPages: 1,
      last: true,
      first: true,
    });
    vi.mocked(api.fetchRssChartData).mockResolvedValue({});
    vi.mocked(api.fetchRssConfig).mockResolvedValue([]);
    vi.mocked(api.triggerRssCheck).mockResolvedValue(mockResult);

    const user = userEvent.setup();
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Check Now')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Check Now'));
    expect(api.triggerRssCheck).toHaveBeenCalledWith('test-feed');
  });

  it('shows metric counts in results table', async () => {
    vi.mocked(api.fetchRssResults).mockResolvedValue({
      content: [mockResult],
      pageable: { pageNumber: 0, pageSize: 20 },
      totalElements: 1,
      totalPages: 1,
      last: true,
      first: true,
    });
    vi.mocked(api.fetchRssChartData).mockResolvedValue({});
    vi.mocked(api.fetchRssConfig).mockResolvedValue([]);

    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('AI: 5')).toBeInTheDocument();
    });
  });

  describe('chart period', () => {
    const feedConfig = {
      id: 7,
      name: 'test-feed',
      url: 'http://x.com/rss',
      collections: [{ name: 'c1', metrics: [{ name: 'AI', keywords: ['ai'] }] }],
      cron: '0 0 * * * *',
      fetchContent: false,
      countWindow: '1d' as const,
      chartPeriod: '2d' as const,
    };

    function loaded() {
      vi.mocked(api.fetchRssResults).mockResolvedValue({
        content: [mockResult],
        pageable: { pageNumber: 0, pageSize: 20 },
        totalElements: 1,
        totalPages: 1,
        last: true,
        first: true,
      });
      vi.mocked(api.fetchRssConfig).mockResolvedValue([feedConfig]);
    }

    it('shows the period kept with the feed, and keeps a new one with it, charting it at once', async () => {
      loaded();
      vi.mocked(api.fetchRssChartData)
        .mockResolvedValueOnce({ c1: [{ time: 'Oct 17 10:00', timestamp: 1, AI: 2 }] })
        .mockResolvedValueOnce({ c1: [{ time: 'Oct 11 10:00', timestamp: 0, AI: 1.5 }] });
      vi.mocked(api.setRssChartPeriod).mockResolvedValue({
        ...feedConfig,
        enabled: true,
        chartPeriod: '7d',
      });
      const user = userEvent.setup();
      renderDetail();
      const select = await screen.findByLabelText('Chart period');
      expect(select).toHaveValue('2d');

      await user.selectOptions(select, '7 days');
      expect(api.setRssChartPeriod).toHaveBeenCalledWith(7, '7d');
      await waitFor(() => expect(screen.getByLabelText('Chart period')).toHaveValue('7d'));
      expect(api.fetchRssChartData).toHaveBeenCalledTimes(2);
      expect(api.fetchRssChartData).toHaveBeenLastCalledWith('test-feed');
    });

    it('a period that cannot be saved is said, and the feed keeps its own', async () => {
      loaded();
      vi.mocked(api.fetchRssChartData).mockResolvedValue({});
      vi.mocked(api.setRssChartPeriod).mockRejectedValue(
        new Error('Failed to save the chart period'),
      );
      const user = userEvent.setup();
      renderDetail();
      const select = await screen.findByLabelText('Chart period');

      await user.selectOptions(select, '1 year');
      expect(await screen.findByText('Failed to save the chart period')).toBeInTheDocument();
      expect(screen.getByLabelText('Chart period')).toHaveValue('2d');
      expect(api.fetchRssChartData).toHaveBeenCalledTimes(1);
    });

    it("says the feed's window: the articles counted over it, and in its settings line", async () => {
      vi.mocked(api.fetchRssResults).mockResolvedValue({
        content: [mockResult],
        pageable: { pageNumber: 0, pageSize: 20 },
        totalElements: 1,
        totalPages: 1,
        last: true,
        first: true,
      });
      vi.mocked(api.fetchRssConfig).mockResolvedValue([{ ...feedConfig, countWindow: '7d' }]);
      vi.mocked(api.fetchRssChartData).mockResolvedValue({});
      renderDetail();
      expect(await screen.findByText('Articles counted (last 7 days)')).toBeInTheDocument();
      expect(screen.getByText(/Counts\s+over: 7 days/)).toBeInTheDocument();
      expect(screen.queryByText(/Max\s+articles/)).not.toBeInTheDocument();
    });

    it('offers every period, by name', async () => {
      loaded();
      vi.mocked(api.fetchRssChartData).mockResolvedValue({});
      renderDetail();
      const select = await screen.findByLabelText('Chart period');
      expect(Array.from((select as HTMLSelectElement).options).map((o) => o.text)).toEqual([
        '1 day',
        '2 days',
        '7 days',
        '30 days',
        '90 days',
        '1 year',
      ]);
    });
  });
});
