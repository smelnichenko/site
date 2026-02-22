import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLoading } from './contexts/LoadingContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import PageDetail from './pages/PageDetail';
import RssDashboard from './pages/RssDashboard';
import RssFeedDetail from './pages/RssFeedDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import MonitorConfig from './pages/MonitorConfig';
import Game from './pages/Game';

function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

function App() {
  const location = useLocation();
  const { isAuthenticated, email, logout } = useAuth();
  const { loading } = useLoading();
  const [buildInfo, setBuildInfo] = useState(
    `FE: ${__GIT_HASH__} · ${formatBuildTime(__BUILD_TIME__)}`
  );

  useEffect(() => {
    fetch('/api/build-info')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { gitHash: string; buildTime: string }) => {
        const feLine = `FE: ${__GIT_HASH__} · ${formatBuildTime(__BUILD_TIME__)}`;
        const beLine = `BE: ${data.gitHash}${data.buildTime ? ' · ' + formatBuildTime(data.buildTime) : ''}`;
        setBuildInfo(`${feLine}\n${beLine}`);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <header className="header">
        <div className="header-top">
          <div className="header-side">
            {isAuthenticated && (
              <nav className={`nav${loading ? ' disabled' : ''}`}>
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                  Monitors
                </Link>
                <Link to="/rss" className={location.pathname.startsWith('/rss') ? 'active' : ''}>
                  RSS Feeds
                </Link>
                <Link to="/monitors" className={location.pathname === '/monitors' ? 'active' : ''}>
                  Configuration
                </Link>
                <Link to="/game" className={location.pathname === '/game' ? 'active' : ''}>
                  Game
                </Link>
              </nav>
            )}
          </div>
          <img src="/logo.svg" alt="" className="header-logo" title={buildInfo} />
          <div className="header-side">
            {isAuthenticated && (
              <div className="header-user">
                <span className="header-username">{email}</span>
                <button className="btn-logout" onClick={logout} disabled={loading}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/page/:pageName" element={<ProtectedRoute><PageDetail /></ProtectedRoute>} />
          <Route path="/rss" element={<ProtectedRoute><RssDashboard /></ProtectedRoute>} />
          <Route path="/rss/:feedName" element={<ProtectedRoute><RssFeedDetail /></ProtectedRoute>} />
          <Route path="/monitors" element={<ProtectedRoute><MonitorConfig /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
