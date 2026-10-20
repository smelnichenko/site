import { Fragment, useId } from 'react';
import type { MasiEmploymentType, MasiJob } from '../../services/api';
import { jobSalary } from './salary';

const EMPLOYMENT: Record<MasiEmploymentType, string> = {
  PERMANENT: 'permanent',
  FIXED_TERM: 'fixed-term',
  CONTRACT: 'contract',
  FREELANCE: 'freelance',
  INTERNSHIP: 'internship',
  PART_TIME: 'part-time',
};

/** The form of work as a reader says it; a value this page does not know yet is shown as masi sent it. */
function employmentLabel(type: string): string {
  return EMPLOYMENT[type as MasiEmploymentType] ?? type.toLowerCase().replaceAll('_', ' ');
}

/** "Estonia" for EE; the code itself where the browser has no name for it. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * What the posting states beside its title: the pay in its own unit (and as a full-time month in euros where that
 * differs), the form of work, the country, where remote work may be done from. Only what was stated; nothing at all
 * when nothing was. Each figure is named by its term (aria-labelledby), so a reader hears "Salary, 3,000–4,000 EUR".
 */
export default function JobTerms({ job }: Readonly<{ job: MasiJob }>) {
  const id = useId();
  const salary = jobSalary(job);
  const rows: Array<{ key: string; term: string; value: string }> = [];
  if (job.employmentType) {
    rows.push({
      key: 'employment',
      term: 'Employment',
      value: employmentLabel(job.employmentType),
    });
  }
  if (job.country) {
    rows.push({ key: 'country', term: 'Country', value: countryName(job.country) });
  }
  if (job.remoteScope) {
    rows.push({ key: 'remote', term: 'Remote from', value: job.remoteScope });
  }
  if (!salary && rows.length === 0) return null;
  return (
    <dl className="masi-terms">
      {salary && (
        <>
          <dt id={`${id}-salary`}>Salary</dt>
          <dd aria-labelledby={`${id}-salary`}>{salary.figures}</dd>
          {salary.fullTime && (
            <dd className="muted" aria-label="Full-time monthly equivalent">
              {salary.fullTime}
            </dd>
          )}
        </>
      )}
      {rows.map((r) => (
        <Fragment key={r.key}>
          <dt id={`${id}-${r.key}`}>{r.term}</dt>
          <dd aria-labelledby={`${id}-${r.key}`}>{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
