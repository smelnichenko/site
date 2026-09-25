import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchMasiCompanyFigures, MasiCompany, MasiCompanyFigures } from '../../services/api';
import { errorMessage, formatDate } from './format';
import {
  formatEuros,
  employeeAxis,
  formatEurosExact,
  formatTick,
  latest,
  QuarterRow,
  quarterRows,
  quarterTick,
  yearTicks,
} from './figures';

const COLOURS = {
  employees: '#0066cc',
  turnover: '#2e7d32',
  stateTaxes: '#6a4c9c',
  labourTaxes: '#c77700',
};

/** A tooltip's figure, to the euro. */
const euros = (v: unknown) => formatEurosExact(typeof v === 'number' ? v : null);
const TEXT = { color: '#333' };
/** The taxes' tooltip lists them in the bars' order, left to right. */
const TAXES = ['stateTaxes', 'labourTaxes'];
const barOrder = (item: { dataKey?: unknown }) => TAXES.indexOf(String(item.dataKey));
const legendText = (value: string) => <span style={TEXT}>{value}</span>;
/** What a chart is drawn at before its box is measured: the box's own height, so the first frame is not 0 or -1. */
const FIRST_SIZE = { width: 300, height: 220 };
/** Half a bar chart's quarter, in px at the phone's width: the line's points line up with the bars under them. */
const BAND_HALF = 8;

interface Props {
  company: MasiCompany;
}

/** The answer for one company: its figures, or why they could not be loaded. */
interface Loaded {
  id: number;
  figures?: MasiCompanyFigures;
  message?: string;
}

/**
 * How the company is doing, by quarter, from the Tax and Customs Board's open data: employees, turnover, and the taxes
 * it paid. Nothing without a registry code, and no card when the board's files never had the company. A figure the
 * board left empty is a gap in the chart, never a zero.
 */
export default function FiguresCard({ company }: Readonly<Props>) {
  // what was loaded, and for which company: a company the page moved on from shows nothing of its own while the next
  // one loads, and no reset is written inside the effect
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const coded = company.registryCode !== null;

  useEffect(() => {
    if (!coded) return;
    const id = company.id;
    const controller = new AbortController();
    void (async () => {
      try {
        setLoaded({ id, figures: await fetchMasiCompanyFigures(id, controller.signal) });
      } catch (e: unknown) {
        if (!controller.signal.aborted) {
          setLoaded({ id, message: errorMessage(e, 'Failed to load the figures') });
        }
      }
    })();
    return () => controller.abort();
  }, [company.id, coded]);

  const current = loaded?.id === company.id ? loaded : null;
  const figures = current?.figures ?? null;
  const message = current?.message ?? null;
  const rows = useMemo(() => quarterRows(figures?.quarters ?? []), [figures]);
  const employees = useMemo(
    () => employeeAxis(Math.max(0, ...rows.map((r) => r.employees ?? 0))),
    [rows],
  );

  if (!coded) return null;
  if (message) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Figures</span>
        </div>
        <div className="error">{message}</div>
      </div>
    );
  }
  if (rows.length === 0) return null;

  // ISO dates: the latest is the greatest string
  const published = (figures?.quarters ?? []).reduce(
    (a, q) => (q.published > a ? q.published : a),
    '',
  );
  const span = `${rows[0].label} to ${rows[rows.length - 1].label}`;
  const xAxis = {
    dataKey: 'label',
    ticks: yearTicks(rows),
    tickFormatter: quarterTick,
    tick: { fontSize: 11 },
  };
  return (
    <div className="card masi-figures-card">
      <div className="card-header">
        <span className="card-title">Figures</span>
        <span className="card-header-aside muted">
          Tax and Customs Board, by quarter · file of {formatDate(published)}
        </span>
      </div>
      <Latest rows={rows} />
      <div className="masi-figures">
        <figure>
          <figcaption>Employees</figcaption>
          <div
            className="masi-figures-chart"
            role="img"
            aria-label={`Employees by quarter, ${span}`}
          >
            <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
              {/* no keyboard layer: the chart is a picture here, its figures are the table a screen reader reads */}
              <LineChart data={rows} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                {/* the points sit in the middle of each quarter, as the bars below them do */}
                <XAxis {...xAxis} padding={{ left: BAND_HALF, right: BAND_HALF }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatTick}
                  width={44}
                  ticks={employees}
                  domain={[0, employees[employees.length - 1]]}
                />
                <Tooltip itemStyle={TEXT} />
                <Line
                  type="monotone"
                  dataKey="employees"
                  name="Employees"
                  stroke={COLOURS.employees}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure>
          <figcaption>Turnover (€)</figcaption>
          <div
            className="masi-figures-chart"
            role="img"
            aria-label={`Turnover by quarter, ${span}`}
          >
            <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
              <BarChart data={rows} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis {...xAxis} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                <ReferenceLine y={0} stroke="#999" />
                <Tooltip formatter={euros} itemStyle={TEXT} />
                <Bar
                  dataKey="turnover"
                  name="Turnover"
                  fill={COLOURS.turnover}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure>
          <figcaption>Taxes paid (€)</figcaption>
          <div
            className="masi-figures-chart"
            role="img"
            aria-label={`Taxes paid by quarter, ${span}`}
          >
            <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
              {/* side by side, not stacked: the board's two sums overlap (income and social tax are in both) */}
              <BarChart data={rows} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis {...xAxis} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                <ReferenceLine y={0} stroke="#999" />
                {/* in the bars' order, and in text colour: the orange is a bar's colour, too light for words */}
                <Tooltip formatter={euros} itemStyle={TEXT} itemSorter={barOrder} />
                <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} formatter={legendText} />
                <Bar
                  dataKey="stateTaxes"
                  name="State taxes"
                  fill={COLOURS.stateTaxes}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="labourTaxes"
                  name="Labour taxes"
                  fill={COLOURS.labourTaxes}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>
      <QuarterTable rows={rows} />
    </div>
  );
}

/** The latest of each figure with its quarter — they need not be the same quarter: a bank never has a turnover. */
function Latest({ rows }: Readonly<{ rows: QuarterRow[] }>) {
  const employees = latest(rows, 'employees');
  const turnover = latest(rows, 'turnover');
  const taxes = latest(rows, 'stateTaxes');
  return (
    <dl className="masi-figures-latest">
      <div>
        <dt>Employees</dt>
        <dd>{employees ? `${employees.value} (${employees.label})` : 'not published'}</dd>
      </div>
      <div>
        <dt>Turnover</dt>
        <dd>{turnover ? `${formatEuros(turnover.value)} (${turnover.label})` : 'not published'}</dd>
      </div>
      <div>
        <dt>State taxes</dt>
        <dd>{taxes ? `${formatEuros(taxes.value)} (${taxes.label})` : 'not published'}</dd>
      </div>
    </dl>
  );
}

/**
 * The charts' data as a table, for a screen reader: a chart is a picture to one. Hidden by a wrapper, not on the table:
 * a table is as wide as its cells whatever width it is given, and would push the page sideways on a phone.
 */
function QuarterTable({ rows }: Readonly<{ rows: QuarterRow[] }>) {
  return (
    <div className="sr-only">
      <table>
        <caption>Figures by quarter</caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Employees</th>
            <th scope="col">Turnover</th>
            <th scope="col">State taxes</th>
            <th scope="col">Labour taxes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.employees ?? '—'}</td>
              <td>{formatEurosExact(r.turnover)}</td>
              <td>{formatEurosExact(r.stateTaxes)}</td>
              <td>{formatEurosExact(r.labourTaxes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
