import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PictureStatus from './PictureStatus';
import { daysToClear, perDay } from './pictureRate';
import { collectMasiPictures, fetchMasiPictureStatus, MasiPictureStatus } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiPictureStatus: vi.fn(),
  collectMasiPictures: vi.fn(),
}));

const status = (over: Partial<MasiPictureStatus> = {}): MasiPictureStatus => ({
  enabled: true,
  face: false,
  perTick: 5,
  tick: '10m',
  revisit: '30d',
  contactsWithAPicture: 411,
  lookupsByOutcome: { FOUND: 411, NONE: 2643, FAILED: 0 },
  askedToday: 12,
  dueNow: 1440,
  ...over,
});

describe('PictureStatus', () => {
  beforeEach(() => {
    vi.mocked(fetchMasiPictureStatus).mockReset();
    vi.mocked(collectMasiPictures).mockReset();
  });

  it('says it is collecting, what it found and how long the backlog takes', async () => {
    vi.mocked(fetchMasiPictureStatus).mockResolvedValue(status());
    render(<PictureStatus />);

    expect(await screen.findByText('collecting')).toBeInTheDocument();
    expect(screen.getByText('411')).toBeInTheDocument();
    expect(screen.getByText(/411 \/ 2643 \//)).toBeInTheDocument();
    // 5 a tick, 144 ticks a day: 1440 contacts waiting is 2 days
    expect(screen.getByText(/about 2 days at this rate/)).toBeInTheDocument();
  });

  it('says the lane is off and offers no pass, instead of a button that would do nothing', async () => {
    vi.mocked(fetchMasiPictureStatus).mockResolvedValue(status({ enabled: false, dueNow: 0 }));
    render(<PictureStatus />);

    expect(await screen.findByText('switched off')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collect pictures now/i })).not.toBeInTheDocument();
    expect(screen.getByText(/contact-pictures\.enabled/)).toBeInTheDocument();
  });

  it('starts the operator pass and says how many contacts it took on', async () => {
    vi.mocked(fetchMasiPictureStatus).mockResolvedValue(status());
    vi.mocked(collectMasiPictures).mockResolvedValue({ started: 37 });
    render(<PictureStatus />);

    await userEvent.click(await screen.findByRole('button', { name: /collect pictures now/i }));

    expect(await screen.findByText(/pass over 37 contacts started/)).toBeInTheDocument();
    expect(collectMasiPictures).toHaveBeenCalledTimes(1);
  });

  it('a failed status read is an error on the panel, not a blank page', async () => {
    vi.mocked(fetchMasiPictureStatus).mockRejectedValue(new Error('Permission denied'));
    render(<PictureStatus />);

    expect(await screen.findByText(/Permission denied/)).toBeInTheDocument();
  });
});

describe('daysToClear', () => {
  it('divides the waiting contacts by what a day of ticks takes on', () => {
    expect(daysToClear(1440, 5, '10m')).toBe(2);
    expect(daysToClear(1, 5, '10m')).toBe(1);
    expect(daysToClear(0, 5, '10m')).toBeNull();
  });
});

describe('perDay', () => {
  it('turns a tick delay into ticks a day', () => {
    expect(perDay('10m')).toBe(144);
    expect(perDay('1h')).toBe(24);
    expect(perDay('30s')).toBe(2880);
    expect(perDay('nonsense')).toBe(24);
  });
});
