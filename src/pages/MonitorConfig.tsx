import { useEffect, useState } from 'react';
import {
  PageMonitorConfig, PageMonitorRequest, RssFeedMonitorConfig, RssFeedMonitorRequest,
  fetchPageMonitorConfigs, createPageMonitor, updatePageMonitor, deletePageMonitor,
  fetchRssFeedMonitorConfigs, createRssFeedMonitor, updateRssFeedMonitor, deleteRssFeedMonitor,
} from '../services/api';

// --- Page Monitor Form ---

interface PageFormState {
  name: string;
  url: string;
  pattern: string;
  cron: string;
  enabled: boolean;
}

const emptyPageForm: PageFormState = { name: '', url: '', pattern: '', cron: '0 0 * * * *', enabled: true };

function PageMonitorForm({ initial, onSave, onCancel }: {
  initial?: PageFormState;
  onSave: (data: PageMonitorRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PageFormState>(initial || emptyPageForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Cron</label>
          <input value={form.cron} onChange={e => setForm({ ...form, cron: e.target.value })} required placeholder="0 0 * * * *" />
        </div>
      </div>
      <div className="form-group">
        <label>URL</label>
        <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
      </div>
      <div className="form-group">
        <label>Pattern (regex)</label>
        <input value={form.pattern} onChange={e => setForm({ ...form, pattern: e.target.value })} required />
      </div>
      <div className="form-actions">
        <label className="toggle-label">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
          Enabled
        </label>
        <div>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </form>
  );
}

// --- RSS Feed Form ---

interface CollectionFormState {
  name: string;
  metrics: { name: string; keywords: string }[];
}

interface RssFormState {
  name: string;
  url: string;
  cron: string;
  fetchContent: boolean;
  maxArticles: number;
  enabled: boolean;
  collections: CollectionFormState[];
}

const emptyRssForm: RssFormState = {
  name: '', url: '', cron: '0 0 * * * *', fetchContent: false, maxArticles: 30, enabled: true,
  collections: [],
};

function RssFeedForm({ initial, onSave, onCancel }: {
  initial?: RssFormState;
  onSave: (data: RssFeedMonitorRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<RssFormState>(initial || emptyRssForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        collections: form.collections.map(c => ({
          name: c.name,
          metrics: c.metrics.map(m => ({ name: m.name, keywords: m.keywords.split(',').map(k => k.trim()).filter(Boolean) })),
        })),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addCollection = () => setForm({ ...form, collections: [...form.collections, { name: '', metrics: [] }] });
  const removeCollection = (i: number) => setForm({ ...form, collections: form.collections.filter((_, idx) => idx !== i) });
  const updateCollection = (i: number, c: CollectionFormState) => {
    const cols = [...form.collections];
    cols[i] = c;
    setForm({ ...form, collections: cols });
  };
  const addMetric = (ci: number) => {
    const cols = [...form.collections];
    cols[ci] = { ...cols[ci], metrics: [...cols[ci].metrics, { name: '', keywords: '' }] };
    setForm({ ...form, collections: cols });
  };
  const removeMetric = (ci: number, mi: number) => {
    const cols = [...form.collections];
    cols[ci] = { ...cols[ci], metrics: cols[ci].metrics.filter((_, idx) => idx !== mi) };
    setForm({ ...form, collections: cols });
  };
  const updateMetric = (ci: number, mi: number, m: { name: string; keywords: string }) => {
    const cols = [...form.collections];
    const metrics = [...cols[ci].metrics];
    metrics[mi] = m;
    cols[ci] = { ...cols[ci], metrics };
    setForm({ ...form, collections: cols });
  };

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Cron</label>
          <input value={form.cron} onChange={e => setForm({ ...form, cron: e.target.value })} required />
        </div>
      </div>
      <div className="form-group">
        <label>URL</label>
        <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Max Articles</label>
          <input type="number" value={form.maxArticles} onChange={e => setForm({ ...form, maxArticles: parseInt(e.target.value) || 30 })} />
        </div>
        <label className="toggle-label">
          <input type="checkbox" checked={form.fetchContent} onChange={e => setForm({ ...form, fetchContent: e.target.checked })} />
          Fetch Content
        </label>
      </div>

      <div className="collections-section">
        <div className="section-header">
          <strong>Collections</strong>
          <button type="button" className="btn btn-sm" onClick={addCollection}>+ Collection</button>
        </div>
        {form.collections.map((col, ci) => (
          <div key={ci} className="collection-block">
            <div className="form-row">
              <div className="form-group">
                <label>Collection Name</label>
                <input value={col.name} onChange={e => updateCollection(ci, { ...col, name: e.target.value })} required />
              </div>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeCollection(ci)}>Remove</button>
            </div>
            {col.metrics.map((m, mi) => (
              <div key={mi} className="metric-row">
                <input placeholder="Metric name" value={m.name} onChange={e => updateMetric(ci, mi, { ...m, name: e.target.value })} required />
                <input placeholder="Keywords (comma-separated)" value={m.keywords} onChange={e => updateMetric(ci, mi, { ...m, keywords: e.target.value })} required />
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeMetric(ci, mi)}>x</button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => addMetric(ci)}>+ Metric</button>
          </div>
        ))}
      </div>

      <div className="form-actions">
        <label className="toggle-label">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
          Enabled
        </label>
        <div>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </form>
  );
}

// --- Main Config Page ---

function MonitorConfig() {
  const [pageMonitors, setPageMonitors] = useState<PageMonitorConfig[]>([]);
  const [rssMonitors, setRssMonitors] = useState<RssFeedMonitorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<PageMonitorConfig | null>(null);
  const [editingRss, setEditingRss] = useState<RssFeedMonitorConfig | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showNewRss, setShowNewRss] = useState(false);

  const loadData = async () => {
    try {
      const [pages, feeds] = await Promise.all([fetchPageMonitorConfigs(), fetchRssFeedMonitorConfigs()]);
      setPageMonitors(pages);
      setRssMonitors(feeds);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreatePage = async (data: PageMonitorRequest) => {
    await createPageMonitor(data);
    setShowNewPage(false);
    await loadData();
  };

  const handleUpdatePage = async (data: PageMonitorRequest) => {
    if (!editingPage) return;
    await updatePageMonitor(editingPage.id, data);
    setEditingPage(null);
    await loadData();
  };

  const handleDeletePage = async (id: number) => {
    await deletePageMonitor(id);
    await loadData();
  };

  const handleCreateRss = async (data: RssFeedMonitorRequest) => {
    await createRssFeedMonitor(data);
    setShowNewRss(false);
    await loadData();
  };

  const handleUpdateRss = async (data: RssFeedMonitorRequest) => {
    if (!editingRss) return;
    await updateRssFeedMonitor(editingRss.id, data);
    setEditingRss(null);
    await loadData();
  };

  const handleDeleteRss = async (id: number) => {
    await deleteRssFeedMonitor(id);
    await loadData();
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      {/* Page Monitors */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Page Monitors</span>
          {!showNewPage && !editingPage && (
            <button className="btn btn-primary" onClick={() => setShowNewPage(true)}>+ Add Page Monitor</button>
          )}
        </div>

        {showNewPage && (
          <PageMonitorForm onSave={handleCreatePage} onCancel={() => setShowNewPage(false)} />
        )}

        {pageMonitors.length === 0 && !showNewPage ? (
          <p className="empty-state">No page monitors configured. Click "+ Add Page Monitor" to create one.</p>
        ) : (
          <div className="config-list">
            {pageMonitors.map(pm => (
              <div key={pm.id} className="config-item">
                {editingPage?.id === pm.id ? (
                  <PageMonitorForm
                    initial={{ name: pm.name, url: pm.url, pattern: pm.pattern, cron: pm.cron, enabled: pm.enabled }}
                    onSave={handleUpdatePage}
                    onCancel={() => setEditingPage(null)}
                  />
                ) : (
                  <div className="config-item-row">
                    <div className="config-item-info">
                      <strong>{pm.name}</strong>
                      <span className={`status-dot ${pm.enabled ? 'active' : 'inactive'}`} />
                      <span className="config-detail">{pm.url}</span>
                      <span className="config-detail">Pattern: <code>{pm.pattern}</code></span>
                      <span className="config-detail">Cron: <code>{pm.cron}</code></span>
                    </div>
                    <div className="config-item-actions">
                      <button className="btn btn-sm" onClick={() => setEditingPage(pm)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeletePage(pm.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RSS Feed Monitors */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">RSS Feed Monitors</span>
          {!showNewRss && !editingRss && (
            <button className="btn btn-primary" onClick={() => setShowNewRss(true)}>+ Add RSS Feed</button>
          )}
        </div>

        {showNewRss && (
          <RssFeedForm onSave={handleCreateRss} onCancel={() => setShowNewRss(false)} />
        )}

        {rssMonitors.length === 0 && !showNewRss ? (
          <p className="empty-state">No RSS feed monitors configured. Click "+ Add RSS Feed" to create one.</p>
        ) : (
          <div className="config-list">
            {rssMonitors.map(fm => (
              <div key={fm.id} className="config-item">
                {editingRss?.id === fm.id ? (
                  <RssFeedForm
                    initial={{
                      name: fm.name, url: fm.url, cron: fm.cron, fetchContent: fm.fetchContent,
                      maxArticles: fm.maxArticles, enabled: fm.enabled,
                      collections: fm.collections.map(c => ({
                        name: c.name,
                        metrics: c.metrics.map(m => ({ name: m.name, keywords: m.keywords.join(', ') })),
                      })),
                    }}
                    onSave={handleUpdateRss}
                    onCancel={() => setEditingRss(null)}
                  />
                ) : (
                  <div className="config-item-row">
                    <div className="config-item-info">
                      <strong>{fm.name}</strong>
                      <span className={`status-dot ${fm.enabled ? 'active' : 'inactive'}`} />
                      <span className="config-detail">{fm.url}</span>
                      <span className="config-detail">Cron: <code>{fm.cron}</code> | Max articles: {fm.maxArticles}</span>
                      {fm.collections.map((c, ci) => (
                        <span key={ci} className="config-detail">
                          {c.name}: {c.metrics.map(m => m.name).join(', ')}
                        </span>
                      ))}
                    </div>
                    <div className="config-item-actions">
                      <button className="btn btn-sm" onClick={() => setEditingRss(fm)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRss(fm.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonitorConfig;
