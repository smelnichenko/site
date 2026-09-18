import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PackagePanel from './PackagePanel';
import { prepared } from './testUtils';

vi.mock('../../services/api', () => ({
  reviewMasiPackage: vi.fn(),
  regenerateMasiPackage: vi.fn(),
  fetchMasiArtifact: vi.fn(),
}));

/** What each state offers and withholds — the transitions masi's backend would refuse are never shown. */
describe('PackagePanel', () => {
  it('a PREPARING package offers nothing but its notes', () => {
    render(
      <PackagePanel
        pkg={{
          ...prepared,
          status: 'PREPARING',
          tunedCv: null,
          coverLetter: null,
          claims: null,
          lint: null,
          artifacts: [],
        }}
        onChanged={() => undefined}
      />,
    );
    for (const name of [
      'Skip',
      'Regenerate',
      'Mark reviewed',
      'Mark applied',
      'Save response',
      'Open CV PDF',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('claims-clean')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employer response')).not.toBeInTheDocument();
  });

  it('a PREPARED package offers review, apply, skip and regenerate, never a response', () => {
    render(<PackagePanel pkg={prepared} onChanged={() => undefined} />);
    for (const name of [
      'Mark reviewed',
      'Mark applied',
      'Skip',
      'Regenerate',
      'Open CV PDF',
      'Download letter',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Save response' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employer response')).not.toBeInTheDocument();
    expect(screen.getByTestId('claims-clean')).toBeInTheDocument();
  });

  it('an APPLIED package offers the response and nothing that would undo the application', () => {
    render(
      <PackagePanel
        pkg={{ ...prepared, status: 'APPLIED', appliedAt: '2026-09-18T10:00:00Z' }}
        onChanged={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save response' })).toBeInTheDocument();
    expect(screen.getByLabelText('Employer response')).toBeInTheDocument();
    for (const name of ['Skip', 'Regenerate', 'Mark reviewed', 'Mark applied']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('violations hide the clean badge, an unavailable PDF hides its button, a closed job hides Regenerate', () => {
    render(
      <PackagePanel
        pkg={{
          ...prepared,
          status: 'FAILED_GUARD',
          claims: [{ rule: 'skills', detail: "'Rust' is not in the master" }],
          artifacts: [{ ...prepared.artifacts[0], available: false }],
        }}
        onChanged={() => undefined}
        jobOpen={false}
      />,
    );
    expect(screen.queryByTestId('claims-clean')).not.toBeInTheDocument();
    expect(screen.getByTestId('claims')).toHaveTextContent("'Rust' is not in the master");
    expect(screen.queryByRole('button', { name: 'Open CV PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });
});
