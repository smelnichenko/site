import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PackagePanel from './PackagePanel';
import { prepared } from './testUtils';

vi.mock('../../services/api', () => ({
  reviewMasiPackage: vi.fn(),
  regenerateMasiPackage: vi.fn(),
  fetchMasiArtifact: vi.fn(),
  // sending switched off in masi (404): the panels offer no Send, as before it existed
  fetchMasiSendPreview: vi.fn().mockResolvedValue(null),
  fetchMasiPackageSend: vi.fn().mockResolvedValue(null),
  sendMasiPackage: vi.fn(),
}));

/** What each state offers and withholds — the transitions masi's backend would refuse are never shown. */
describe('PackagePanel', () => {
  it('regenerates a package in the language the operator asked for before, unless they change it', async () => {
    const api = await import('../../services/api');
    vi.mocked(api.regenerateMasiPackage).mockResolvedValue({ ...prepared, status: 'NEW' });
    render(<PackagePanel pkg={{ ...prepared, language: 'et' }} onChanged={() => undefined} />);
    expect(screen.getByLabelText('Language of package #11')).toHaveValue('et');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(api.regenerateMasiPackage).toHaveBeenCalledWith(11, 'et'));
  });

  it("shows each role's dates as the PDF prints them, and no separator for a role masi gave none", () => {
    render(<PackagePanel pkg={prepared} onChanged={() => undefined} />);
    const role = (text: RegExp) =>
      screen.getByText(
        (_, el) => el?.classList.contains('masi-role') === true && text.test(el.textContent ?? ''),
      );
    expect(
      role(/^Senior Backend Engineer · Tõrva Fintech OÜ · 2021-03 – present/),
    ).toBeInTheDocument();
    expect(screen.getByText('2021-03 – present')).toHaveClass('masi-nowrap');
    expect(
      role(/^Software Developer · Riigi Infosüsteemide Amet \(collapsed\)$/),
    ).toBeInTheDocument();
  });

  it('saves a file under the name masi gives it', async () => {
    const api = await import('../../services/api');
    vi.mocked(api.fetchMasiArtifact).mockResolvedValue({
      blob: new Blob(['%PDF-'], { type: 'application/pdf' }),
      filename: 'Mari-Maasikas-CV.pdf',
    });
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<PackagePanel pkg={prepared} onChanged={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open CV PDF' }));
    await waitFor(() => expect(saved).toEqual(['Mari-Maasikas-CV.pdf']));
    click.mockRestore();
  });

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
