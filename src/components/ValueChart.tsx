import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MonitorResult } from '../services/api';

interface ValueChartProps {
  data: MonitorResult[];
  title?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ValueChart({ data, title }: ValueChartProps) {
  const chartData = data
    .filter((r) => r.matched && r.extractedValue !== null)
    .map((r) => ({
      time: formatDate(r.checkedAt),
      value: r.extractedValue,
      timestamp: new Date(r.checkedAt).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (chartData.length === 0) {
    return (
      <div className="card">
        {title && (
          <div className="card-header">
            <span className="card-title">{title}</span>
          </div>
        )}
        <div className="loading">No data available</div>
      </div>
    );
  }

  return (
    <div className="card">
      {title && (
        <div className="card-header">
          <span className="card-title">{title}</span>
        </div>
      )}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickMargin={10}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0066cc"
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ValueChart;
