import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCv from './MasiCv';

vi.mock('../services/api', () => ({
  fetchCvMaster: vi.fn(),
  fetchCvVersions: vi.fn(),
  fetchCvVersion: vi.fn(),
  validateCv: vi.fn(),
  createCvVersion: vi.fn(),
  activateCvVersion: vi.fn(),
  fetchCvPreview: vi.fn(),
}));

const api = await import('../services/api');

const v1 = {
  version: 1,
  note: 'first',
  active: true,
  activatedAt: '2026-09-18T10:00:00Z',
  createdAt: '2026-09-18T09:00:00Z',
  schemaVersion: '1',
};

beforeEach(() => {
  vi.mocked(api.fetchCvMaster).mockReset();
  vi.mocked(api.fetchCvVersions).mockReset();
  vi.mocked(api.fetchCvVersion).mockReset();
  vi.mocked(api.validateCv).mockReset();
  vi.mocked(api.createCvVersion).mockReset();
  vi.mocked(api.activateCvVersion).mockReset();
});

describe('MasiCv', () => {
  it('shows a starter master when the user has no versions', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({ active: null, yaml: null, completeness: null });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    render(<MasiCv />);
    await waitFor(() => {
      expect(screen.getByText('no active version')).toBeInTheDocument();
    });
    const editor = screen.getByLabelText<HTMLTextAreaElement>('Evidence bank (YAML)');
    expect(editor.value).toContain('schema_version: "1"');
    expect(screen.getByText('No versions yet. Fill in the evidence bank and save it.')).toBeInTheDocument();
  });

  it('shows the active master, its completeness gaps and the version list', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({
      active: v1,
      yaml: 'person:\n  name: Mari Maasikas\n',
      completeness: { score: 86, gaps: ['Riigi Infosüsteemide Amet — Software Developer: no achievement carries a metric'] },
    });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
    render(<MasiCv />);
    await waitFor(() => {
      expect(screen.getByText('active: v1')).toBeInTheDocument();
    });
    expect(screen.getByText('Completeness 86 %')).toBeInTheDocument();
    expect(screen.getByText(/no achievement carries a metric/)).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence bank (YAML)')).toHaveValue('person:\n  name: Mari Maasikas\n');
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument(); // the active one has no activate button
  });

  it('validates and shows every schema problem with its path', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({ active: null, yaml: null, completeness: null });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    vi.mocked(api.validateCv).mockResolvedValue({
      valid: false,
      errors: ["/person: property 'photo' is not defined in the schema and the schema does not allow additional properties"],
    });
    render(<MasiCv />);
    expect(await screen.findByText('Validate')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Validate'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("/person: property 'photo' is not defined");
    });
    vi.mocked(api.validateCv).mockResolvedValue({ valid: true, errors: [] });
    await userEvent.click(screen.getByText('Validate'));
    expect(await screen.findByText('Valid')).toBeInTheDocument();
  });

  it('saves a new inactive version, then activates it on request', async () => {
    const v2 = { ...v1, version: 2, note: 'second', active: false, activatedAt: null };
    vi.mocked(api.fetchCvMaster)
      .mockResolvedValueOnce({ active: v1, yaml: 'a: 1\n', completeness: { score: 100, gaps: [] } })
      .mockResolvedValue({ active: v1, yaml: 'a: 1\n', completeness: { score: 100, gaps: [] } });
    vi.mocked(api.fetchCvVersions).mockResolvedValueOnce([v1]).mockResolvedValue([v2, v1]);
    vi.mocked(api.createCvVersion).mockResolvedValue({ version: v2, errors: [] });
    vi.mocked(api.activateCvVersion).mockResolvedValue({ ...v2, active: true, activatedAt: '2026-09-18T11:00:00Z' });
    render(<MasiCv />);
    expect(await screen.findByText('active: v1')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Note for this version'), 'second');
    await userEvent.click(screen.getByText('Save as new version'));
    expect(await screen.findByText('Version 2 saved (not active yet)')).toBeInTheDocument();
    expect(api.createCvVersion).toHaveBeenCalledWith('a: 1\n', 'second');
    expect(await screen.findByText('Activate')).toBeInTheDocument(); // v2 is not active
    await userEvent.click(screen.getByText('Activate'));
    await waitFor(() => expect(api.activateCvVersion).toHaveBeenCalledWith(2));
  });

  it('a refused save shows the errors and creates nothing', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({ active: null, yaml: null, completeness: null });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    vi.mocked(api.createCvVersion).mockResolvedValue({ version: null, errors: ['$: required property \'positioning\' not found'] });
    render(<MasiCv />);
    expect(await screen.findByText('Save as new version')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Save as new version'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("required property 'positioning'"));
    expect(api.fetchCvVersions).toHaveBeenCalledTimes(1);
  });
});
