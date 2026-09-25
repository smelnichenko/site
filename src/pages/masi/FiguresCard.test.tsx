import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import FiguresCard from './FiguresCard';
import * as api from '../../services/api';
import type { MasiCompany } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiCompanyFigures: vi.fn(),
}));

// recharts measures a container jsdom never lays out: each chart stands in as the series it draws
vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Series = ({ name }: { name: string }) => <span>series {name}</span>;
  return {
    ResponsiveContainer: Box,
    LineChart: Box,
    BarChart: Box,
    Line: Series,
    Bar: Series,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  };
});

const company = (registryCode: string | null) =>
  ({ id: 7, name: 'Nortal AS', registryCode }) as unknown as MasiCompany;

const quarter = (
  year: number,
  q: number,
  rest: Partial<api.MasiQuarterFigures> = {},
): api.MasiQuarterFigures => ({
  year,
  quarter: q,
  published: '2026-07-10',
  ...rest,
});

/** NORTAL AS's last three quarters, each from the file it was first published in. */
const nortal = [
  quarter(2025, 4, {
    turnover: 55_102_823,
    employees: 357,
    stateTaxes: 3_884_926,
    labourTaxes: 2_825_625,
    published: '2026-01-10',
  }),
  quarter(2026, 1, {
    turnover: 64_852_805,
    employees: 367,
    stateTaxes: 4_545_083,
    labourTaxes: 2_770_242,
    published: '2026-07-10',
  }),
  quarter(2026, 2, {
    turnover: 14_920_312,
    employees: 356,
    stateTaxes: 3_676_181,
    labourTaxes: 2_762_582,
    published: '2026-04-10',
  }),
];

const other = (id: number) =>
  ({ id, name: `Company ${id}`, registryCode: `1${id}000000` }) as unknown as MasiCompany;

beforeEach(() => {
  vi.mocked(api.fetchMasiCompanyFigures).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FiguresCard', () => {
  it('asks nothing and shows nothing for a company without a registry code', () => {
    const { container } = render(<FiguresCard company={company(null)} />);
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchMasiCompanyFigures).not.toHaveBeenCalled();
  });

  it('shows no card when the board has no figures for the company', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({ quarters: [] });
    const { container } = render(<FiguresCard company={company('10391131')} />);
    await vi.waitFor(() =>
      expect(api.fetchMasiCompanyFigures).toHaveBeenCalledWith(7, expect.any(AbortSignal)),
    );
    // the answer is in and drawn: before it, the card is empty whatever the answer
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('charts employees, turnover and both taxes by quarter, with the latest of each and the source', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({
      quarters: [
        quarter(2025, 4, {
          turnover: 55_102_823,
          employees: 357,
          stateTaxes: 3_884_926,
          labourTaxes: 2_825_625,
        }),
        quarter(2026, 2, {
          turnover: 14_920_312,
          employees: 356,
          stateTaxes: 3_676_181,
          labourTaxes: 2_762_582,
        }),
      ],
    });
    render(<FiguresCard company={company('10391131')} />);

    expect(await screen.findByText('Figures')).toBeInTheDocument();
    expect(
      screen.getByText(/Tax and Customs Board, by quarter · file of 10 Jul 2026/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Employees by quarter, 2025 Q4 to 2026 Q2' }),
    ).toHaveTextContent('series Employees');
    expect(
      screen.getByRole('img', { name: 'Turnover by quarter, 2025 Q4 to 2026 Q2' }),
    ).toHaveTextContent('series Turnover');
    const taxes = screen.getByRole('img', { name: 'Taxes paid by quarter, 2025 Q4 to 2026 Q2' });
    expect(taxes).toHaveTextContent('series State taxes');
    expect(taxes).toHaveTextContent('series Labour taxes');
    expect(screen.getByText('356 (2026 Q2)')).toBeInTheDocument();
    expect(screen.getByText('14.9M € (2026 Q2)')).toBeInTheDocument();

    // the quarter between the two is on the axis as a gap, and in the table a screen reader reads
    const table = screen.getByRole('table', { name: 'Figures by quarter' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      '2025 Q4',
      '2026 Q1',
      '2026 Q2',
    ]);
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['—', '—', '—', '—']);
    // to the euro in the table: a screen reader has no tooltip to hover for the exact figure
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['357', '55,102,823 €', '3,884,926 €', '2,825,625 €']);
  });

  it('says a figure the board never published is not published, not zero — a bank has no turnover', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({
      quarters: [
        quarter(2025, 1, { employees: 1443, stateTaxes: 20_000_000, labourTaxes: 15_000_000 }),
      ],
    });
    render(<FiguresCard company={company('10060701')} />);
    await screen.findByText('Figures');
    const [, turnover] = screen.getAllByRole('definition'); // employees, turnover, state taxes
    expect(turnover).toHaveTextContent('not published');
    expect(screen.getByText('1443 (2025 Q1)')).toBeInTheDocument();
  });

  it('says so when the figures cannot be loaded', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockRejectedValue(
      new Error('Failed to load the figures: 503'),
    );
    render(<FiguresCard company={company('10391131')} />);
    expect(await screen.findByText('Failed to load the figures: 503')).toBeInTheDocument();
  });

  it('names the newest file its quarters came from, and the latest of each figure', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({ quarters: nortal });
    render(<FiguresCard company={company('10391131')} />);
    expect(await screen.findByText(/file of 10 Jul 2026/)).toBeInTheDocument();
    const [employees, turnover, taxes] = screen.getAllByRole('definition');
    expect(employees).toHaveTextContent('356 (2026 Q2)');
    expect(turnover).toHaveTextContent('14.9M € (2026 Q2)');
    expect(taxes).toHaveTextContent('3.7M € (2026 Q2)');
  });

  it('asks for the figures once a placement gives the company its code', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValue({ quarters: nortal });
    const { rerender } = render(<FiguresCard company={company(null)} />);
    expect(api.fetchMasiCompanyFigures).not.toHaveBeenCalled();
    rerender(<FiguresCard company={company('10391131')} />);
    expect(await screen.findByText('356 (2026 Q2)')).toBeInTheDocument();
  });

  it('never shows the company it showed before while the next one loads, nor its error', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockResolvedValueOnce({ quarters: nortal });
    const { rerender } = render(<FiguresCard company={company('10391131')} />);
    await screen.findByText('356 (2026 Q2)');
    vi.mocked(api.fetchMasiCompanyFigures).mockReturnValueOnce(new Promise(() => {}));
    rerender(<FiguresCard company={other(8)} />);
    await vi.waitFor(() =>
      expect(api.fetchMasiCompanyFigures).toHaveBeenCalledWith(8, expect.any(AbortSignal)),
    );
    expect(screen.queryByText('356 (2026 Q2)')).not.toBeInTheDocument();

    vi.mocked(api.fetchMasiCompanyFigures).mockRejectedValueOnce(
      new Error('Failed to load the figures: 503'),
    );
    rerender(<FiguresCard company={other(9)} />);
    await screen.findByText('Failed to load the figures: 503');
    vi.mocked(api.fetchMasiCompanyFigures).mockReturnValueOnce(new Promise(() => {}));
    rerender(<FiguresCard company={other(10)} />);
    await vi.waitFor(() =>
      expect(api.fetchMasiCompanyFigures).toHaveBeenCalledWith(10, expect.any(AbortSignal)),
    );
    expect(screen.queryByText('Failed to load the figures: 503')).not.toBeInTheDocument();
  });

  it('cancels the request for the company it leaves', async () => {
    vi.mocked(api.fetchMasiCompanyFigures).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<FiguresCard company={company('10391131')} />);
    await vi.waitFor(() => expect(api.fetchMasiCompanyFigures).toHaveBeenCalledTimes(1));
    const [, first] = vi.mocked(api.fetchMasiCompanyFigures).mock.calls[0];
    rerender(<FiguresCard company={other(8)} />);
    await vi.waitFor(() => expect(api.fetchMasiCompanyFigures).toHaveBeenCalledTimes(2));
    expect(first?.aborted).toBe(true);
  });
});
