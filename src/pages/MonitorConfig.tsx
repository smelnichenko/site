import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PageMonitorConfig, PageMonitorRequest, RssFeedMonitorConfig, RssFeedMonitorRequest,
  MonitorResult, RssFeedResult,
  fetchPageMonitorConfigs, createPageMonitor, updatePageMonitor, deletePageMonitor,
  fetchRssFeedMonitorConfigs, createRssFeedMonitor, updateRssFeedMonitor, deleteRssFeedMonitor,
  testPageMonitor, testRssFeedMonitor, generateRssCollections,
} from '../services/api';
import LoadingButton from '../components/LoadingButton';
import { useLoading } from '../contexts/LoadingContext';

// Spring cron: 6 fields (sec min hour day month weekday)
const CRON_PATTERN = /^(\S+\s+){5}\S+$/;

function isValidCron(cron: string): boolean {
  return CRON_PATTERN.test(cron.trim());
}

// --- Test Result Banners ---

function PageTestResultBanner({ result: r }: Readonly<{ result: MonitorResult }>) {
  let background = '#fff3cd';
  if (r.errorMessage) background = '#f8d7da';
  else if (r.matched) background = '#d4edda';
  return (
    <div style={{ padding: '8px 12px', borderRadius: 4, fontSize: '0.85rem', marginBottom: 8, background }}>
      {r.errorMessage
        ? <span style={{ color: '#721c24' }}>Error: {r.errorMessage}</span>
        : <>
            <span style={{ color: r.matched ? '#155724' : '#856404' }}>
              {r.matched ? 'Matched' : 'No match'}{r.extractedValue != null && <>{' '}— Value: <strong>{r.extractedValue}</strong></>}
              {r.rawMatch && <>{' '}(raw: <code>{r.rawMatch}</code>)</>}
            </span>
            <span style={{ color: '#666', marginLeft: 12 }}>HTTP {r.httpStatus} · {r.responseTimeMs}ms</span>
          </>
      }
    </div>
  );
}

function RssTestResultBanner({ result: r }: Readonly<{ result: RssFeedResult }>) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 4, fontSize: '0.85rem', marginBottom: 8, background: r.errorMessage ? '#f8d7da' : '#d4edda' }}>
      {r.errorMessage
        ? <span style={{ color: '#721c24' }}>Error: {r.errorMessage}</span>
        : <>
            <span style={{ color: '#155724' }}>
              {r.articleCount} articles · HTTP {r.httpStatus} · {r.responseTimeMs}ms
            </span>
            {r.metricCounts.length > 0 && (
              <span style={{ color: '#333', marginLeft: 12 }}>
                {r.metricCounts.map(m => `${m.metricName}: ${m.count}`).join(', ')}
              </span>
            )}
          </>
      }
    </div>
  );
}

// --- Page Monitor Form ---

interface PageFormState {
  name: string;
  url: string;
  pattern: string;
  cron: string;
  enabled: boolean;
}

const emptyPageForm: PageFormState = { name: '', url: '', pattern: '', cron: '0 0 * * * *', enabled: true };

function PageMonitorForm({ initial, onSave, onCancel }: Readonly<{
  initial?: PageFormState;
  onSave: (data: PageMonitorRequest) => Promise<void>;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<PageFormState>(initial || emptyPageForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<MonitorResult | null>(null);
  const { withLoading } = useLoading();

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await withLoading(() => onSave(form));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!formRef.current?.reportValidity()) return;
    setTestingForm(true);
    setFormTestResult(null);
    try { setFormTestResult(await withLoading(() => testPageMonitor(form))); } catch { /* ignore */ }
    setTestingForm(false);
  };

  const formRef = useRef<HTMLFormElement>(null);
  const isValid = form.name.trim() !== '' && form.url.trim() !== '' && form.pattern.trim() !== '' && form.cron.trim() !== '' && isValidCron(form.cron);

  return (
    <form className="config-form" onSubmit={handleSubmit} ref={formRef}>
      {error && <div className="error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="page-name">Name <span className="required">*</span></label>
          <input id="page-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label htmlFor="page-cron">Cron <span className="required">*</span></label>
          <input id="page-cron" value={form.cron} onChange={e => setForm({ ...form, cron: e.target.value })} required placeholder="0 0 * * * *" pattern="(\S+\s+){5}\S+" title="Spring cron: 6 fields (sec min hour day month weekday)" />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="page-url">URL <span className="required">*</span></label>
        <input id="page-url" type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
      </div>
      <div className="form-group">
        <label htmlFor="page-pattern">Pattern (regex) <span className="required">*</span></label>
        <input id="page-pattern" value={form.pattern} onChange={e => setForm({ ...form, pattern: e.target.value })} required />
      </div>
      {formTestResult && <PageTestResultBanner result={formTestResult} />}
      <div className="form-actions">
        <label className="toggle-label">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />{' '}
          Enabled
        </label>
        <div>
          <LoadingButton type="button" className="status-badge action" onClick={handleTest} disabled={!isValid} loading={testingForm} label="Test" loadingLabel="Testing..." />
          <button type="button" className="status-badge action" onClick={onCancel}>Cancel</button>
          <LoadingButton type="submit" className="status-badge add" loading={saving} label="Save" loadingLabel="Saving..." />
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

function toCollectionRequests(collections: CollectionFormState[]) {
  return collections.map(c => ({
    name: c.name,
    metrics: c.metrics.map(m => ({
      name: m.name,
      keywords: m.keywords.split(',').map(k => k.trim()).filter(Boolean),
    })),
  }));
}

function mapGeneratedCollections(collections: { name: string; metrics: { name: string; keywords: string[] }[] }[]): CollectionFormState[] {
  return collections.map(c => ({
    name: c.name,
    metrics: c.metrics.map(m => ({ name: m.name, keywords: m.keywords.join(', ') })),
  }));
}

function RssFeedForm({ initial, onSave, onCancel }: Readonly<{
  initial?: RssFormState;
  onSave: (data: RssFeedMonitorRequest) => Promise<void>;
  onCancel: () => void;
}>) {
  const [form, setForm] = useState<RssFormState>(initial || emptyRssForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<RssFeedResult | null>(null);
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const { withLoading } = useLoading();

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await withLoading(() => onSave({
        ...form,
        collections: toCollectionRequests(form.collections),
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const formRef = useRef<HTMLFormElement>(null);
  const isValid = form.name.trim() !== '' && form.url.trim() !== '' && form.cron.trim() !== '';

  const handleTestRssForm = async () => {
    if (!formRef.current?.reportValidity()) return;
    setTestingForm(true);
    setFormTestResult(null);
    try {
      setFormTestResult(await withLoading(() => testRssFeedMonitor({
        ...form,
        collections: toCollectionRequests(form.collections),
      })));
    } catch { /* ignore */ }
    setTestingForm(false);
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
    <form className="config-form" onSubmit={handleSubmit} ref={formRef}>
      {error && <div className="error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="rss-name">Name <span className="required">*</span></label>
          <input id="rss-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label htmlFor="rss-cron">Cron <span className="required">*</span></label>
          <input id="rss-cron" value={form.cron} onChange={e => setForm({ ...form, cron: e.target.value })} required placeholder="0 0 * * * *" pattern="(\S+\s+){5}\S+" title="Spring cron: 6 fields (sec min hour day month weekday)" />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="rss-url">URL <span className="required">*</span></label>
        <input id="rss-url" type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
      </div>
      <div>
        <div className="form-group" style={{ width: '10%' }}>
          <label htmlFor="rss-max-articles">Max Articles <span className="required">*</span></label>
          <input id="rss-max-articles" type="number" min="1" value={form.maxArticles} onChange={e => setForm({ ...form, maxArticles: Number.parseInt(e.target.value, 10) || 30 })} required />
        </div>
        <label className="toggle-label">
          <input type="checkbox" checked={form.fetchContent} onChange={e => setForm({ ...form, fetchContent: e.target.checked })} />{' '}
          Fetch Content
        </label>
      </div>

      <div style={{ margin: '12px 0' }}>
        <button type="button" className="status-badge action" onClick={() => setShowAiGenerate(!showAiGenerate)}>
          {showAiGenerate ? 'Hide' : 'Generate with AI'}
        </button>
        {showAiGenerate && (
          <div style={{ marginTop: 8, padding: '12px', background: '#f8f9fa', borderRadius: 4 }}>
            <div className="form-group">
              <label htmlFor="ai-prompt">Describe what to track</label>
              <textarea
                id="ai-prompt"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g., Track AI, cybersecurity, and cloud computing trends"
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
                maxLength={500}
              />
            </div>
            {aiError && <div className="error" style={{ marginBottom: 8 }}>{aiError}</div>}
            <LoadingButton
              type="button"
              className="status-badge add"
              disabled={!form.url.trim() || !aiPrompt.trim()}
              loading={aiGenerating}
              label="Generate"
              loadingLabel="Generating..."
              onClick={async () => {
                setAiGenerating(true);
                setAiError('');
                try {
                  const collections = await withLoading(() => generateRssCollections({ url: form.url, prompt: aiPrompt }));
                  setForm({
                    ...form,
                    collections: [...form.collections, ...mapGeneratedCollections(collections)],
                  });
                  setShowAiGenerate(false);
                } catch (err: unknown) {
                  setAiError(err instanceof Error ? err.message : 'Generation failed');
                } finally {
                  setAiGenerating(false);
                }
              }}
            />
            {!form.url.trim() && <span style={{ color: '#856404', fontSize: '0.85rem', marginLeft: 8 }}>Enter a feed URL first</span>}
          </div>
        )}
      </div>

      <div className="collections-section">
        <div className="section-header">
          <strong>Collections</strong>
          <button type="button" className="status-badge add" onClick={addCollection}>+ Collection</button>
        </div>
        {form.collections.map((col, ci) => (
          <div key={`col-${col.name || ci}`} className="collection-block">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`col-name-${ci}`}>Collection Name <span className="required">*</span></label>
                <input id={`col-name-${ci}`} value={col.name} onChange={e => updateCollection(ci, { ...col, name: e.target.value })} required />
              </div>
              <button type="button" className="status-badge danger" onClick={() => removeCollection(ci)}>Remove</button>
            </div>
            {col.metrics.map((m, mi) => (
              <div key={`metric-${ci}-${m.name || mi}`} className="metric-row">
                <input placeholder="Metric name" value={m.name} onChange={e => updateMetric(ci, mi, { ...m, name: e.target.value })} required />
                <input placeholder="Keywords (comma-separated)" value={m.keywords} onChange={e => updateMetric(ci, mi, { ...m, keywords: e.target.value })} required />
                <button type="button" className="status-badge danger" onClick={() => removeMetric(ci, mi)}>x</button>
              </div>
            ))}
            <button type="button" className="status-badge add" onClick={() => addMetric(ci)}>+ Metric</button>
          </div>
        ))}
      </div>

      {formTestResult && <RssTestResultBanner result={formTestResult} />}
      <div className="form-actions">
        <label className="toggle-label">
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />{' '}
          Enabled
        </label>
        <div>
          <LoadingButton type="button" className="status-badge action" onClick={handleTestRssForm} disabled={!isValid} loading={testingForm} label="Test" loadingLabel="Testing..." />
          <button type="button" className="status-badge action" onClick={onCancel}>Cancel</button>
          <LoadingButton type="submit" className="status-badge add" loading={saving} label="Save" loadingLabel="Saving..." />
        </div>
      </div>
    </form>
  );
}

// --- Main Config Page ---

function buildTestPageRequest(pm: PageMonitorConfig): PageMonitorRequest {
  return { name: pm.name, url: pm.url, pattern: pm.pattern, cron: pm.cron, enabled: pm.enabled };
}

function buildTestRssRequest(fm: RssFeedMonitorConfig): RssFeedMonitorRequest {
  return {
    name: fm.name, url: fm.url, cron: fm.cron, fetchContent: fm.fetchContent,
    maxArticles: fm.maxArticles, enabled: fm.enabled,
    collections: fm.collections.map(c => ({ name: c.name, metrics: c.metrics.map(m => ({ name: m.name, keywords: m.keywords })) })),
  };
}

function toRssFormInitial(fm: RssFeedMonitorConfig): RssFormState {
  return {
    name: fm.name, url: fm.url, cron: fm.cron, fetchContent: fm.fetchContent,
    maxArticles: fm.maxArticles, enabled: fm.enabled,
    collections: fm.collections.map(c => ({
      name: c.name,
      metrics: c.metrics.map(m => ({ name: m.name, keywords: m.keywords.join(', ') })),
    })),
  };
}

function MonitorConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageMonitors, setPageMonitors] = useState<PageMonitorConfig[]>([]);
  const [rssMonitors, setRssMonitors] = useState<RssFeedMonitorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<PageMonitorConfig | null>(null);
  const [editingRss, setEditingRss] = useState<RssFeedMonitorConfig | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showNewRss, setShowNewRss] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const { withLoading } = useLoading();

  const loadData = async () => {
    try {
      const [pages, feeds] = await Promise.all([fetchPageMonitorConfigs(), fetchRssFeedMonitorConfigs()]);
      setPageMonitors(pages);
      setRssMonitors(feeds);

      const editFeedId = searchParams.get('editFeed');
      const editPageId = searchParams.get('editPage');
      if (editFeedId) {
        const match = feeds.find(f => f.id === Number(editFeedId));
        if (match) setEditingRss(match);
      }
      if (editPageId) {
        const match = pages.find(p => p.id === Number(editPageId));
        if (match) setEditingPage(match);
      }
      if (editFeedId || editPageId) {
        setSearchParams({}, { replace: true });
      }
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

  const handleTestPage = async (pm: PageMonitorConfig) => {
    setTesting('page:' + pm.name);
    try { await withLoading(() => testPageMonitor(buildTestPageRequest(pm))); } catch { /* ignore */ }
    setTesting(null);
  };

  const handleTestRss = async (fm: RssFeedMonitorConfig) => {
    setTesting('rss:' + fm.name);
    try {
      await withLoading(() => testRssFeedMonitor(buildTestRssRequest(fm)));
    } catch { /* ignore */ }
    setTesting(null);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      {/* Page Monitors */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Page Monitors</span>
          {!showNewPage && !editingPage && (
            <button className="status-badge add" onClick={() => setShowNewPage(true)}>+ Add Page Monitor</button>
          )}
        </div>

        {showNewPage && (
          <PageMonitorForm onSave={handleCreatePage} onCancel={() => setShowNewPage(false)} />
        )}

        {pageMonitors.length === 0 && !showNewPage ? (
          <p className="empty-state">No page monitors configured. Click &quot;+ Add Page Monitor&quot; to create one.</p>
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
                      <LoadingButton className="status-badge action" onClick={() => handleTestPage(pm)} loading={testing === 'page:' + pm.name} label="Test" loadingLabel="Testing..." />
                      <button className="status-badge action" onClick={() => setEditingPage(pm)}>Edit</button>
                      <button className="status-badge danger" onClick={() => handleDeletePage(pm.id)}>Delete</button>
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
            <button className="status-badge add" onClick={() => setShowNewRss(true)}>+ Add RSS Feed</button>
          )}
        </div>

        {showNewRss && (
          <RssFeedForm onSave={handleCreateRss} onCancel={() => setShowNewRss(false)} />
        )}

        {rssMonitors.length === 0 && !showNewRss ? (
          <p className="empty-state">No RSS feed monitors configured. Click &quot;+ Add RSS Feed&quot; to create one.</p>
        ) : (
          <div className="config-list">
            {rssMonitors.map(fm => (
              <div key={fm.id} className="config-item">
                {editingRss?.id === fm.id ? (
                  <RssFeedForm
                    initial={toRssFormInitial(fm)}
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
                      {fm.collections.map(c => (
                        <span key={c.name} className="config-detail">
                          {c.name}: {c.metrics.map(m => m.name).join(', ')}
                        </span>
                      ))}
                    </div>
                    <div className="config-item-actions">
                      <LoadingButton className="status-badge action" onClick={() => handleTestRss(fm)} loading={testing === 'rss:' + fm.name} label="Test" loadingLabel="Testing..." />
                      <button className="status-badge action" onClick={() => setEditingRss(fm)}>Edit</button>
                      <button className="status-badge danger" onClick={() => handleDeleteRss(fm.id)}>Delete</button>
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
