import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHashcash } from '../hooks/useHashcash';

function resendButtonLabel(solving: boolean, loading: boolean) {
  if (solving) return 'Verifying...';
  if (loading) return 'Sending...';
  return 'Resend';
}

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { enabled: captchaEnabled, solving, solve: solveCaptcha } = useHashcash();

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Verification failed');
        }
        setSuccess(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Verification failed');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function handleResend() {
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    try {
      const captcha = captchaEnabled ? await solveCaptcha() : null;
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resendEmail.trim(),
          ...(captcha && { captchaChallenge: captcha.challenge, captchaNonce: captcha.nonce }),
        }),
      });
      setResendSent(true);
    } catch {
      // Show success anyway to prevent email enumeration
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <h2>Invalid Link</h2>
          <p>This verification link is invalid or missing.</p>
          <p className="auth-link">
            <Link to="/login">Go to Login</Link>
          </p>
        </div>
      </div>
    );
  }

  const resendBusy = resendLoading || solving;

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo.svg" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <h2>Email Verification</h2>
        {loading && <p>Verifying your email...</p>}
        {success && (
          <>
            <p>Your email has been verified successfully.</p>
            <p className="auth-link">
              <Link to="/login">Login to your account</Link>
            </p>
          </>
        )}
        {error && (
          <>
            <div className="error">{error}</div>
            {resendSent ? (
              <p>If an unverified account with that email exists, a new verification link has been sent.</p>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                  Enter your email to receive a new verification link:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn"
                    onClick={handleResend}
                    disabled={resendBusy || !resendEmail.trim()}
                  >
                    {resendButtonLabel(solving, resendLoading)}
                  </button>
                </div>
              </div>
            )}
            <p className="auth-link">
              <Link to="/login">Go to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
