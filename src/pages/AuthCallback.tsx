import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { OIDC_CONFIG } from '../config/oidc';

function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const { loginWithCode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    loginWithCode(code, OIDC_CONFIG.redirectUri)
      .then(lastPath => navigate(lastPath || '/', { replace: true }))
      .catch(e => setError(e instanceof Error ? e.message : 'OIDC login failed'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <h2>Login Failed</h2>
          <div className="error">{error}</div>
          <p className="auth-link">
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="card auth-card">
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" />
          <p>Logging in...</p>
        </div>
      </div>
    </div>
  );
}

export default AuthCallback;
