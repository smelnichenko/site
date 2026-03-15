import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLoading } from './contexts/LoadingContext';
import { saveLastPath } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import PendingApproval from './components/PendingApproval';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';

// Lazy-load pages that pull in heavy dependencies (recharts/d3)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PageDetail = lazy(() => import('./pages/PageDetail'));
const RssDashboard = lazy(() => import('./pages/RssDashboard'));
const RssFeedDetail = lazy(() => import('./pages/RssFeedDetail'));
const MonitorConfig = lazy(() => import('./pages/MonitorConfig'));
const Chat = lazy(() => import('./pages/Chat'));
const Game = lazy(() => import('./pages/Game'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Admin = lazy(() => import('./pages/Admin'));

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
  const { isAuthenticated, email, logout, hasPermission, permissions } = useAuth();
  const { loading } = useLoading();
  const [buildInfo, setBuildInfo] = useState(
    `FE: ${__GIT_HASH__} · ${formatBuildTime(__BUILD_TIME__)}`
  );

  const lastSavedPath = useRef<string | null>(null);
  const hasPendingApproval = isAuthenticated && permissions.length === 0;

  useEffect(() => {
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
    if (isAuthenticated && !publicPaths.includes(location.pathname) && location.pathname !== lastSavedPath.current) {
      lastSavedPath.current = location.pathname;
      saveLastPath(location.pathname).catch(() => {});
    }
  }, [location.pathname, isAuthenticated]);

  useEffect(() => {
    fetch('/api/build-info')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch build info');
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
            {isAuthenticated && !hasPendingApproval && (
              <nav className={`nav${loading ? ' disabled' : ''}`}>
                {hasPermission('METRICS') && (
                  <>
                    <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                      Monitors
                    </Link>
                    <Link to="/rss" className={location.pathname.startsWith('/rss') ? 'active' : ''}>
                      RSS Feeds
                    </Link>
                    <Link to="/monitors" className={location.pathname === '/monitors' ? 'active' : ''}>
                      Configuration
                    </Link>
                  </>
                )}
                {hasPermission('CHAT') && (
                  <Link to="/chat" className={location.pathname.startsWith('/chat') ? 'active' : ''}>
                    Chat
                  </Link>
                )}
                {hasPermission('EMAIL') && (
                  <Link to="/inbox" className={location.pathname === '/inbox' ? 'active' : ''}>
                    Inbox
                  </Link>
                )}
                {hasPermission('PLAY') && (
                  <Link to="/game" className={location.pathname === '/game' ? 'active' : ''}>
                    Game
                  </Link>
                )}
                {hasPermission('MANAGE_USERS') && (
                  <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
                    Admin
                  </Link>
                )}
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
        {hasPendingApproval ? (
          <PendingApproval />
        ) : (
          <Suspense fallback={<div className="loading-overlay"><div className="loading-spinner" /></div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/" element={<ProtectedRoute permission="METRICS"><Dashboard /></ProtectedRoute>} />
            <Route path="/page/:pageName" element={<ProtectedRoute permission="METRICS"><PageDetail /></ProtectedRoute>} />
            <Route path="/rss" element={<ProtectedRoute permission="METRICS"><RssDashboard /></ProtectedRoute>} />
            <Route path="/rss/:feedName" element={<ProtectedRoute permission="METRICS"><RssFeedDetail /></ProtectedRoute>} />
            <Route path="/monitors" element={<ProtectedRoute permission="METRICS"><MonitorConfig /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute permission="CHAT"><Chat /></ProtectedRoute>} />
            <Route path="/chat/:channelId" element={<ProtectedRoute permission="CHAT"><Chat /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute permission="EMAIL"><Inbox /></ProtectedRoute>} />
            <Route path="/game" element={<ProtectedRoute permission="PLAY"><Game /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute permission="MANAGE_USERS"><Admin /></ProtectedRoute>} />
          </Routes>
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
