import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MasiJobAdd from './MasiJobAdd';
import { job, renderAt } from './testUtils';

vi.mock('../../services/api', () => ({
  addMasiJobManually: vi.fn(),
}));
const api = await import('../../services/api');

beforeEach(() => {
  vi.mocked(api.addMasiJobManually).mockReset();
});

describe('MasiJobAdd', () => {
  it('sends what was pasted and opens the job it became', async () => {
    vi.mocked(api.addMasiJobManually).mockResolvedValue({ ...job, id: 41 });
    renderAt('/masi/jobs/add', '/masi/jobs/add', <MasiJobAdd />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Posting URL'), ' https://www.linkedin.com/jobs/view/1 ');
    await user.type(screen.getByLabelText('Company'), 'Nortal AS');
    await user.type(screen.getByLabelText('Title'), 'Staff Engineer');
    await user.type(screen.getByLabelText('Location'), 'Tallinn');
    await user.type(screen.getByLabelText('Description'), 'Own the platform.');
    await user.type(screen.getByLabelText('Open until'), '2026-10-31');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await waitFor(() => expect(api.addMasiJobManually).toHaveBeenCalledTimes(1));
    expect(api.addMasiJobManually).toHaveBeenCalledWith({
      url: 'https://www.linkedin.com/jobs/view/1',
      company: 'Nortal AS',
      title: 'Staff Engineer',
      location: 'Tallinn',
      description: 'Own the platform.',
      // the END of that day in Tallinn: a date typed by the operator runs through the day it names
      expiresAt: '2026-10-31T21:59:59.000Z',
    });
    // the job it became — which may be one a board already shows
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
  });

  it('leaves the deadline to the server when none is typed, and says what that means', async () => {
    vi.mocked(api.addMasiJobManually).mockResolvedValue({ ...job, id: 42 });
    renderAt('/masi/jobs/add', '/masi/jobs/add', <MasiJobAdd />);
    const user = userEvent.setup();
    expect(screen.getByText(/never fetched/i)).toBeInTheDocument();
    expect(screen.getByText(/30 days/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Posting URL'), 'https://www.linkedin.com/jobs/view/2');
    await user.type(screen.getByLabelText('Company'), 'Wise');
    await user.type(screen.getByLabelText('Title'), 'Engineer');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await waitFor(() => expect(api.addMasiJobManually).toHaveBeenCalledTimes(1));
    expect(api.addMasiJobManually).toHaveBeenCalledWith({
      url: 'https://www.linkedin.com/jobs/view/2',
      company: 'Wise',
      title: 'Engineer',
    });
  });

  it('shows why the server refused, and keeps what was typed', async () => {
    vi.mocked(api.addMasiJobManually).mockRejectedValue(new Error('the deadline is already over'));
    renderAt('/masi/jobs/add', '/masi/jobs/add', <MasiJobAdd />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Posting URL'), 'https://www.linkedin.com/jobs/view/3');
    await user.type(screen.getByLabelText('Company'), 'Wise');
    await user.type(screen.getByLabelText('Title'), 'Engineer');
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('the deadline is already over');
    expect(screen.getByLabelText('Title')).toHaveValue('Engineer');
    expect(screen.queryByTestId('elsewhere')).not.toBeInTheDocument();
  });
});
