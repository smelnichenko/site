import { useEffect, useId, useMemo, useState } from 'react';
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
  YearRow,
  yearRows,
  yearTicks,
} from './figures';

const COLOURS = {
  employees: '#0066cc',
  turnover: '#2e7d32',
  stateTaxes: '#6a4c9c',
  labourTaxes: '#c77700',
  /** the annual reports' headcount: a hue of its own, dashed, held across each year — not a paler employees blue */
  annual: '#b35900',
  /** a tint of the profit blue: to a colour-blind reader the ochre it replaced was the revenue green */
  operatingProfit: '#5b8ac2',
  profit: '#1f4e79',
};

/** A tooltip's figure, to the euro. */
const euros = (v: unknown) => formatEurosExact(typeof v === 'number' ? v : null);
const TEXT = { color: '#333' };
/** The taxes' tooltip lists them in the bars' order, left to right. */
const TAXES = ['stateTaxes', 'labourTaxes'];
const barOrder = (item: { dataKey?: unknown }) => TAXES.indexOf(String(item.dataKey));
/** The employees' tooltip likewise. */
const HEADS = ['employees', 'annualEmployees'];
const headOrder = (item: { dataKey?: unknown }) => HEADS.indexOf(String(item.dataKey));
/** The years' tooltip likewise. */
const YEAR_FIGURES = ['revenue', 'operatingProfit', 'profit'];
const yearOrder = (item: { dataKey?: unknown }) => YEAR_FIGURES.indexOf(String(item.dataKey));
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
 * How the company is doing: by quarter from the Tax and Customs Board's open data — employees, turnover, the taxes it
 * paid — and by financial year from its annual reports to the e-Business Register — revenue, operating profit, profit
 * and the average headcount. Nothing without a registry code, and no card when neither source has the company. A
 * figure a source left empty is a gap in the chart, never a zero.
 */
export default function FiguresCard({ company }: Readonly<Props>) {
  // what was loaded, and for which company: a company the page moved on from shows nothing of its own while the next
  // one loads, and no reset is written inside the effect
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const ids = useId();
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
  const rows = useMemo(() => quarterRows(figures?.quarters ?? [], figures?.years ?? []), [figures]);
  const years = useMemo(() => yearRows(figures?.years ?? []), [figures]);
  const employees = useMemo(
    () =>
      employeeAxis(
        Math.max(0, ...rows.map((r) => Math.max(r.employees ?? 0, r.annualEmployees ?? 0))),
      ),
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
  if (rows.length === 0 && years.length === 0) return null;
  const quarterly = (figures?.quarters.length ?? 0) > 0;
  const annualHeads = rows.some((r) => r.annualEmployees !== null);
  const tooltip = { itemStyle: TEXT, contentStyle: { fontSize: 12 } };

  // ISO dates sort as text: the newest file is the last
  const dates = (figures?.quarters ?? [])
    .map((q) => q.published)
    .sort((a, b) => a.localeCompare(b));
  const published = dates[dates.length - 1];
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
          {/* one span a source: a narrow card breaks between them, not inside a date */}
          {quarterly && (
            <span>Tax and Customs Board, by quarter · file of {formatDate(published)}</span>
          )}
          {years.length > 0 && <span>e-Business Register annual reports</span>}
        </span>
      </div>
      <Latest rows={quarterly ? rows : []} years={years} />
      {quarterly && (
        <div className="masi-figures">
          {/* each chart is named by its caption and drawn for the eye only: its figures are the table below */}
          <figure aria-labelledby={`${ids}-employees`}>
            <figcaption id={`${ids}-employees`}>Employees</figcaption>
            <div className="masi-figures-chart" aria-hidden="true">
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
                  {/* in the lines' order: the quarterly count first, the annual average after it */}
                  <Tooltip {...tooltip} itemSorter={headOrder} />
                  {annualHeads && (
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      itemSorter={null}
                      formatter={legendText}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="employees"
                    name="Employees"
                    stroke={COLOURS.employees}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                    legendType="plainline"
                    isAnimationActive={false}
                  />
                  {/* a year's average held across its four quarters: a dashed step in a hue of its own, which the
                      legend shows dashed — it runs close to the count, and a paler blue vanished into it */}
                  {annualHeads && (
                    <Line
                      type="stepAfter"
                      dataKey="annualEmployees"
                      name="Annual average (FTE)"
                      stroke={COLOURS.annual}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls={false}
                      legendType="plainline"
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <figure aria-labelledby={`${ids}-turnover`}>
            <figcaption id={`${ids}-turnover`}>Turnover (€)</figcaption>
            <div className="masi-figures-chart" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
                <BarChart data={rows} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis {...xAxis} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                  <ReferenceLine y={0} stroke="#999" />
                  <Tooltip {...tooltip} formatter={euros} />
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
          <figure aria-labelledby={`${ids}-taxes`}>
            <figcaption id={`${ids}-taxes`}>Taxes paid (€)</figcaption>
            <div className="masi-figures-chart" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
                {/* side by side, not stacked: the board's two sums overlap (income and social tax are in both) */}
                <BarChart data={rows} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis {...xAxis} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                  <ReferenceLine y={0} stroke="#999" />
                  {/* in the bars' order, and in text colour: the orange is a bar's colour, too light for words */}
                  <Tooltip {...tooltip} formatter={euros} itemSorter={barOrder} />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    itemSorter={null}
                    formatter={legendText}
                  />
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
      )}
      {years.length > 0 && (
        <figure className="masi-figures-years" aria-labelledby={`${ids}-years`}>
          <figcaption id={`${ids}-years`}>Revenue and profit by financial year (€)</figcaption>
          <div className="masi-figures-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" initialDimension={FIRST_SIZE}>
              {/* a few years across the card's width: bars no wider than a quarter's would be read as such */}
              <BarChart data={years} accessibilityLayer={false} maxBarSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                {/* many years on a phone: every label that fits, the first and the last always */}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTick} width={44} />
                <ReferenceLine y={0} stroke="#999" />
                <Tooltip {...tooltip} formatter={euros} itemSorter={yearOrder} />
                <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} formatter={legendText} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill={COLOURS.turnover}
                  minPointSize={2}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="operatingProfit"
                  name="Operating profit"
                  fill={COLOURS.operatingProfit}
                  minPointSize={2}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="profit"
                  name="Profit"
                  fill={COLOURS.profit}
                  minPointSize={2}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
      {quarterly && <QuarterTable rows={rows} />}
      {years.length > 0 && <YearTable years={years} />}
    </div>
  );
}

/**
 * The latest of each figure with its quarter or year — they need not be the same period: a bank never has a turnover,
 * and the annual reports come a year behind the quarters. A source without the company shows nothing of its own; the
 * headcount comes from the annual reports when the board has no quarters.
 */
function Latest({ rows, years }: Readonly<{ rows: QuarterRow[]; years: YearRow[] }>) {
  const employees = latest(rows, (r) => r.employees);
  const turnover = latest(rows, (r) => r.turnover);
  const taxes = latest(rows, (r) => r.stateTaxes);
  const revenue = latest(years, (y) => y.revenue);
  const profit = latest(years, (y) => y.profit);
  const fte = latest(years, (y) => y.avgEmployees);
  return (
    <dl className="masi-figures-latest">
      {rows.length > 0 && (
        <>
          <div>
            <dt>Employees</dt>
            <dd>{employees ? `${employees.value} (${employees.label})` : 'not published'}</dd>
          </div>
          <div>
            <dt>Turnover</dt>
            <dd>
              {turnover ? `${formatEuros(turnover.value)} (${turnover.label})` : 'not published'}
            </dd>
          </div>
          <div>
            <dt>State taxes</dt>
            <dd>{taxes ? `${formatEuros(taxes.value)} (${taxes.label})` : 'not published'}</dd>
          </div>
        </>
      )}
      {years.length > 0 && (
        <>
          {rows.length === 0 && (
            <div>
              <dt>Employees (FTE)</dt>
              <dd>{fte ? `${fte.value} (${fte.label})` : 'not reported'}</dd>
            </div>
          )}
          <div>
            <dt>Revenue</dt>
            <dd>{revenue ? `${formatEuros(revenue.value)} (${revenue.label})` : 'not reported'}</dd>
          </div>
          <div>
            <dt>Profit</dt>
            <dd>{profit ? `${formatEuros(profit.value)} (${profit.label})` : 'not reported'}</dd>
          </div>
        </>
      )}
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

/** The annual reports' figures as a table, for a screen reader, hidden the same way as the quarters'. */
function YearTable({ years }: Readonly<{ years: YearRow[] }>) {
  return (
    <div className="sr-only">
      <table>
        <caption>Figures by financial year</caption>
        <thead>
          <tr>
            <th scope="col">Financial year to</th>
            <th scope="col">Revenue</th>
            <th scope="col">Operating profit</th>
            <th scope="col">Profit</th>
            <th scope="col">Employees (FTE)</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.label}>
              <th scope="row">{y.label}</th>
              <td>{formatEurosExact(y.revenue)}</td>
              <td>{formatEurosExact(y.operatingProfit)}</td>
              <td>{formatEurosExact(y.profit)}</td>
              <td>{y.avgEmployees ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
