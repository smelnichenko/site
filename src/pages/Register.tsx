import { type SyntheticEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHashcash } from '../hooks/useHashcash';

function buttonLabel(solving: boolean, loading: boolean) {
  if (solving) return 'Verifying...';
  if (loading) return 'Registering...';
  return 'Register';
}

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { enabled: captchaEnabled, solving, solve: solveCaptcha } = useHashcash();

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const captcha = captchaEnabled ? await solveCaptcha() : null;
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(captcha && { captchaChallenge: captcha.challenge, captchaNonce: captcha.nonce }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <h2>Register</h2>
        {success ? (
          <>
            <p>Check your email to verify your account.</p>
            <p className="auth-link">
              <Link to="/login">Go to Login</Link>
            </p>
          </>
        ) : (
          <>
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
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button className="status-badge add full" type="submit" disabled={busy}>
                {buttonLabel(solving, loading)}
              </button>
            </form>
            <p className="auth-link">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
