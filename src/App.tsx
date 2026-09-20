import { useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLoading } from './contexts/LoadingContext';
import { saveLastPath } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import PendingApproval from './components/PendingApproval';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import AuthCallback from './pages/AuthCallback';

// Lazy-load pages that pull in heavy dependencies (recharts/d3)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PageDetail = lazy(() => import('./pages/PageDetail'));
const RssDashboard = lazy(() => import('./pages/RssDashboard'));
const RssFeedDetail = lazy(() => import('./pages/RssFeedDetail'));
const MonitorConfig = lazy(() => import('./pages/MonitorConfig'));
const Chat = lazy(() => import('./pages/Chat'));
const Game = lazy(() => import('./pages/Game'));
const Chess = lazy(() => import('./pages/Chess'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Admin = lazy(() => import('./pages/Admin'));
const MasiCv = lazy(() => import('./pages/masi/MasiCv'));
const MasiDashboard = lazy(() => import('./pages/masi/MasiDashboard'));
const MasiJobs = lazy(() => import('./pages/masi/MasiJobs'));
const MasiJobDetail = lazy(() => import('./pages/masi/MasiJobDetail'));
const MasiJobAdd = lazy(() => import('./pages/masi/MasiJobAdd'));
const MasiPackages = lazy(() => import('./pages/masi/MasiPackages'));
const MasiPackageDetail = lazy(() => import('./pages/masi/MasiPackageDetail'));
const MasiCompanies = lazy(() => import('./pages/masi/MasiCompanies'));
const MasiCompanyDetail = lazy(() => import('./pages/masi/MasiCompanyDetail'));
const MasiContacts = lazy(() => import('./pages/masi/MasiContacts'));
const MasiSources = lazy(() => import('./pages/masi/MasiSources'));
const MasiReports = lazy(() => import('./pages/masi/MasiReports'));
const MasiReportDetail = lazy(() => import('./pages/masi/MasiReportDetail'));

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
  const { isAuthenticated, email, logout, hasPermission, permissions, initializing } = useAuth();
  const { loading } = useLoading();
  const buildInfo = `${__GIT_HASH__} · ${formatBuildTime(__BUILD_TIME__)}`;

  const lastSavedPath = useRef<string | null>(null);
  const hasPendingApproval = isAuthenticated && permissions.length === 0;

  useEffect(() => {
    const publicPaths = ['/login', '/verify-email', '/auth/callback'];
    if (
      isAuthenticated &&
      !publicPaths.includes(location.pathname) &&
      location.pathname !== lastSavedPath.current
    ) {
      lastSavedPath.current = location.pathname;
      saveLastPath(location.pathname).catch(() => {});
    }
  }, [location.pathname, isAuthenticated]);

  if (initializing) {
    return (
      <div>
        <header className="header">
          <div className="header-top">
            <div className="header-side" />
            <img src="/logo.svg" alt="" className="header-logo" title={buildInfo} />
            <div className="header-side" />
          </div>
        </header>
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

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
                    <Link
                      to="/rss"
                      className={location.pathname.startsWith('/rss') ? 'active' : ''}
                    >
                      RSS Feeds
                    </Link>
                    <Link
                      to="/monitors"
                      className={location.pathname === '/monitors' ? 'active' : ''}
                    >
                      Configuration
                    </Link>
                  </>
                )}
                {hasPermission('CHAT') && (
                  <Link
                    to="/chat"
                    className={location.pathname.startsWith('/chat') ? 'active' : ''}
                  >
                    Chat
                  </Link>
                )}
                {hasPermission('EMAIL') && (
                  <Link to="/inbox" className={location.pathname === '/inbox' ? 'active' : ''}>
                    Inbox
                  </Link>
                )}
                {hasPermission('PLAY') && (
                  <>
                    <Link to="/chess" className={location.pathname === '/chess' ? 'active' : ''}>
                      Chess
                    </Link>
                    <Link to="/game" className={location.pathname === '/game' ? 'active' : ''}>
                      Game
                    </Link>
                  </>
                )}
                {hasPermission('JOBS') && (
                  <Link
                    to="/masi"
                    className={location.pathname.startsWith('/masi') ? 'active' : ''}
                  >
                    Jobs
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
                <button className="btn-logout" onClick={logout} disabled={loading}>
                  Logout
                </button>
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
          <Suspense
            fallback={
              <div className="loading-overlay">
                <div className="loading-spinner" />
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute permission="METRICS">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/page/:pageName"
                element={
                  <ProtectedRoute permission="METRICS">
                    <PageDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rss"
                element={
                  <ProtectedRoute permission="METRICS">
                    <RssDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rss/:feedName"
                element={
                  <ProtectedRoute permission="METRICS">
                    <RssFeedDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/monitors"
                element={
                  <ProtectedRoute permission="METRICS">
                    <MonitorConfig />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute permission="CHAT">
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/:channelId"
                element={
                  <ProtectedRoute permission="CHAT">
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/cv"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiCv />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/jobs"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiJobs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/jobs/add"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiJobAdd />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/jobs/:id"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiJobDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/packages"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiPackages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/packages/:id"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiPackageDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/companies"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiCompanies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/companies/:id"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiCompanyDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/contacts"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiContacts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/sources"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiSources />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/reports"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masi/reports/:id"
                element={
                  <ProtectedRoute permission="JOBS">
                    <MasiReportDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inbox"
                element={
                  <ProtectedRoute permission="EMAIL">
                    <Inbox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chess"
                element={
                  <ProtectedRoute permission="PLAY">
                    <Chess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/game"
                element={
                  <ProtectedRoute permission="PLAY">
                    <Game />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute permission="MANAGE_USERS">
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
