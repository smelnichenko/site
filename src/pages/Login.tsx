import { useEffect } from 'react';
import { login } from '../services/oidcClient';

function Login() {
  useEffect(() => {
    void login();
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <p>Redirecting to login...</p>
    </div>
  );
}

export default Login;
