import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { login } from '../services/oidcClient';

function Login() {
  const location = useLocation();

  useEffect(() => {
    const returnTo = (location.state as { from?: string })?.from || '/';
    void login(returnTo);
  }, [location]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <p>Redirecting to login...</p>
    </div>
  );
}

export default Login;
