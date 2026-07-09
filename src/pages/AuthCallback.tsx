import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { parseState } from '../services/oidcClient';

function deriveParamError(
  errorParam: string | null,
  errorDescription: string | null,
  code: string | null,
): string | null {
  if (errorParam) {
    return errorDescription || errorParam;
  }
  if (!code) {
    return 'No authorization code received';
  }
  return null;
}

function AuthCallback() {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();

  // These values come from the OAuth redirect URL, which is fixed for this component's
  // lifetime, so the synchronous error is derivable during render rather than set in an effect.
  const params = new URLSearchParams(globalThis.location.search);
  const code = params.get('code');
  const errorParam = params.get('error');
  const errorDescription = params.get('error_description');

  const paramError = deriveParamError(errorParam, errorDescription, code);

  // Only the async token-exchange failure needs to be state, since it resolves after render.
  const [asyncError, setAsyncError] = useState<string | null>(null);

  useEffect(() => {
    if (paramError || !code) {
      return;
    }

    const { returnTo } = parseState(params.get('state'));

    handleCallback(code)
      .then(() => navigate(returnTo, { replace: true }))
      .catch(e => {
        console.error('OIDC callback error:', e);
        setAsyncError(e instanceof Error ? e.message : 'OIDC login failed');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const error = paramError ?? asyncError;

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
