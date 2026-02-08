import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import PageDetail from './pages/PageDetail';
import RssDashboard from './pages/RssDashboard';
import RssFeedDetail from './pages/RssFeedDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import MonitorConfig from './pages/MonitorConfig';

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
  const { isAuthenticated, username, logout } = useAuth();
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
          <h1 title={buildInfo}>
            <img src="/logo.svg" alt="" className="header-logo" />
            Monitor Dashboard
          </h1>
          {isAuthenticated && (
            <div className="header-user">
              <span className="header-username">{username}</span>
              <button className="btn btn-logout" onClick={logout}>Logout</button>
            </div>
          )}
        </div>
        {isAuthenticated && (
          <nav className="nav">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Monitors
            </Link>
            <Link to="/rss" className={location.pathname.startsWith('/rss') ? 'active' : ''}>
              RSS Feeds
            </Link>
            <Link to="/monitors" className={location.pathname === '/monitors' ? 'active' : ''}>
              Configuration
            </Link>
          </nav>
        )}
      </header>
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/page/:pageName" element={<ProtectedRoute><PageDetail /></ProtectedRoute>} />
          <Route path="/rss" element={<ProtectedRoute><RssDashboard /></ProtectedRoute>} />
          <Route path="/rss/:feedName" element={<ProtectedRoute><RssFeedDetail /></ProtectedRoute>} />
          <Route path="/monitors" element={<ProtectedRoute><MonitorConfig /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
