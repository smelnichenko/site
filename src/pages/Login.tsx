import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHashcash } from '../hooks/useHashcash';
import { OIDC_CONFIG } from '../config/oidc';

function buttonLabel(solving: boolean, loading: boolean) {
  if (solving) return 'Verifying...';
  if (loading) return 'Logging in...';
  return 'Login';
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;
  const { enabled: captchaEnabled, solving, solve: solveCaptcha } = useHashcash();
  const needsVerification = error?.toLowerCase().includes('verify your email');

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const captcha = captchaEnabled
        ? await solveCaptcha().then(r => ({ captchaChallenge: r.challenge, captchaNonce: r.nonce }))
        : undefined;
      const lastPath = await login(email, password, captcha);
      const isValidPath = (p: string) => p.startsWith('/') && !p.startsWith('//');
      let redirectTo = '/';
      if (from && from !== '/' && isValidPath(from)) {
        redirectTo = from;
      } else if (lastPath && isValidPath(lastPath)) {
        redirectTo = lastPath;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) return;
    setResendLoading(true);
    try {
      const captcha = captchaEnabled ? await solveCaptcha() : null;
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
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

  const busy = loading || solving;
  const resendBusy = resendLoading || solving;

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo.svg" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        {needsVerification && (
          <div style={{ marginTop: '0.5rem' }}>
            {resendSent ? (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                If an unverified account with that email exists, a new verification link has been sent.
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendBusy || !email.trim()}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                {resendBusy ? 'Sending...' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="status-badge add full" type="submit" disabled={busy}>
            {buttonLabel(solving, loading)}
          </button>
        </form>
        <div style={{ position: 'relative', textAlign: 'center', margin: '16px 0' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--card-bg, #fff)',
            padding: '0 12px',
            color: '#888',
            fontSize: '0.85rem',
          }}>or</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams({
              client_id: OIDC_CONFIG.clientId,
              redirect_uri: OIDC_CONFIG.redirectUri,
              response_type: 'code',
              scope: 'openid profile email',
            });
            globalThis.location.href = `${OIDC_CONFIG.authority}/protocol/openid-connect/auth?${params}`;
          }}
          disabled={busy}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Sign in with Keycloak
        </button>
        <p className="auth-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
