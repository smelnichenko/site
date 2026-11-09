import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MasiStatsDay } from '../../services/api';
import { formatUsd } from './format';

/**
 * The live stats day by day (the operator, 2026-11-08: "these should be charts"): what the tiles total, as it went. Each
 * chart has one axis; a pair of series carries a legend and its names at the lines' ends; a single series needs neither -
 * the title names it. Colours from the validated palette (ops plan 111's dataviz pass): blue first, orange second, in
 * that order on every chart. A table of the same numbers is there for a screen reader, and for anyone who wants figures.
 */
const FIRST = '#2a78d6';
const SECOND = '#eb6834';
const INK = '#666';
const GRID = '#eee';

interface Series {
  key: keyof MasiStatsDay;
  name: string;
  color: string;
}

/** "3 Nov" - the day, short: a window of a year still fits its axis. */
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/** The series' name written at its last point: a line is named where the eye ends, not only in the legend. */
function endLabel(name: string, color: string, last: number) {
  // recharts hands the label its point; only the last one is named
  return function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
    if (props.index !== last || props.x === undefined || props.y === undefined) return null;
    return (
      <text x={Number(props.x) + 6} y={Number(props.y)} dy={4} fill={INK} fontSize={12}>
        {name}
        <tspan fill={color}> ●</tspan>
      </text>
    );
  };
}

function Pair({
  title,
  days,
  series,
}: Readonly<{ title: string; days: MasiStatsDay[]; series: [Series, Series] }>) {
  const last = days.length - 1;
  return (
    <section className="card masi-daily" aria-label={`${title} per day`}>
      <div className="card-title">{title} per day</div>
      <div className="masi-daily-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ top: 8, right: 64, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              tick={{ fontSize: 12, fill: INK }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: INK }}
              width={40}
              domain={[0, 'auto']}
            />
            <Tooltip
              labelFormatter={(d) => dayLabel(String(d))}
              cursor={{ stroke: INK, strokeDasharray: '3 3' }}
            />
            {/* the series' own order, blue first: recharts sorts a legend by name unless told not to */}
            <Legend verticalAlign="top" height={24} iconType="plainline" itemSorter={null} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={days.length <= 31 ? { r: 4, strokeWidth: 2, fill: '#fff' } : false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                label={endLabel(s.name, s.color, last)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Single({
  title,
  days,
  dataKey,
  usd,
}: Readonly<{ title: string; days: MasiStatsDay[]; dataKey: keyof MasiStatsDay; usd?: boolean }>) {
  return (
    <section className="card masi-daily" aria-label={`${title} per day`}>
      <div className="card-title">{title} per day</div>
      <div className="masi-daily-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              tick={{ fontSize: 12, fill: INK }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={Boolean(usd)}
              tickFormatter={(v: number) => (usd ? formatUsd(v) : String(v))}
              tick={{ fontSize: 12, fill: INK }}
              width={usd ? 56 : 40}
              domain={[0, 'auto']}
            />
            <Tooltip
              labelFormatter={(d) => dayLabel(String(d))}
              formatter={(v) => (usd ? formatUsd(Number(v)) : String(v))}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Bar
              dataKey={dataKey}
              name={title}
              fill={FIRST}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default function DailyCharts({ days }: Readonly<{ days: MasiStatsDay[] }>) {
  if (days.length === 0) return null;
  return (
    <div className="masi-daily-charts">
      <div className="grid masi-daily-grid">
        <Pair
          title="Jobs"
          days={days}
          series={[
            { key: 'newJobs', name: 'new', color: FIRST },
            { key: 'closedJobs', name: 'closed', color: SECOND },
          ]}
        />
        <Pair
          title="Listings"
          days={days}
          series={[
            { key: 'newListings', name: 'new', color: FIRST },
            { key: 'closedListings', name: 'closed', color: SECOND },
          ]}
        />
        <Single title="Your applications" days={days} dataKey="applied" />
        <Single title="LLM spend" days={days} dataKey="llmUsd" usd />
      </div>
      <details className="masi-daily-table">
        <summary>The days as a table</summary>
        <div className="masi-table-scroll">
          <table className="table">
            <caption className="sr-only">The live stats day by day</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>New jobs</th>
                <th>Closed jobs</th>
                <th>Reposted</th>
                <th>New listings</th>
                <th>Closed listings</th>
                <th>Applied</th>
                <th>LLM spend</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td>{dayLabel(d.day)}</td>
                  <td>{d.newJobs}</td>
                  <td>{d.closedJobs}</td>
                  <td>{d.repostedJobs}</td>
                  <td>{d.newListings}</td>
                  <td>{d.closedListings}</td>
                  <td>{d.applied}</td>
                  <td>{formatUsd(d.llmUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
