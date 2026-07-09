import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from './VerifyEmail';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../hooks/useHashcash', () => ({
  useHashcash: () => ({
    enabled: false,
    solving: false,
    solve: vi.fn().mockResolvedValue({ challenge: '', nonce: '' }),
  }),
}));

let mockToken = 'valid-token';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [{ get: (key: string) => (key === 'token' ? mockToken : null) }],
  };
});

beforeEach(() => {
  mockFetch.mockReset();
  mockToken = 'valid-token';
});

function renderVerifyEmail() {
  return render(
    <MemoryRouter>
      <VerifyEmail />
    </MemoryRouter>,
  );
}

describe('VerifyEmail', () => {
  it('auto-calls verify API on mount with token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Verified' }),
    });
    renderVerifyEmail();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/verify-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Verifying your email...')).not.toBeInTheDocument(),
    );
  });

  it('shows success message after verification', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Verified' }),
    });
    renderVerifyEmail();

    expect(
      await screen.findByText('Your email has been verified successfully.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Login to your account')).toHaveAttribute('href', '/login');
  });

  it('shows error message on verification failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Token expired' }),
    });
    renderVerifyEmail();

    expect(await screen.findByText('Token expired')).toBeInTheDocument();
  });

  it('shows invalid link when no token present', () => {
    mockToken = '';
    renderVerifyEmail();

    expect(screen.getByText('Invalid Link')).toBeInTheDocument();
    expect(screen.getByText(/verification link is invalid/i)).toBeInTheDocument();
  });

  it('shows resend form on verification error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Token expired' }),
    });
    renderVerifyEmail();

    expect(await screen.findByText('Token expired')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
  });

  it('sends resend-verification request and shows success', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Token expired' }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const user = userEvent.setup();
    renderVerifyEmail();

    await screen.findByText('Token expired');
    await user.type(screen.getByPlaceholderText('your@email.com'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/resend-verification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        }),
      );
    });
    expect(await screen.findByText(/new verification link has been sent/i)).toBeInTheDocument();
  });
  it('shows the spinner again and clears the old result when the token changes without a remount', async () => {
    // React Router swaps ?token= in place, so this route re-verifies without remounting. The lazy
    // useState initializer only covers the FIRST token; without a per-token reset the second
    // verification runs with no spinner and the first attempt's result still on screen.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Verified' }),
    });
    const { rerender } = renderVerifyEmail();
    expect(await screen.findByText(/verified successfully/i)).toBeInTheDocument();

    let releaseSecondVerify!: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseSecondVerify = resolve;
      }),
    );
    mockToken = 'second-token';
    rerender(
      <MemoryRouter>
        <VerifyEmail />
      </MemoryRouter>,
    );

    // positive: the spinner is back for the second token
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
    // negative: the first token's success must not still be on screen
    expect(screen.queryByText(/verified successfully/i)).not.toBeInTheDocument();

    releaseSecondVerify({ ok: true, json: () => Promise.resolve({ message: 'Verified' }) });
    expect(await screen.findByText(/verified successfully/i)).toBeInTheDocument();
  });
});
