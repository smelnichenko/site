import { Link } from 'react-router-dom';
import { MonitorResult } from '../services/api';

interface PageCardProps {
  pageName: string;
  latestResult: MonitorResult | null;
  editUrl?: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function PageCard({ pageName, latestResult, editUrl }: Readonly<PageCardProps>) {
  return (
    <div className="card" data-testid="page-card">
      <div className="card-header">
        <Link to={`/page/${encodeURIComponent(pageName)}`} className="card-title">
          {pageName}
        </Link>
        <div className="badge-group">
          {editUrl && (
            <Link to={editUrl} className="status-badge edit">Edit</Link>
          )}
          {latestResult && (
            <span
              className={`status-badge ${latestResult.matched ? 'success' : 'error'}`}
            >
              {latestResult.matched ? 'OK' : 'Failed'}
            </span>
          )}
        </div>
      </div>
      {latestResult === null ? (
        <div className="loading">No data yet</div>
      ) : (
        <div>
          <div className="stat-value">
            {latestResult.extractedValue === null
              ? 'N/A'
              : latestResult.extractedValue.toLocaleString()}
          </div>
          <div className="stat-label">
            Last checked: {formatTimeAgo(latestResult.checkedAt)}
          </div>
          {latestResult.errorMessage && (
            <div className="error" style={{ marginTop: 12, fontSize: '0.85rem' }}>
              {latestResult.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PageCard;
