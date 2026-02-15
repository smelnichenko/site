import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MetricChartPoint } from '../services/api';

interface MetricChartProps {
  data: MetricChartPoint[];
  metrics: string[];
  title?: string;
}

const COLORS = [
  '#0066cc',
  '#dc3545',
  '#28a745',
  '#ffc107',
  '#6610f2',
  '#fd7e14',
  '#20c997',
  '#e83e8c',
];

function MetricChart({ data, metrics, title }: MetricChartProps) {
  if (data.length === 0) {
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
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickMargin={10}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <Legend />
            {metrics.map((metric, index) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                name={metric}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(MetricChart);
