import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PageDetail from './pages/PageDetail';
import RssDashboard from './pages/RssDashboard';
import RssFeedDetail from './pages/RssFeedDetail';

function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

const buildInfo = `${__GIT_HASH__} · ${formatBuildTime(__BUILD_TIME__)}`;

function App() {
  const location = useLocation();

  return (
    <div>
      <header className="header">
        <h1 title={buildInfo}>Monitor Dashboard</h1>
        <nav className="nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Pages
          </Link>
          <Link to="/rss" className={location.pathname.startsWith('/rss') ? 'active' : ''}>
            RSS Feeds
          </Link>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/page/:pageName" element={<PageDetail />} />
          <Route path="/rss" element={<RssDashboard />} />
          <Route path="/rss/:feedName" element={<RssFeedDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
