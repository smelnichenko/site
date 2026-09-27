import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VisitCard from './VisitCard';
import type { MasiCompany, MasiCompanyVisit, MasiCompanyVisits } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiCompanyVisits: vi.fn(),
  patchMasiCompany: vi.fn(),
}));
const api = await import('../../services/api');

const playtech: MasiCompany = {
  id: 7,
  name: 'PlayTech',
  registryCode: null,
  website: null,
  careersUrl: null,
  atsVendor: null,
  emtakCode: null,
  sizeBand: null,
  hqCity: null,
  address: null,
  tags: null,
  status: 'ACTIVE',
  origin: 'FROM_LISTING',
  firstSeenAt: '2026-09-18T08:00:00Z',
  lastSeenAt: '2026-09-18T09:00:00Z',
  registerSeenAt: null,
  blacklisted: false,
  agency: false,
  agencyMark: null,
  userNote: null,
};

/** PlayTech's guess, as the live visit wrote it: playtech.ee answered from a domain seller's site. */
const guessed: MasiCompanyVisit = {
  runAt: '2026-09-27T09:00:00Z',
  outcome: 'UNCONFIRMED',
  candidateUrl: 'https://domainseller.site/',
  evidence: 'domainseller.site: no registry code',
  adoptedCode: null,
  careersUrl: null,
  atsVendor: null,
  requests: 4,
  cut: false,
  foundBy: 'GUESS',
  triedUrl: 'https://playtech.ee/',
  namedCode: null,
};

function visits(v: Partial<MasiCompanyVisits>): MasiCompanyVisits {
  return { latest: null, attempt: null, visiting: false, ...v };
}

function renderCard(company: MasiCompany = playtech) {
  const onChange = vi.fn();
  const onLookUp = vi.fn();
  const view = render(<VisitCard company={company} onChange={onChange} onLookUp={onLookUp} />);
  return { onChange, onLookUp, ...view };
}

beforeEach(() => {
  vi.mocked(api.fetchMasiCompanyVisits).mockReset();
  vi.mocked(api.patchMasiCompany).mockReset();
});

describe('VisitCard', () => {
  it('shows where a guess ended up, and accepts the site it ended at as the website', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(visits({ latest: guessed }));
    const accepted = { ...playtech, website: 'https://domainseller.site/' };
    vi.mocked(api.patchMasiCompany).mockResolvedValue(accepted);
    const { onChange } = renderCard();

    expect(await screen.findByRole('region', { name: 'Own site' })).toBeInTheDocument();
    expect(api.fetchMasiCompanyVisits).toHaveBeenCalledWith(7, expect.any(AbortSignal));
    expect(screen.getByText('not sure it is its site')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tried playtech.ee, a guess from its name: it answered from domainseller.site.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'domainseller.site' })).toHaveAttribute(
      'href',
      'https://domainseller.site/',
    );
    expect(screen.getByText('domainseller.site: no registry code')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Accept domainseller.site as its website' }),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(accepted));
    expect(api.patchMasiCompany).toHaveBeenCalledWith(7, { website: 'https://domainseller.site/' });
  });

  it("says why a website was refused, in the server's words, and changes nothing", async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(visits({ latest: guessed }));
    vi.mocked(api.patchMasiCompany).mockRejectedValue(
      new Error('domainseller.site is held by Parking OÜ: place this company on its code'),
    );
    const { onChange } = renderCard();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Accept domainseller.site as its website' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'domainseller.site is held by Parking OÜ: place this company on its code',
    );
    expect(onChange).not.toHaveBeenCalled();
    // still offered: the operator may clear the holder's website and try again
    expect(
      screen.getByRole('button', { name: 'Accept domainseller.site as its website' }),
    ).toBeEnabled();
  });

  it('offers no Accept for a site the visit took, and shows what it found there', async () => {
    const tktk = { ...playtech, registryCode: '70003773', website: 'https://tktk.ee/' };
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        latest: {
          ...guessed,
          outcome: 'PROVED',
          candidateUrl: 'https://tktk.ee/',
          evidence: 'its registry code 70003773 is on tktk.ee',
          adoptedCode: '70003773',
          careersUrl: 'https://www.tktk.ee/karjaarileht/',
          atsVendor: 'teamdash',
          foundBy: 'CONTACT',
          triedUrl: null,
        },
      }),
    );
    renderCard(tktk);

    expect(await screen.findByText('its site: it prints the registry code')).toBeInTheDocument();
    expect(screen.getByText('the domain its people write from')).toBeInTheDocument();
    expect(screen.getByText('placed on reg. 70003773')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'careers page' })).toHaveAttribute(
      'href',
      'https://www.tktk.ee/karjaarileht/',
    );
    expect(screen.getByText('ATS teamdash')).toBeInTheDocument();
    expect(screen.queryByText(/^Tried /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
  });

  it('does not offer again the website the company already has', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({ latest: { ...guessed, candidateUrl: 'https://luminor.ee/', triedUrl: null } }),
    );
    renderCard({ ...playtech, website: 'https://www.luminor.ee/en' });

    expect(await screen.findByText('not sure it is its site')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
  });

  it('hands a code the site names to the register card, only for a company without one', async () => {
    const held: MasiCompanyVisit = {
      ...guessed,
      outcome: 'CODE_HELD',
      candidateUrl: 'https://firma3.ee/',
      evidence: 'firma3.ee names Firma3 Grupp AS (12345678), a company masi holds',
      foundBy: 'CONTACT',
      triedUrl: null,
      namedCode: '12345678',
    };
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(visits({ latest: held }));
    const { onLookUp, unmount } = renderCard();

    expect(await screen.findByText('the site names a company masi holds')).toBeInTheDocument();
    // the holder's site is not this company's: only an unconfirmed site is offered
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Look up reg. 12345678 in the register' }),
    );
    expect(onLookUp).toHaveBeenCalledWith('12345678');
    unmount();

    renderCard({ ...playtech, registryCode: '87654321' });
    expect(await screen.findByText('the site names a company masi holds')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Look up / })).not.toBeInTheDocument();
  });

  it('offers both the site and the code a guess prints that fits the name, for the operator to choose', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        latest: {
          ...guessed,
          candidateUrl: 'https://wise.com/',
          triedUrl: null,
          evidence:
            'wise.com prints registry code 16267372 (Wise Payments Estonia OÜ), which fits its name',
          namedCode: '16267372',
        },
      }),
    );
    const { onLookUp } = renderCard({ ...playtech, name: 'Wise' });

    expect(
      await screen.findByRole('button', { name: 'Accept wise.com as its website' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Look up reg. 16267372 in the register' }),
    );
    expect(onLookUp).toHaveBeenCalledWith('16267372');
    expect(api.patchMasiCompany).not.toHaveBeenCalled();
  });

  it('says a visit is under way beside the last judgement, and not that it failed', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        latest: guessed,
        attempt: {
          ...guessed,
          outcome: 'VISIT_FAILED',
          runAt: '2026-09-27T10:00:00Z',
          evidence: null,
        },
        visiting: true,
      }),
    );
    renderCard();

    expect(await screen.findByText('visiting now')).toBeInTheDocument();
    expect(screen.queryByText(/did not finish/)).not.toBeInTheDocument();
    // the candidate the operator acts on stays
    expect(
      screen.getByRole('button', { name: 'Accept domainseller.site as its website' }),
    ).toBeInTheDocument();
  });

  it('says a newer visit that judged nothing, beside the last judgement', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        latest: guessed,
        attempt: {
          ...guessed,
          outcome: 'VISIT_FAILED',
          runAt: '2026-09-27T10:00:00Z',
          evidence: null,
        },
        visiting: false,
      }),
    );
    renderCard();

    expect(
      await screen.findByText(/^Tried again .*: the visit did not finish$/),
    ).toBeInTheDocument();
    expect(screen.queryByText('visiting now')).not.toBeInTheDocument();
    expect(screen.getByText(/^visited /)).toBeInTheDocument();
  });

  it('shows a visit that read no site, and one a shutdown cut short', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        attempt: {
          ...guessed,
          outcome: 'ROBOTS_DENIED',
          candidateUrl: null,
          evidence: null,
          foundBy: null,
          triedUrl: null,
          cut: true,
        },
      }),
    );
    renderCard();

    expect(
      await screen.findByText("the sites' robots.txt forbid reading them"),
    ).toBeInTheDocument();
    expect(screen.getByText('cut short by a restart: visited again soon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
  });

  it("says a guess answered from no company's own site, and offers nothing to accept", async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(
      visits({
        latest: {
          ...guessed,
          candidateUrl: null,
          triedUrl: 'https://playtech.ee/',
          evidence:
            "playtech.ee answers from https://www.facebook.com/playtech, no company's own site",
        },
      }),
    );
    renderCard();

    expect(
      await screen.findByText(
        "Tried playtech.ee, a guess from its name: no company's own site answered.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "playtech.ee answers from https://www.facebook.com/playtech, no company's own site",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
  });

  it("shows nothing of the company the page moved on from while the next one's visits load", async () => {
    vi.mocked(api.fetchMasiCompanyVisits)
      .mockResolvedValueOnce(visits({ latest: guessed }))
      .mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = renderCard();
    expect(await screen.findByRole('link', { name: 'domainseller.site' })).toBeInTheDocument();

    rerender(<VisitCard company={{ ...playtech, id: 8 }} onChange={vi.fn()} onLookUp={vi.fn()} />);

    await waitFor(() =>
      expect(api.fetchMasiCompanyVisits).toHaveBeenCalledWith(8, expect.any(AbortSignal)),
    );
    expect(screen.queryByRole('link', { name: 'domainseller.site' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept / })).not.toBeInTheDocument();
  });

  it('shows no card for a company masi has not visited', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(null);
    const { container } = renderCard();

    await waitFor(() => expect(api.fetchMasiCompanyVisits).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says the visits could not be loaded', async () => {
    vi.mocked(api.fetchMasiCompanyVisits).mockRejectedValue(new Error('the database is down'));
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent('the database is down');
  });

  it('shows a visit of an older masi, which does not say how it found the site', async () => {
    const older: MasiCompanyVisit = { ...guessed };
    delete older.foundBy;
    delete older.triedUrl;
    delete older.namedCode;
    vi.mocked(api.fetchMasiCompanyVisits).mockResolvedValue(visits({ latest: older }));
    renderCard();

    expect(await screen.findByRole('link', { name: 'domainseller.site' })).toBeInTheDocument();
    expect(screen.queryByText(/^Tried /)).not.toBeInTheDocument();
  });
});
