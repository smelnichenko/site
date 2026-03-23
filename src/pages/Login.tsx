import { useEffect } from 'react';
import { OIDC_CONFIG } from '../config/oidc';

function Login() {
  useEffect(() => {
    const params = new URLSearchParams({
      client_id: OIDC_CONFIG.clientId,
      redirect_uri: OIDC_CONFIG.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
    });
    globalThis.location.href = `${OIDC_CONFIG.authority}/protocol/openid-connect/auth?${params}`;
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <p>Redirecting to login...</p>
    </div>
  );
}

export default Login;
