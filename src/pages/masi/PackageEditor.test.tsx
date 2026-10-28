import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PackageEditor from './PackageEditor';
import { prepared } from './testUtils';

vi.mock('../../services/api', () => ({
  saveMasiPackageContent: vi.fn(),
}));

/** The operator's own words for a package: what they change is what masi is sent, nothing else. */
describe('PackageEditor', () => {
  it('sends the edited CV and letter, every role kept, a removed bullet gone, no dates', async () => {
    const api = await import('../../services/api');
    vi.mocked(api.saveMasiPackageContent).mockResolvedValue({
      ...prepared,
      editedAt: '2026-10-28T10:00:00Z',
    });
    const saved = vi.fn();
    render(<PackageEditor pkg={prepared} onSaved={saved} onCancel={() => undefined} />);

    const summary = screen.getByLabelText('Summary');
    await userEvent.clear(summary);
    await userEvent.type(summary, 'My own summary');
    const bullet = screen.getByLabelText('Senior Backend Engineer: bullet 1');
    await userEvent.clear(bullet);
    await userEvent.type(bullet, 'My own bullet');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Software Developer: one line' }));
    await userEvent.clear(screen.getByLabelText('Skills (comma-separated)'));
    await userEvent.type(screen.getByLabelText('Skills (comma-separated)'), 'Kafka, Java');
    await userEvent.clear(screen.getByLabelText('Cover letter'));
    await userEvent.type(screen.getByLabelText('Cover letter'), 'My letter');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));

    await waitFor(() => expect(saved).toHaveBeenCalled());
    const [id, body] = vi.mocked(api.saveMasiPackageContent).mock.calls[0];
    expect(id).toBe(11);
    expect(body.summary).toBe('My own summary');
    expect(body.coverLetter).toBe('My letter');
    expect(body.skills).toEqual(['Kafka', 'Java']);
    expect(body.roles).toHaveLength(2);
    expect(body.roles[0].bullets).toEqual([{ achievementIndex: 0, text: 'My own bullet' }]);
    expect(body.roles[1].collapsed).toBe(false); // one line in the fixture, unticked
    expect(body.roles[0]).not.toHaveProperty('period');
  });

  it('drops a bullet the operator removes', async () => {
    const api = await import('../../services/api');
    vi.mocked(api.saveMasiPackageContent).mockClear();
    vi.mocked(api.saveMasiPackageContent).mockResolvedValue(prepared);
    render(<PackageEditor pkg={prepared} onSaved={() => undefined} onCancel={() => undefined} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Senior Backend Engineer: bullet 1' }),
    );
    expect(screen.queryByLabelText('Senior Backend Engineer: bullet 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    await waitFor(() => expect(api.saveMasiPackageContent).toHaveBeenCalled());
    expect(vi.mocked(api.saveMasiPackageContent).mock.calls[0][1].roles[0].bullets).toEqual([]);
  });

  it("says what masi refused and keeps the operator's text", async () => {
    const api = await import('../../services/api');
    vi.mocked(api.saveMasiPackageContent).mockRejectedValue(
      new Error('package 11 is APPLIED: only PREPARED or REVIEWED can be edited'),
    );
    const saved = vi.fn();
    render(<PackageEditor pkg={prepared} onSaved={saved} onCancel={() => undefined} />);
    await userEvent.type(screen.getByLabelText('Summary'), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'Save edits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'only PREPARED or REVIEWED can be edited',
    );
    expect(screen.getByLabelText('Summary')).toHaveValue(`${prepared.tunedCv.summary} more`);
    expect(saved).not.toHaveBeenCalled();
  });
});
