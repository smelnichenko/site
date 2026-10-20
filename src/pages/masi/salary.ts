import type { MasiJob, MasiSalaryPeriod } from '../../services/api';

/** One place for every salary figure the masi pages print: a job's, and the period statistics'. */

const PERIOD: Record<MasiSalaryPeriod, string> = {
  HOUR: 'hour',
  DAY: 'day',
  MONTH: 'month',
  YEAR: 'year',
};

const WHOLE = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "110,000"; an hourly or daily figure with cents keeps both places ("60.50"), a whole one shows none. */
export function formatAmount(n: number): string {
  return Number.isInteger(n) ? WHOLE.format(n) : CENTS.format(n);
}

/** "3,000–4,000", "from 3,000", "up to 4,000", or one figure when both ends are the same; null for no figure. */
export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) {
    return min === max ? formatAmount(min) : `${formatAmount(min)}–${formatAmount(max)}`;
  }
  if (hasMin) return `from ${formatAmount(min)}`;
  if (hasMax) return `up to ${formatAmount(max)}`;
  return null;
}

type SalaryFields = Pick<MasiJob, 'salaryMin' | 'salaryMax'> &
  Partial<
    Pick<
      MasiJob,
      'salaryCurrency' | 'salaryPeriod' | 'salaryMonthlyEurFteMin' | 'salaryMonthlyEurFteMax'
    >
  >;

/** A job's figures in the posting's own unit, and the full-time month in euros where that says more. */
export interface JobSalary {
  figures: string;
  /** "≈ 6,667–9,167 EUR / month full-time" beside an hourly, daily or yearly euro figure; null otherwise. */
  fullTime: string | null;
}

/**
 * A masi from before it read the unit sends neither salaryCurrency nor salaryPeriod (undefined, not null): its figures
 * are printed as the page always printed them, so nothing changes until the new masi is deployed.
 */
function fromOldMasi(job: SalaryFields): boolean {
  return job.salaryCurrency === undefined && job.salaryPeriod === undefined;
}

/** Null when the posting gave no figure. */
export function jobSalary(job: SalaryFields): JobSalary | null {
  if (fromOldMasi(job)) {
    return job.salaryMin || job.salaryMax
      ? { figures: `${job.salaryMin ?? '?'}–${job.salaryMax ?? '?'} EUR`, fullTime: null }
      : null;
  }
  const range = formatRange(job.salaryMin, job.salaryMax);
  if (range === null) return null;
  // half a unit is no unit: "3,000 EUR" with no period may be a year, and a figure with no currency is not euros
  if (!job.salaryCurrency || !job.salaryPeriod) {
    return { figures: `${range} (unit not stated)`, fullTime: null };
  }
  const figures = `${range} ${job.salaryCurrency} / ${PERIOD[job.salaryPeriod]}`;
  const monthly = formatRange(job.salaryMonthlyEurFteMin, job.salaryMonthlyEurFteMax);
  return {
    figures,
    fullTime:
      monthly !== null && job.salaryPeriod !== 'MONTH'
        ? `≈ ${monthly} EUR / month full-time`
        : null,
  };
}
