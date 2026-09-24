import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiCv from './MasiCv';
import { renderAt } from './testUtils';
import type { CvVersionMeta } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchCvMaster: vi.fn(),
  fetchCvVersions: vi.fn(),
  fetchCvVersion: vi.fn(),
  validateCv: vi.fn(),
  createCvVersion: vi.fn(),
  activateCvVersion: vi.fn(),
  fetchCvPreview: vi.fn(),
  fetchCvTranslationStatus: vi.fn(),
  startCvTranslation: vi.fn(),
  reviewCvTranslation: vi.fn(),
}));

const api = await import('../../services/api');

const v1: CvVersionMeta = {
  version: 1,
  note: 'first',
  active: true,
  activatedAt: '2026-09-18T10:00:00Z',
  createdAt: '2026-09-18T09:00:00Z',
  schemaVersion: '1',
  language: 'en',
  translatedFrom: null,
  reviewedAt: null,
  current: null,
  parity: null,
};

beforeEach(() => {
  vi.mocked(api.fetchCvMaster).mockReset();
  vi.mocked(api.fetchCvVersions).mockReset();
  vi.mocked(api.fetchCvVersion).mockReset();
  vi.mocked(api.validateCv).mockReset();
  vi.mocked(api.createCvVersion).mockReset();
  vi.mocked(api.activateCvVersion).mockReset();
  vi.mocked(api.fetchCvTranslationStatus).mockReset();
  vi.mocked(api.fetchCvTranslationStatus).mockResolvedValue(null);
  vi.mocked(api.startCvTranslation).mockReset();
  vi.mocked(api.reviewCvTranslation).mockReset();
});

describe('MasiCv', () => {
  it('shows a starter master when the user has no versions', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({
      active: null,
      yaml: null,
      completeness: null,
    });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    renderAt('/masi/cv', '/masi/cv', <MasiCv />);
    await waitFor(() => {
      expect(screen.getByText('no active version')).toBeInTheDocument();
    });
    const editor = screen.getByLabelText<HTMLTextAreaElement>('Evidence bank (YAML)');
    expect(editor.value).toContain('schema_version: "1"');
    expect(
      screen.getByText('No versions yet. Fill in the evidence bank and save it.'),
    ).toBeInTheDocument();
  });

  it('shows the active master, its completeness gaps and the version list', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({
      active: v1,
      yaml: 'person:\n  name: Mari Maasikas\n',
      completeness: {
        score: 86,
        gaps: ['Riigi Infosüsteemide Amet — Software Developer: no achievement carries a metric'],
      },
    });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
    renderAt('/masi/cv', '/masi/cv', <MasiCv />);
    await waitFor(() => {
      expect(screen.getByText('active: v1')).toBeInTheDocument();
    });
    expect(screen.getByText('Completeness 86 %')).toBeInTheDocument();
    expect(screen.getByText(/no achievement carries a metric/)).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence bank (YAML)')).toHaveValue(
      'person:\n  name: Mari Maasikas\n',
    );
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument(); // the active one has no activate button
  });

  it('validates and shows every schema problem with its path', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({
      active: null,
      yaml: null,
      completeness: null,
    });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    vi.mocked(api.validateCv).mockResolvedValue({
      valid: false,
      errors: [
        "/person: property 'photo' is not defined in the schema and the schema does not allow additional properties",
      ],
    });
    renderAt('/masi/cv', '/masi/cv', <MasiCv />);
    expect(await screen.findByText('Validate')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Validate'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        "/person: property 'photo' is not defined",
      );
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
    vi.mocked(api.activateCvVersion).mockResolvedValue({
      ...v2,
      active: true,
      activatedAt: '2026-09-18T11:00:00Z',
    });
    renderAt('/masi/cv', '/masi/cv', <MasiCv />);
    expect(await screen.findByText('active: v1')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Note for this version'), 'second');
    await userEvent.click(screen.getByText('Save as new version'));
    expect(await screen.findByText('Version 2 saved (not active yet)')).toBeInTheDocument();
    expect(api.createCvVersion).toHaveBeenCalledWith('a: 1\n', 'second', undefined);
    expect(await screen.findByText('Activate')).toBeInTheDocument(); // v2 is not active
    await userEvent.click(screen.getByText('Activate'));
    await waitFor(() => expect(api.activateCvVersion).toHaveBeenCalledWith(2));
  });

  it('a refused save shows the errors and creates nothing', async () => {
    vi.mocked(api.fetchCvMaster).mockResolvedValue({
      active: null,
      yaml: null,
      completeness: null,
    });
    vi.mocked(api.fetchCvVersions).mockResolvedValue([]);
    vi.mocked(api.createCvVersion).mockResolvedValue({
      version: null,
      errors: ["$: required property 'positioning' not found"],
    });
    renderAt('/masi/cv', '/masi/cv', <MasiCv />);
    expect(await screen.findByText('Save as new version')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Save as new version'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("required property 'positioning'"),
    );
    expect(api.fetchCvVersions).toHaveBeenCalledTimes(1);
  });
  describe('translations', () => {
    const master = { active: v1, yaml: 'language: en\n', completeness: { score: 100, gaps: [] } };
    const translation = (version: number, extra: Partial<typeof v1>) => ({
      ...v1,
      version,
      active: false,
      activatedAt: null,
      language: 'et',
      translatedFrom: 1,
      current: false,
      parity: [],
      ...extra,
    });

    it('lists the translations of the active master with where each stands, and approves only one without problems', async () => {
      const blocked = translation(2, {
        parity: ['/summary: "juhtisin" claims more than the source\'s wording'],
      });
      const pending = translation(3, {});
      const current = translation(4, { reviewedAt: '2026-09-24T10:00:00Z', current: true });
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([current, pending, blocked, v1]);
      vi.mocked(api.reviewCvTranslation).mockResolvedValue({
        ...pending,
        reviewedAt: '2026-09-24T11:00:00Z',
      });
      vi.mocked(api.fetchCvTranslationStatus).mockResolvedValue({
        state: 'DONE',
        sourceVersion: 1,
        language: 'et',
        version: 3,
        error: null,
        startedAt: '2026-09-24T10:00:00Z',
        finishedAt: '2026-09-24T10:00:40Z',
      });
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      const card = await screen.findByTestId('cv-translations');
      expect(await screen.findByRole('status')).toHaveTextContent(
        'v3 made in Estonian: read it, then approve it below.',
      );
      expect(card).toHaveTextContent('the master is in English');
      expect(screen.getByTestId('translation-2')).toHaveTextContent('1 problem');
      expect(screen.getByTestId('translation-2')).toHaveTextContent('claims more than the source');
      expect(
        within(screen.getByTestId('translation-2')).getByRole('button', { name: 'Approve' }),
      ).toBeDisabled();
      expect(screen.getByTestId('translation-3')).toHaveTextContent('awaiting approval');
      expect(screen.getByTestId('translation-4')).toHaveTextContent('current');
      expect(
        within(screen.getByTestId('translation-4')).queryByRole('button', { name: 'Approve' }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText('translation of v1')).toHaveLength(3);
      await userEvent.click(
        within(screen.getByTestId('translation-3')).getByRole('button', { name: 'Approve' }),
      );
      await waitFor(() => expect(api.reviewCvTranslation).toHaveBeenCalledWith(3));
      expect(await screen.findByText('v3 approved')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/^v3 approved$/); // the one message, not joined to an older one
      expect(api.fetchCvVersions).toHaveBeenCalledTimes(2); // reloaded after the approval
    });

    it('translates the master into the other language and follows the model until it is done', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions)
          .mockResolvedValueOnce([v1])
          .mockResolvedValue([translation(2, {}), v1]);
        const running = {
          state: 'RUNNING' as const,
          sourceVersion: 1,
          language: 'et',
          version: null,
          error: null,
          startedAt: '2026-09-24T10:00:00Z',
          finishedAt: null,
        };
        vi.mocked(api.startCvTranslation).mockResolvedValue(running);
        vi.mocked(api.fetchCvTranslationStatus)
          .mockResolvedValueOnce(null)
          .mockResolvedValue({
            ...running,
            state: 'DONE',
            version: 2,
            finishedAt: '2026-09-24T10:00:40Z',
          });
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        await userEvent.click(
          await screen.findByRole('button', { name: 'Translate into Estonian' }),
        );
        expect(api.startCvTranslation).toHaveBeenCalledWith(1, 'et');
        expect(await screen.findByText('Translating into Estonian…')).toBeInTheDocument();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(
          await screen.findByText('v2 made in Estonian: read it, then approve it below.'),
        ).toBeInTheDocument();
        expect(await screen.findByTestId('translation-2')).toHaveTextContent('awaiting approval');
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps the editor's unsaved text when a translation is approved or made, and keeps asking while it is typed in", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const pending = translation(3, {});
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions).mockResolvedValue([pending, v1]);
        vi.mocked(api.reviewCvTranslation).mockResolvedValue({
          ...pending,
          reviewedAt: '2026-09-24T11:00:00Z',
        });
        const running = {
          state: 'RUNNING' as const,
          sourceVersion: 1,
          language: 'et',
          version: null,
          error: null,
          startedAt: '2026-09-24T10:00:00Z',
          finishedAt: null,
        };
        vi.mocked(api.startCvTranslation).mockResolvedValue(running);
        vi.mocked(api.fetchCvTranslationStatus)
          .mockResolvedValueOnce(null)
          .mockResolvedValue(running);
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        const editor = await screen.findByLabelText('Evidence bank (YAML)');
        await userEvent.type(editor, '# my unsaved edit');
        await userEvent.click(
          within(screen.getByTestId('translation-3')).getByRole('button', { name: 'Approve' }),
        );
        expect(await screen.findByText('v3 approved')).toBeInTheDocument();
        expect(editor).toHaveValue('language: en\n# my unsaved edit');
        await userEvent.click(screen.getByRole('button', { name: 'Translate into Estonian' }));
        const asked = vi.mocked(api.fetchCvTranslationStatus).mock.calls.length;
        for (let i = 0; i < 6; i++) {
          await userEvent.type(editor, 'x');
          await vi.advanceTimersByTimeAsync(1_000);
        }
        expect(vi.mocked(api.fetchCvTranslationStatus).mock.calls.length).toBeGreaterThan(asked);
        expect(editor).toHaveValue('language: en\n# my unsaved editxxxxxx');
      } finally {
        vi.useRealTimers();
      }
    });

    it('colours where each translation stands, and says in words how to get past its problems', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([
        translation(4, { reviewedAt: '2026-09-24T10:00:00Z', current: true }),
        translation(3, {}),
        translation(2, { parity: ["/summary: left in the source's language"], current: true }),
        v1,
      ]);
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(within(await screen.findByTestId('translation-4')).getByText('current')).toHaveClass(
        'status-badge',
        'success',
      );
      expect(
        within(screen.getByTestId('translation-3')).getByText('awaiting approval'),
      ).toHaveClass('status-badge', 'add');
      expect(within(screen.getByTestId('translation-2')).getByText('1 problem')).toHaveClass(
        'status-badge',
        'error',
      );
      expect(screen.getByTestId('translation-2')).toHaveTextContent(
        'save it as a new translation, then approve that one',
      );
      expect(screen.getByTestId('translation-3')).not.toHaveTextContent(
        'save it as a new translation',
      );
    });

    it('says why a translation failed', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
      vi.mocked(api.fetchCvTranslationStatus).mockResolvedValue({
        state: 'FAILED',
        sourceVersion: 1,
        language: 'et',
        version: null,
        error: 'the model left out 2 fields',
        startedAt: '2026-09-24T10:00:00Z',
        finishedAt: '2026-09-24T10:00:40Z',
      });
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The translation failed: the model left out 2 fields',
      );
    });

    it('says plainly when a master names no language', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue({
        ...master,
        active: { ...v1, language: null },
      });
      vi.mocked(api.fetchCvVersions).mockResolvedValue([{ ...v1, language: null }]);
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(
        await screen.findByText(/A master that does not say its language is not translated/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/A unknown/)).not.toBeInTheDocument();
    });

    it('offers no translation of a Russian master', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue({
        ...master,
        active: { ...v1, language: 'ru' },
      });
      vi.mocked(api.fetchCvVersions).mockResolvedValue([{ ...v1, language: 'ru' }]);
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(await screen.findByText(/A Russian master is not translated/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Translate into/ })).not.toBeInTheDocument();
    });

    it('saves an edited translation as a translation of the same master', async () => {
      const t = translation(2, {});
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([t, v1]);
      vi.mocked(api.fetchCvVersion).mockResolvedValue({
        active: null,
        yaml: 'language: et\n',
        completeness: null,
      });
      vi.mocked(api.createCvVersion).mockResolvedValue({ version: translation(3, {}), errors: [] });
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      await userEvent.click(
        within(await screen.findByTestId('translation-2')).getByRole('button', { name: 'Show' }),
      );
      await userEvent.click(
        await screen.findByRole('button', { name: 'Save as a new translation of v1' }),
      );
      await waitFor(() =>
        expect(api.createCvVersion).toHaveBeenCalledWith('language: et\n', '', 1),
      );
    });

    // ---- audit additions ----
    const runningInto = (language: string, sourceVersion = 1) => ({
      state: 'RUNNING' as const,
      sourceVersion,
      language,
      version: null,
      error: null,
      startedAt: '2026-09-24T10:00:00Z',
      finishedAt: null,
    });

    it('asks every 5 s — not sooner — for exactly MAX_POLLS answers, then says it stopped asking, and never reloads the list while the model works', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
        vi.mocked(api.startCvTranslation).mockResolvedValue(runningInto('et'));
        vi.mocked(api.fetchCvTranslationStatus)
          .mockResolvedValueOnce(null)
          .mockResolvedValue(runningInto('et'));
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        await userEvent.click(
          await screen.findByRole('button', { name: 'Translate into Estonian' }),
        );
        const status = screen.getByRole('status');
        expect(status).toHaveFocus(); // the news is announced where focus is
        expect(screen.getByRole('button', { name: 'Translate into Estonian' })).toBeDisabled(); // no second start
        const polls = () => vi.mocked(api.fetchCvTranslationStatus).mock.calls.length - 1; // minus the load
        await vi.advanceTimersByTimeAsync(4_900);
        expect(polls()).toBe(0); // not sooner than 5 s
        await vi.advanceTimersByTimeAsync(100);
        await waitFor(() => expect(polls()).toBe(1));
        await waitFor(() => expect(status).toHaveTextContent(/^Translating into Estonian…$/));
        for (let i = 2; i < 60; i++) {
          await vi.advanceTimersByTimeAsync(5_000);
          await waitFor(() => expect(polls()).toBe(i)); // every answer schedules the next ask
          expect(status).toHaveTextContent(/^Translating into Estonian…$/);
        }
        await vi.advanceTimersByTimeAsync(5_000);
        await waitFor(() => expect(polls()).toBe(60));
        expect(status).toHaveTextContent(
          'Still translating into Estonian; reload the page to look again.',
        );
        await vi.advanceTimersByTimeAsync(60_000);
        expect(polls()).toBe(60); // it stopped asking
        expect(api.fetchCvVersions).toHaveBeenCalledTimes(1); // RUNNING answers change nothing in the list
      } finally {
        vi.useRealTimers();
      }
    }, 20_000);

    it('a second translation in the same visit is followed for the full count again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
        vi.mocked(api.startCvTranslation).mockResolvedValue(runningInto('et'));
        const status = vi.mocked(api.fetchCvTranslationStatus).mockResolvedValueOnce(null);
        for (let i = 1; i < 60; i++) status.mockResolvedValueOnce(runningInto('et'));
        status.mockResolvedValueOnce({ ...runningInto('et'), state: 'DONE', version: 2 }); // the 60th answer
        status.mockResolvedValue(runningInto('et'));
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        await userEvent.click(
          await screen.findByRole('button', { name: 'Translate into Estonian' }),
        );
        for (let i = 1; i <= 60; i++) {
          await vi.advanceTimersByTimeAsync(5_000);
          await waitFor(() =>
            expect(vi.mocked(api.fetchCvTranslationStatus).mock.calls).toHaveLength(i + 1),
          );
        }
        expect(await screen.findByRole('status')).toHaveTextContent('v2 made in Estonian');
        await userEvent.click(screen.getByRole('button', { name: 'Translate into Estonian' }));
        const before = vi.mocked(api.fetchCvTranslationStatus).mock.calls.length;
        await vi.advanceTimersByTimeAsync(5_000);
        await waitFor(() =>
          expect(vi.mocked(api.fetchCvTranslationStatus).mock.calls).toHaveLength(before + 1),
        );
        expect(screen.getByRole('status')).toHaveTextContent(/^Translating into Estonian…$/);
      } finally {
        vi.useRealTimers();
      }
    }, 20_000);

    it('an approval made while the model works gives way to the translation once it is made', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const pending = translation(3, {});
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions).mockResolvedValue([pending, v1]);
        vi.mocked(api.reviewCvTranslation).mockResolvedValue({
          ...pending,
          reviewedAt: '2026-09-24T11:00:00Z',
        });
        vi.mocked(api.startCvTranslation).mockResolvedValue(runningInto('et'));
        vi.mocked(api.fetchCvTranslationStatus)
          .mockResolvedValueOnce(null)
          .mockResolvedValue({ ...runningInto('et'), state: 'DONE', version: 5 });
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        await userEvent.click(
          await screen.findByRole('button', { name: 'Translate into Estonian' }),
        );
        await userEvent.click(
          within(screen.getByTestId('translation-3')).getByRole('button', { name: 'Approve' }),
        );
        expect(await screen.findByRole('status')).toHaveTextContent(/^v3 approved$/);
        await vi.advanceTimersByTimeAsync(5_000);
        await waitFor(() =>
          expect(screen.getByRole('status')).toHaveTextContent(
            /^v5 made in Estonian: read it, then approve it below\.$/,
          ),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows nothing of a translation of another master, and lists only this master's translations", async () => {
      const v5 = { ...v1, version: 5 };
      vi.mocked(api.fetchCvMaster).mockResolvedValue({ ...master, active: v5 });
      vi.mocked(api.fetchCvVersions).mockResolvedValue([
        translation(6, { translatedFrom: 5 }),
        translation(2, {}),
        v5,
        { ...v1, active: false },
      ]);
      // the status answers only when the test says so: asserting before it lands would pass with no filter at all
      let answer!: (s: Awaited<ReturnType<typeof api.fetchCvTranslationStatus>>) => void;
      vi.mocked(api.fetchCvTranslationStatus).mockReturnValue(
        new Promise((r) => {
          answer = r;
        }),
      );
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(await screen.findByTestId('translation-6')).toBeInTheDocument();
      await act(() => {
        answer({
          state: 'FAILED',
          sourceVersion: 1,
          language: 'et',
          version: null,
          error: 'the model left out 2 fields',
          startedAt: '2026-09-24T10:00:00Z',
          finishedAt: '2026-09-24T10:00:40Z',
        });
        return Promise.resolve();
      });
      expect(screen.queryByTestId('translation-2')).not.toBeInTheDocument(); // v1's translation, not v5's
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // v1's failure is not v5's
      expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    });

    it('translates an Estonian master into English', async () => {
      const et = { ...v1, language: 'et' };
      vi.mocked(api.fetchCvMaster).mockResolvedValue({ ...master, active: et });
      vi.mocked(api.fetchCvVersions).mockResolvedValue([et]);
      vi.mocked(api.startCvTranslation).mockResolvedValue(runningInto('en'));
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      await userEvent.click(await screen.findByRole('button', { name: 'Translate into English' }));
      expect(api.startCvTranslation).toHaveBeenCalledWith(1, 'en');
    });

    it('says an approved translation that is no longer current is approved, and offers no second approval', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([
        translation(4, { reviewedAt: '2026-09-24T10:00:00Z', current: false }),
        v1,
      ]);
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      const row = await screen.findByTestId('translation-4');
      expect(within(row).getByText('approved, not current')).toHaveClass('status-badge');
      expect(within(row).getByText('approved, not current')).not.toHaveClass('success');
      expect(within(row).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });

    it('says why a translation could not start and why an approval was refused', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([translation(3, {}), v1]);
      vi.mocked(api.startCvTranslation).mockRejectedValue(
        new Error('a translation is already running'),
      );
      vi.mocked(api.reviewCvTranslation).mockRejectedValue(new Error('v3 has 1 parity problem'));
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      await userEvent.click(await screen.findByRole('button', { name: 'Translate into Estonian' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'a translation is already running',
      );
      await userEvent.click(
        within(screen.getByTestId('translation-3')).getByRole('button', { name: 'Approve' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('v3 has 1 parity problem');
    });

    it("keeps the editor's unsaved text when the translation is MADE (the DONE answer), not only when one is approved", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
        vi.mocked(api.fetchCvVersions)
          .mockResolvedValueOnce([v1])
          .mockResolvedValue([translation(2, {}), v1]);
        vi.mocked(api.fetchCvVersion).mockResolvedValue({
          active: null,
          yaml: 'language: et\n',
          completeness: null,
        });
        vi.mocked(api.startCvTranslation).mockResolvedValue(runningInto('et'));
        vi.mocked(api.fetchCvTranslationStatus)
          .mockResolvedValueOnce(null)
          .mockResolvedValue({ ...runningInto('et'), state: 'DONE', version: 2 });
        renderAt('/masi/cv', '/masi/cv', <MasiCv />);
        const editor = await screen.findByLabelText('Evidence bank (YAML)');
        await userEvent.click(screen.getByRole('button', { name: 'Translate into Estonian' }));
        await userEvent.type(editor, '# mine');
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await screen.findByTestId('translation-2')).toBeInTheDocument();
        await waitFor(() => expect(api.fetchCvVersions).toHaveBeenCalledTimes(2));
        expect(editor).toHaveValue('language: en\n# mine');
        expect(api.fetchCvVersion).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('a failure with no reason says so', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([v1]);
      vi.mocked(api.fetchCvTranslationStatus).mockResolvedValue({
        state: 'FAILED',
        sourceVersion: 1,
        language: 'et',
        version: null,
        error: null,
        startedAt: '2026-09-24T10:00:00Z',
        finishedAt: '2026-09-24T10:00:40Z',
      });
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The translation failed: no reason given',
      );
    });

    it('holds Approve while an approval is on its way — one click, one review', async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([translation(3, {}), v1]);
      vi.mocked(api.reviewCvTranslation).mockReturnValue(new Promise(() => undefined));
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      const approve = within(await screen.findByTestId('translation-3')).getByRole('button', {
        name: 'Approve',
      });
      await userEvent.click(approve);
      expect(approve).toBeDisabled();
    });

    it("names each version's language in the list, and offers no activation of a translation", async () => {
      vi.mocked(api.fetchCvMaster).mockResolvedValue(master);
      vi.mocked(api.fetchCvVersions).mockResolvedValue([translation(2, {}), v1]);
      renderAt('/masi/cv', '/masi/cv', <MasiCv />);
      await screen.findByTestId('translation-2');
      const rows = screen.getAllByRole('row');
      const row2 = rows.find((r) => within(r).queryByText('v2') !== null)!;
      const row1 = rows.find((r) => within(r).queryByText('v1') !== null)!;
      expect(within(row2).getByText('Estonian')).toBeInTheDocument();
      expect(within(row1).getByText('English')).toBeInTheDocument();
      expect(within(row2).queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    });
  });
});
