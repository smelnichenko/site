import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHashcash } from '../hooks/useHashcash';

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
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from;
  const { enabled: captchaEnabled, solving, solve: solveCaptcha } = useHashcash();

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

  const busy = loading || solving;

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo.svg" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
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
