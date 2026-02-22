import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
