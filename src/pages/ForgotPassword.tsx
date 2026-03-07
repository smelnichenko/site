import { useState } from 'react';
import { Link } from 'react-router-dom';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo.svg" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <h2>Reset Password</h2>
        {submitted ? (
          <>
            <p>If an account with that email exists, a reset link has been sent. Check your inbox.</p>
            <p className="auth-link">
              <Link to="/login">Back to Login</Link>
            </p>
          </>
        ) : (
          <>
            {error && <div className="error">{error}</div>}
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.85rem', color: '#856404' }}>
              Resetting your password will revoke access to encrypted chat history.
            </div>
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
              <button className="status-badge add full" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="auth-link">
              <Link to="/login">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
