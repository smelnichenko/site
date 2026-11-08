import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PictureStatus from './PictureStatus';
import { daysToClear, perDay, readable, seconds } from './pictureRate';
import { collectMasiPictures, fetchMasiPictureStatus, MasiPictureStatus } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMasiPictureStatus: vi.fn(),
  collectMasiPictures: vi.fn(),
}));

const status = (over: Partial<MasiPictureStatus> = {}): MasiPictureStatus => ({
  enabled: true,
  face: false,
  perTick: 5,
  // as masi sends them: Java Durations in ISO-8601 (the fixture said '10m' and hid that the page printed PT10M raw)
  tick: 'PT10M',
  revisit: 'PT720H',
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
    // 5 a tick, 144 ticks a day: 1440 contacts waiting is 2 days (read as 24 ticks a day from PT10M, it said 12)
    expect(screen.getByText(/about 2 days at this rate/)).toBeInTheDocument();
  });

  it('says the rate in words, not in ISO-8601', async () => {
    vi.mocked(fetchMasiPictureStatus).mockResolvedValue(status({ perTick: 40 }));
    render(<PictureStatus />);

    expect(
      await screen.findByText(
        /40 contacts every 10 minutes, each revisited after 30 days\. Face matching off\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/PT10M|PT720H/)).not.toBeInTheDocument();
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

describe('seconds and readable', () => {
  it('reads a duration as masi sends it (ISO-8601) or as a config writes it', () => {
    expect(seconds('PT10M')).toBe(600);
    expect(seconds('PT720H')).toBe(2592000);
    expect(seconds('P30D')).toBe(2592000);
    expect(seconds('PT1H30M')).toBe(5400);
    expect(seconds('PT90S')).toBe(90);
    expect(seconds('10m')).toBe(600);
    expect(seconds('nonsense')).toBeNull();
  });

  it('says it in words, the largest units that fit', () => {
    expect(readable('PT10M')).toBe('10 minutes');
    expect(readable('PT720H')).toBe('30 days');
    expect(readable('PT1H')).toBe('1 hour');
    expect(readable('PT1H30M')).toBe('1 hour 30 minutes');
    expect(readable('P1D')).toBe('1 day');
    expect(readable('nonsense')).toBe('nonsense');
  });
});

describe('perDay', () => {
  it('turns a tick delay into ticks a day', () => {
    expect(perDay('10m')).toBe(144);
    expect(perDay('1h')).toBe(24);
    expect(perDay('30s')).toBe(2880);
    expect(perDay('PT10M')).toBe(144);
    expect(perDay('nonsense')).toBe(24);
  });
});
