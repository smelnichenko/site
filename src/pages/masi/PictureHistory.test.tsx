import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../services/api';
import { PictureHistory } from './PictureHistory';

vi.mock('../../services/api');

function picture(
  id: number,
  source: string,
  createdAt: string,
  capturedAt: string,
): api.MasiContactPicture {
  return {
    id,
    source,
    sourceUrl: null,
    contentType: 'image/png',
    size: 2048,
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

function show() {
  return render(
    <MemoryRouter>
      <PictureHistory personId={5} contactIds={[71]} />
    </MemoryRouter>,
  );
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

  it('names the record only when the person has several', async () => {
    vi.mocked(api.fetchMasiPictureTries).mockResolvedValue({
      triesLeft: 6,
      contacts: [
        { contactId: 71, sources: [tries({})] },
        { contactId: 72, sources: [tries({})] },
      ],
    });
    show();
    expect(
      await within(await screen.findByTestId('person-picture-tries')).findByRole('columnheader', {
        name: 'Record',
      }),
    ).toBeInTheDocument();
  });

  it('says when nothing could be loaded', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByText('The pictures could not be loaded.')).toBeInTheDocument();
  });

  it('a person with no picture says so', async () => {
    vi.mocked(api.fetchMasiContactPictures).mockResolvedValue([]);
    show();
    expect(await screen.findByText('No picture kept.')).toBeInTheDocument();
  });

  it('frees the thumbnails it made', async () => {
    const { unmount } = show();
    await screen.findByTestId('person-pictures');
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
