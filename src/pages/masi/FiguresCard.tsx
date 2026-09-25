import { useEffect, useMemo, useState } from 'react';
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
import { fetchMasiCompanyFigures, MasiCompany, MasiCompanyFigures } from '../../services/api';
import { errorMessage, formatDate } from './format';
import { formatEuros, formatTick, latest, QuarterRow, quarterRows } from './figures';

const COLOURS = {
  employees: '#0066cc',
  turnover: '#2e7d32',
  stateTaxes: '#6a4c9c',
  labourTaxes: '#c77700',
};

const euros = (v: unknown) => formatEuros(typeof v === 'number' ? v : null);

interface Props {
  company: MasiCompany;
}

/**
 * How the company is doing, by quarter, from the Tax and Customs Board's open data: employees, turnover, and the taxes
 * it paid. Nothing without a registry code, and no card when the board's files never had the company. A figure the
 * board left empty is a gap in the chart, never a zero.
 */
export default function FiguresCard({ company }: Readonly<Props>) {
  const [figures, setFigures] = useState<MasiCompanyFigures | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const coded = company.registryCode !== null;

  useEffect(() => {
    if (!coded) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const f = await fetchMasiCompanyFigures(company.id, controller.signal);
        setFigures(f);
        setMessage(null);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setMessage(errorMessage(e, 'Failed to load the figures'));
      }
    })();
    return () => controller.abort();
  }, [company.id, coded]);

  const rows = useMemo(() => quarterRows(figures?.quarters ?? []), [figures]);

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
  return (
    <div className="card masi-figures-card">
      <div className="card-header">
        <span className="card-title">Figures</span>
        <span className="card-header-aside">
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatTick}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip />
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                <Tooltip formatter={euros} />
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
            <ResponsiveContainer width="100%" height="100%">
              {/* side by side, not stacked: the board's two sums overlap (income and social tax are in both) */}
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                <Tooltip formatter={euros} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
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
              <td>{formatEuros(r.turnover)}</td>
              <td>{formatEuros(r.stateTaxes)}</td>
              <td>{formatEuros(r.labourTaxes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
