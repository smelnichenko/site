import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MasiJobs from './MasiJobs';
import { job, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({ fetchMasiJobs: vi.fn() }));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.fetchMasiJobs).mockReset(); // a body, not an expression: a returned mock would run as the test's cleanup
});

describe('MasiJobs', () => {
  it('lists jobs with the package state and puts the filters in the URL', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, packageId: 11, packageStatus: 'PREPARED' },
        { ...job, id: 8, title: 'Go Engineer', status: 'CLOSED' },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/jobs?status=ALL', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('2 matching')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
      status: 'ALL',
      page: 0,
      size: 50,
    });
    expect(screen.getByRole('link', { name: 'Senior Java Developer' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
    expect(screen.getByRole('link', { name: 'prepared' })).toHaveAttribute(
      'href',
      '/masi/packages/11',
    );
    expect(screen.getByText('(closed)')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Package'), 'NONE');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ packageStatus: 'NONE' }),
        expect.anything(),
      ),
    );
    await userEvent.type(screen.getByLabelText('Search title'), 'java{enter}');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: 'java',
          packageStatus: 'NONE',
        }),
        expect.anything(),
      ),
    );
  });

  it("filters by the posting's form of work and country, from the URL and from the controls", async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    renderAt('/masi/jobs?employmentType=PERMANENT&country=FI', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('1 matching')).toBeInTheDocument();
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
      employmentType: 'PERMANENT',
      country: 'FI',
    });
    const form = screen.getByRole('combobox', { name: 'Employment type' });
    expect(form).toHaveValue('PERMANENT');
    const country = screen.getByRole('textbox', { name: 'Country' });
    expect(country).toHaveValue('FI');
    await userEvent.selectOptions(form, 'CONTRACT');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ employmentType: 'CONTRACT', country: 'FI' }),
        expect.anything(),
      ),
    );
    await userEvent.clear(screen.getByRole('textbox', { name: 'Country' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Country' }), 'ee{enter}');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ employmentType: 'CONTRACT', country: 'EE' }),
        expect.anything(),
      ),
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Employment type' }), '');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Country' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search title' }), '{enter}');
    await waitFor(() => {
      const last = vi.mocked(api.fetchMasiJobs).mock.lastCall?.[0];
      expect(last?.employmentType).toBeUndefined();
      expect(last?.country).toBeUndefined();
    });
  });

  it('sends no form of work masi does not know, and a country from the URL in capitals', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    renderAt('/masi/jobs?employmentType=FULL_TIME&country=ee', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('1 matching')).toBeInTheDocument();
    const first = vi.mocked(api.fetchMasiJobs).mock.calls[0][0];
    expect(first.employmentType).toBeUndefined();
    expect(first.country).toBe('EE');
    expect(screen.getByRole('combobox', { name: 'Employment type' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Country' })).toHaveValue('EE');
  });

  it('shows the country of the page the browser went back to, not the one it left', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    function Back() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate(-1)}>
          back
        </button>
      );
    }
    render(
      <MemoryRouter
        initialEntries={['/masi/jobs?country=FI', '/masi/jobs?country=EE']}
        initialIndex={1}
      >
        <Back />
        <Routes>
          <Route path="/masi/jobs" element={<MasiJobs />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('1 matching')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Country' })).toHaveValue('EE');
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ country: 'FI' }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Country' })).toHaveValue('FI');
  });

  it('sends no form-of-work or country filter when none is chosen', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 1,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('1 matching')).toBeInTheDocument();
    const first = vi.mocked(api.fetchMasiJobs).mock.calls[0][0];
    expect(first.employmentType).toBeUndefined();
    expect(first.country).toBeUndefined();
    expect(screen.getByRole('combobox', { name: 'Employment type' })).toHaveValue('');
  });

  it('pages through a long registry', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [job],
      page: 0,
      size: 50,
      totalElements: 120,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('page 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        expect.anything(),
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText('Remote'), 'REMOTE');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ remote: 'REMOTE', page: 0 }),
        expect.anything(),
      ),
    ); // a new filter starts over
  });

  it('marks every row with the sources that list the job, and a merged job as merged', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, sources: ['cvee', 'meetfrank'], reopenedCount: 2 },
        { ...job, id: 8, title: 'Go Engineer', sources: [] },
        {
          ...job,
          id: 9,
          title: 'Java Developer | EE',
          status: 'MERGED',
          mergedIntoId: 7,
          sources: [],
          reopenedCount: 1, // an absorbed duplicate's own count is noise beside the merge note
        },
      ],
      page: 0,
      size: 50,
      totalElements: 3,
    });
    renderAt('/masi/jobs?status=ALL', '/masi/jobs', <MasiJobs />);
    const listed = await screen.findByRole('row', { name: /^Senior Java Developer/ });
    const sourcesColumn = screen
      .getAllByRole('columnheader')
      .findIndex((h) => h.textContent?.trim() === 'Sources');
    expect(sourcesColumn).toBeGreaterThan(-1);
    expect(within(listed).getByText('reposted ×2')).toBeInTheDocument();
    const marks = within(listed).getAllByRole('cell')[sourcesColumn];
    expect(within(marks).getByText('cvee')).toBeInTheDocument();
    expect(within(marks).getByText('meetfrank')).toBeInTheDocument();
    const unlisted = screen.getByRole('row', { name: /Go Engineer/ });
    expect(within(unlisted).queryByText(/reposted/)).not.toBeInTheDocument();
    expect(within(unlisted).getAllByRole('cell')[sourcesColumn]).toHaveTextContent('—');
    const merged = screen.getByRole('row', { name: /^Java Developer \| EE/ });
    expect(merged).toHaveTextContent('(merged)');
    expect(within(merged).queryByText(/reposted/)).not.toBeInTheDocument();
    expect(within(merged).getByRole('link', { name: 'merged into job 7' })).toHaveAttribute(
      'href',
      '/masi/jobs/7',
    );
  });

  it('shows the empty state', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    expect(await screen.findByText('No jobs match.')).toBeInTheDocument();
  });
  it('shows the match score, and sorts by it through the URL', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [
        { ...job, matchScore: 86 },
        { ...job, id: 8, title: 'Go Engineer', matchScore: null },
      ],
      page: 0,
      size: 50,
      totalElements: 2,
    });
    renderAt('/masi/jobs', '/masi/jobs', <MasiJobs />);
    const scored = await screen.findByRole('row', { name: /Senior Java Developer/ });
    const matchColumn = screen
      .getAllByRole('columnheader')
      .findIndex((h) => h.textContent?.trim() === 'Match');
    expect(matchColumn).toBeGreaterThan(-1);
    expect(within(scored).getAllByRole('cell')[matchColumn]).toHaveTextContent('86');
    const unscored = screen.getByRole('row', { name: /Go Engineer/ });
    expect(within(unscored).getAllByRole('cell')[matchColumn]).toHaveTextContent('not scored');
    expect(
      screen.getByText(/how much of what the posting asks for your CV shows/),
    ).toBeInTheDocument();
    // newest first until asked: no sort is sent at all
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBeUndefined();
    await userEvent.selectOptions(screen.getByLabelText('Order'), 'match,desc');
    await waitFor(() =>
      expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'match,desc', page: 0 }),
        expect.anything(),
      ),
    );
  });

  it('takes the order from the URL, and ignores one it does not offer', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs?sort=match,desc', '/masi/jobs', <MasiJobs />);
    await screen.findByText('No jobs match.');
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBe('match,desc');
    expect(screen.getByLabelText('Order')).toHaveValue('match,desc');
  });

  it('does not pass on an order the page does not offer', async () => {
    vi.mocked(api.fetchMasiJobs).mockResolvedValue({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
    });
    renderAt('/masi/jobs?sort=salary,asc', '/masi/jobs', <MasiJobs />);
    await screen.findByText('No jobs match.');
    expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0].sort).toBeUndefined();
  });

  describe("a report figure's jobs", () => {
    const from = '2026-03-22T22:00:00Z';
    const to = '2026-03-29T21:00:00Z';
    const page = { content: [job], page: 0, size: 50, totalElements: 1 };

    it('asks for every status, names the period, and clears back to the open registry', async () => {
      vi.mocked(api.fetchMasiJobs).mockResolvedValue(page);
      /** The page's URL, as the address bar would show it after a clear. */
      function Search() {
        return <output data-testid="search">{useLocation().search}</output>;
      }
      render(
        <MemoryRouter
          initialEntries={[
            `/masi/jobs?event=CLOSED&from=${from}&to=${to}&salary=COUNTED&titleNorm=java%20developer&tag=java&seniority=senior&q=java`,
          ]}
        >
          <Routes>
            <Route
              path="/masi/jobs"
              element={
                <>
                  <MasiJobs />
                  <Search />
                </>
              }
            />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
        status: 'ALL',
        event: 'CLOSED',
        from,
        to,
      });
      expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('ALL');
      const note = screen.getByRole('region', { name: 'Report filter' });
      expect(note).toHaveTextContent('closed 23 Mar 2026 – 29 Mar 2026');
      // every report key in the URL, so a clear that misses one is seen
      expect(note).toHaveTextContent(
        'salary counted · titled "java developer" · tagged java · seniority senior',
      );
      await userEvent.click(within(note).getByRole('button', { name: 'clear the report filter' }));
      await waitFor(() =>
        expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
          expect.objectContaining({
            status: 'OPEN',
            event: undefined,
            from: undefined,
            to: undefined,
          }),
          expect.anything(),
        ),
      );
      expect(screen.queryByRole('region', { name: 'Report filter' })).not.toBeInTheDocument();
      // the figure's parameters are gone from the URL, every one; the operator's own search stays
      expect(screen.getByTestId('search')).toHaveTextContent(/^\?q=java$/);
    });

    it("keeps a status the URL names, and names a top company's or the salary's figure", async () => {
      vi.mocked(api.fetchMasiJobs).mockResolvedValue(page);
      renderAt(
        `/masi/jobs?event=NEW&from=${from}&to=${to}&salary=EXCLUDED&company=3&status=CLOSED`,
        '/masi/jobs',
        <MasiJobs />,
      );
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
        status: 'CLOSED',
        event: 'NEW',
        salary: 'EXCLUDED',
        company: 3,
        from,
        to,
      });
      expect(screen.getByRole('region', { name: 'Report filter' })).toHaveTextContent(
        'first seen 23 Mar 2026 – 29 Mar 2026 · salary not counted',
      );
    });

    it('sends no half a figure: an event without its period is not passed on, nor is an unknown one', async () => {
      vi.mocked(api.fetchMasiJobs).mockResolvedValue(page);
      const view = renderAt(`/masi/jobs?event=CLOSED&from=${from}`, '/masi/jobs', <MasiJobs />);
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
        status: 'OPEN',
        event: undefined,
        from: undefined,
        to: undefined,
      });
      expect(screen.queryByRole('region', { name: 'Report filter' })).not.toBeInTheDocument();
      view.unmount();
      renderAt(
        `/masi/jobs?event=GONE&from=${from}&to=${to}&salary=SOME`,
        '/masi/jobs',
        <MasiJobs />,
      );
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[1][0]).toMatchObject({
        event: undefined,
        salary: undefined,
      });
    });

    it("reads a bar's value - title, tag, seniority, remote not stated - and names it", async () => {
      vi.mocked(api.fetchMasiJobs).mockResolvedValue(page);
      renderAt(
        `/masi/jobs?event=NEW&from=${from}&to=${to}&titleNorm=java%20developer&tag=java&seniority=senior&remote=UNKNOWN`,
        '/masi/jobs',
        <MasiJobs />,
      );
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
        event: 'NEW',
        titleNorm: 'java developer',
        tag: 'java',
        seniority: 'senior',
        remote: 'UNKNOWN',
      });
      // "not stated" is a choice the control shows, not a value it cannot display
      expect(screen.getByRole('combobox', { name: 'Remote' })).toHaveDisplayValue(
        'location not stated',
      );
      const note = screen.getByRole('region', { name: 'Report filter' });
      expect(note).toHaveTextContent(
        'first seen 23 Mar 2026 – 29 Mar 2026 · titled "java developer" · tagged java · seniority senior',
      );
      await userEvent.click(within(note).getByRole('button', { name: 'clear the report filter' }));
      await waitFor(() =>
        expect(api.fetchMasiJobs).toHaveBeenLastCalledWith(
          expect.objectContaining({ titleNorm: undefined, tag: undefined, seniority: undefined }),
          expect.anything(),
        ),
      );
    });

    it('names a salary filter given without a period too: nothing narrows the list unseen', async () => {
      vi.mocked(api.fetchMasiJobs).mockResolvedValue(page);
      renderAt('/masi/jobs?salary=COUNTED', '/masi/jobs', <MasiJobs />);
      expect(await screen.findByText('1 matching')).toBeInTheDocument();
      expect(vi.mocked(api.fetchMasiJobs).mock.calls[0][0]).toMatchObject({
        salary: 'COUNTED',
        status: 'OPEN',
      });
      expect(screen.getByRole('region', { name: 'Report filter' })).toHaveTextContent(
        'salary counted',
      );
    });
  });
});
