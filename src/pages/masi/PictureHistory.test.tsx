import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../services/api';
import { formatDateTime } from './format';
import PictureHistory from './PictureHistory';

vi.mock('../../services/api');

function picture(
  id: number,
  source: string,
  createdAt: string,
  capturedAt: string,
  size = 2048,
): api.MasiContactPicture {
  return {
    id,
    source,
    sourceUrl: null,
    contentType: 'image/png',
    size,
    createdAt,
    capturedAt,
  };
}

function tries(partial: Partial<api.MasiPictureSourceTries>): api.MasiPictureSourceTries {
  return {
    source: 'GRAVATAR',
    tries: 0,
    max: 3,
    left: 3,
    lastTriedAt: null,
    lastOutcome: null,
    nextAskAt: null,
    ...partial,
  };
}

function record(
  contactId: number,
  partial: Partial<api.MasiPersonFound> = {},
): api.MasiPersonFound {
  return {
    contactId,
    origin: 'FROM_WEB',
    source: 'github',
    sourceName: 'GitHub people',
    profileUrl: null,
    linkedinUrl: null,
    title: null,
    email: null,
    companyId: null,
    companyName: null,
    listingId: null,
    listingUrl: null,
    listingTitle: null,
    firstSeenAt: '2026-09-01T09:00:00Z',
    lastSeenAt: '2026-09-20T09:00:00Z',
    pictures: 1,
    ...partial,
  };
}

function show(found: api.MasiPersonFound[] = [record(71)], url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PictureHistory personId={5} found={found} />
    </MemoryRouter>,
  );
}

function column(table: HTMLElement, index: number): (string | null)[] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[index].textContent);
}

describe('PictureHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.mocked(api.fetchMasiContactPictureBlob).mockResolvedValue(new Blob(['x']));
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({ triesLeft: 0, contacts: [] });
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([
      picture(1, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z'),
      picture(2, 'NAME_SEARCH', '2026-09-15T09:00:00Z', '2026-09-15T09:00:00Z'),
    ]);
  });

  it('lists every image, the newest added first, and reverses on the Added header', async () => {
    show();
    const table = await screen.findByTestId('person-pictures');
    const sources = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[1].textContent);
    expect(sources()).toEqual(['Name search', 'Gravatar']);
    await userEvent.click(within(table).getByRole('button', { name: 'Added' }));
    expect(sources()).toEqual(['Gravatar', 'Name search']);
  });

  it('sorts by last seen apart from date added', async () => {
    show();
    const table = await screen.findByTestId('person-pictures');
    await userEvent.click(within(table).getByRole('button', { name: 'Last seen' }));
    await userEvent.click(within(table).getByRole('button', { name: /Last seen/ }));
    const first = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[1].textContent;
    expect(first).toBe('Gravatar');
  });

  it('says what each source has used, has left, and when it is asked next', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 2,
      contacts: [
        {
          contactId: 71,
          sources: [
            tries({
              source: 'UNAVATAR',
              tries: 3,
              left: 0,
              lastTriedAt: '2026-09-12T06:00:00Z',
              lastOutcome: 'NONE',
              nextAskAt: null,
            }),
            tries({
              source: 'GITHUB',
              left: 2,
              tries: 1,
              lastTriedAt: '2026-09-12T06:00:00Z',
              lastOutcome: 'FAILED',
              nextAskAt: '2000-01-01T00:00:00Z',
            }),
          ],
        },
      ],
    });
    show();
    const table = await screen.findByTestId('person-picture-tries');
    const spent = within(table).getByRole('row', { name: /unavatar/ });
    expect(within(spent).getByText('3 of 3')).toBeInTheDocument();
    expect(within(spent).getByText('nothing')).toBeInTheDocument();
    expect(within(spent).getByText('not again')).toBeInTheDocument();
    const due = within(table).getByRole('row', { name: /GitHub/ });
    expect(within(due).getByText('failed')).toBeInTheDocument();
    expect(within(due).getByText('due now')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('a source with tries left is not needed once another holds the picture', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 3,
      contacts: [{ contactId: 71, sources: [tries({ source: 'GITHUB', nextAskAt: null })] }],
    });
    show();
    expect(
      await within(await screen.findByTestId('person-picture-tries')).findByText('not needed'),
    ).toBeInTheDocument();
  });

  it('says it is still loading, never that there is no picture', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockReturnValue(new Promise(() => {}));
    show();
    expect(await screen.findByText('Loading pictures...')).toBeInTheDocument();
    expect(screen.queryByText('No picture kept.')).not.toBeInTheDocument();
  });

  it('keeps the pictures when the tries fail, and says which failed', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockRejectedValue(new Error('tries down'));
    show();
    expect(await screen.findByTestId('person-pictures')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('tries down');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps the tries when the pictures fail', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockRejectedValue(new Error('down'));
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 3,
      contacts: [{ contactId: 71, sources: [tries({})] }],
    });
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('down');
    expect(await screen.findByTestId('person-picture-tries')).toBeInTheDocument();
  });

  it('one record that fails leaves the others shown, and says so', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockImplementation((id) =>
      id === 72
        ? Promise.reject(new Error('down'))
        : Promise.resolve([picture(1, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z')]),
    );
    show([record(71), record(72)]);
    expect(await screen.findByTestId('person-pictures')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('down');
  });

  it('draws each thumbnail as it arrives, not after the slowest', async () => {
    vi.mocked(api.fetchMasiContactPictureBlob).mockImplementation((_contact, id) =>
      id === 1 ? new Promise(() => {}) : Promise.resolve(new Blob(['x'])),
    );
    show();
    const table = await screen.findByTestId('person-pictures');
    expect(await within(table).findAllByRole('button', { name: /Open the picture/ })).toHaveLength(
      1,
    );
  });

  it('asks for at most four pictures at once', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      picture(i + 1, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z'),
    );
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue(many);
    vi.mocked(api.fetchMasiContactPictureBlob).mockReturnValue(new Promise(() => {}));
    show();
    await screen.findByTestId('person-pictures');
    await vi.waitFor(() => expect(api.fetchMasiContactPictureBlob).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.fetchMasiContactPictureBlob).toHaveBeenCalledTimes(4);
  });

  it('opens a kept picture enlarged, in the order shown', async () => {
    show();
    const table = await screen.findByTestId('person-pictures');
    await vi.waitFor(() =>
      expect(within(table).getAllByRole('button', { name: /Open the picture/ })).toHaveLength(2),
    );
    await userEvent.click(
      within(table).getAllByRole('button', { name: /Open the picture from Gravatar/ })[0],
    );
    expect(await screen.findByRole('img', { name: /^from Gravatar, added/ })).toBeInTheDocument();
  });

  it('never asked reads never', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 3,
      contacts: [{ contactId: 71, sources: [tries({ nextAskAt: '2000-01-01T00:00:00Z' })] }],
    });
    show();
    expect(
      await within(await screen.findByTestId('person-picture-tries')).findByText('never'),
    ).toBeInTheDocument();
  });

  it('names the record, by where it was found, only when the person has several', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 6,
      contacts: [
        { contactId: 71, sources: [tries({})] },
        { contactId: 72, sources: [tries({})] },
      ],
    });
    show([record(71), record(72, { sourceName: 'CV.ee', companyName: 'Nortal AS' })]);
    const table = await screen.findByTestId('person-picture-tries');
    expect(within(table).getByRole('columnheader', { name: 'Record' })).toBeInTheDocument();
    expect(within(table).getByText('CV.ee, Nortal AS')).toBeInTheDocument();
    expect(within(table).getByText('GitHub people')).toBeInTheDocument();
  });

  it('a record no source can be asked about does not count as a second one', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 3,
      contacts: [
        { contactId: 71, sources: [tries({})] },
        { contactId: 72, sources: [] },
      ],
    });
    show([record(71), record(72)]);
    const table = await screen.findByTestId('person-picture-tries');
    expect(within(table).queryByRole('columnheader', { name: 'Record' })).not.toBeInTheDocument();
  });

  it('says which record gave a picture when there are several', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockImplementation((id) =>
      Promise.resolve([picture(id, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z')]),
    );
    show([record(71), record(72, { sourceName: 'CV.ee' })]);
    const table = await screen.findByTestId('person-pictures');
    expect(within(table).getByRole('columnheader', { name: 'Record' })).toBeInTheDocument();
    expect(within(table).getByText('CV.ee')).toBeInTheDocument();
  });

  it('a picture that does not load says so in its own cell', async () => {
    vi.mocked(api.fetchMasiContactPictureBlob).mockRejectedValue(new Error('gone'));
    show();
    const table = await screen.findByTestId('person-pictures');
    expect(await within(table).findAllByText('not loaded')).toHaveLength(2);
  });

  it('asks only for the records that have a picture', async () => {
    show([record(71), record(72, { pictures: 0 })]);
    await screen.findByTestId('person-pictures');
    expect(api.fetchMasiContactPictures).toHaveBeenCalledTimes(1);
    expect(api.fetchMasiContactPictures).toHaveBeenCalledWith(71, expect.anything());
  });

  it('says when nothing could be loaded', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('down');
  });

  it('a person with no picture says so', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([]);
    show();
    expect(await screen.findByText('No picture kept.')).toBeInTheDocument();
  });

  it('frees exactly the thumbnails it made', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:a').mockReturnValueOnce('blob:b');
    const { unmount } = show();
    await screen.findByTestId('person-pictures');
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2));
    unmount();
    expect(vi.mocked(URL.revokeObjectURL).mock.calls.flat()).toEqual(
      expect.arrayContaining(['blob:a', 'blob:b']),
    );
  });

  it('stops asking once the person is left', async () => {
    vi.mocked(api.fetchMasiContactPictureBlob).mockReturnValue(new Promise(() => {}));
    const { unmount } = show();
    await screen.findByTestId('person-pictures');
    await vi.waitFor(() => expect(api.fetchMasiContactPictureBlob).toHaveBeenCalled());
    const signals = [
      vi.mocked(api.fetchMasiContactPictures).mock.calls[0][1],
      vi.mocked(api.fetchMasiPictureTries).mock.calls[0][1],
      vi.mocked(api.fetchMasiContactPictureBlob).mock.calls[0][2],
    ];
    expect(signals.map((signal) => signal?.aborted)).toEqual([false, false, false]);
    unmount();
    expect(signals.map((signal) => signal?.aborted)).toEqual([true, true, true]);
  });

  it('makes no thumbnail from an answer that lands after the person is left', async () => {
    let answer: (blob: Blob) => void = () => {};
    vi.mocked(api.fetchMasiContactPictureBlob).mockReturnValue(
      new Promise<Blob>((resolve) => {
        answer = resolve;
      }),
    );
    const { unmount } = show();
    await screen.findByTestId('person-pictures');
    await vi.waitFor(() => expect(api.fetchMasiContactPictureBlob).toHaveBeenCalled());
    unmount();
    answer(new Blob(['x']));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    ['source,asc', ['Gravatar', 'Name search', 'unavatar']],
    ['source,desc', ['unavatar', 'Name search', 'Gravatar']],
    ['size,asc', ['Name search', 'unavatar', 'Gravatar']],
    ['size,desc', ['Gravatar', 'unavatar', 'Name search']],
  ])('sorts by %s', async (sort, expected) => {
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([
      picture(1, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-02T09:00:00Z', 9000),
      picture(2, 'NAME_SEARCH', '2026-09-03T09:00:00Z', '2026-09-04T09:00:00Z', 1000),
      picture(3, 'UNAVATAR', '2026-09-05T09:00:00Z', '2026-09-06T09:00:00Z', 5000),
    ]);
    show([record(71)], `/?picturesSort=${sort}`);
    const table = await screen.findByTestId('person-pictures');
    expect(column(table, 1)).toEqual(expected);
  });

  it.each(['Source', 'Size'])('the %s header sorts', async (name) => {
    show();
    const table = await screen.findByTestId('person-pictures');
    await userEvent.click(within(table).getByRole('button', { name }));
    expect(within(table).getByRole('columnheader', { name: new RegExp(name) })).toHaveAttribute(
      'aria-sort',
      expect.stringMatching(/ascending|descending/),
    );
  });

  it('shows when each picture was added and last seen, its size, and how many there are', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([
      picture(1, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z', 51200),
    ]);
    show();
    const table = await screen.findByTestId('person-pictures');
    expect(column(table, 2)).toEqual([formatDateTime('2026-09-01T09:00:00Z')]);
    expect(column(table, 3)).toEqual([formatDateTime('2026-09-22T09:00:00Z')]);
    expect(column(table, 4)).toEqual(['50.0 KB']);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('collects the pictures of every record that has one', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockImplementation((id) =>
      Promise.resolve([picture(id, 'GRAVATAR', '2026-09-01T09:00:00Z', '2026-09-22T09:00:00Z')]),
    );
    show([record(71), record(72)]);
    const table = await screen.findByTestId('person-pictures');
    expect(column(table, 1)).toHaveLength(2);
  });

  it('asks no record when none has a picture, and the tries of this person', async () => {
    show([]);
    expect(await screen.findByText('No picture kept.')).toBeInTheDocument();
    expect(api.fetchMasiContactPictures).not.toHaveBeenCalled();
    expect(api.fetchMasiPictureTries).toHaveBeenCalledWith(5, expect.anything());
  });

  it('reads each try: used of the maximum, left, last asked, result, next ask', async () => {
    const lastTriedAt = '2026-09-12T06:00:00Z';
    const nextAskAt = new Date(Date.now() + 86_400_000).toISOString();
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 2,
      contacts: [
        {
          contactId: 71,
          sources: [
            tries({ tries: 1, max: 3, left: 2, lastTriedAt, lastOutcome: 'FOUND', nextAskAt }),
          ],
        },
      ],
    });
    show();
    const table = await screen.findByTestId('person-picture-tries');
    const cells = within(within(table).getAllByRole('row')[1])
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells).toEqual([
      'Gravatar',
      '1 of 3',
      '2',
      formatDateTime(lastTriedAt),
      'found',
      formatDateTime(nextAskAt),
    ]);
  });

  it('a result it has no word for reads as it came, and none as a dash', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 2,
      contacts: [
        {
          contactId: 71,
          sources: [
            tries({ source: 'GITHUB', lastOutcome: 'SOMETHING_NEW' }),
            tries({ source: 'LINKEDIN', lastOutcome: null }),
          ],
        },
      ],
    });
    show();
    const table = await screen.findByTestId('person-picture-tries');
    expect(column(table, 4)).toEqual(['SOMETHING_NEW', '—']);
  });

  it('a failure does not also say there is no picture', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockRejectedValue(new Error('down'));
    show();
    await screen.findByRole('alert');
    expect(screen.queryByText('No picture kept.')).not.toBeInTheDocument();
  });

  it('with one picture failing, the others are still drawn', async () => {
    vi.mocked(api.fetchMasiContactPictureBlob)
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValueOnce(new Blob(['x']));
    show();
    const table = await screen.findByTestId('person-pictures');
    expect(await within(table).findAllByRole('button', { name: /Open the picture/ })).toHaveLength(
      1,
    );
    expect(await within(table).findAllByText('not loaded')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
