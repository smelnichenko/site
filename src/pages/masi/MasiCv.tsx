import { useCallback, useEffect, useState } from 'react';
import {
  activateCvVersion,
  createCvVersion,
  fetchCvMaster,
  fetchCvPreview,
  fetchCvVersion,
  fetchCvVersions,
  validateCv,
  CvCompleteness,
  CvVersionMeta,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import MasiNav from '../../components/MasiNav';
import MasiTable from '../../components/MasiTable';
import CvTranslations from './CvTranslations';
import { languageName } from './language';
import { openBlob } from './format';

const EMPTY_MASTER = `schema_version: "1"
language: en
person:
  name:
  title:
  location:
positioning:
  target_roles: []
  value_proposition:
  differentiators: []
experience:
  - company:
      name:
      domain:
      type:
      size_band:
    title:
    start: 2020-01
    end: present
    team:
      size:
      role_in_team:
    scope:
    autonomy: owned
    tech: []
    achievements:
      - statement:
        metric:
skills:
  - group: Languages
    items: []
languages:
  - language: Estonian
    level: native
`;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * The CV master editor: the evidence bank every tuned CV is drawn from. YAML in, schema
 * problems back with their paths, versions activated explicitly, a PDF preview of the master
 * as the boards would parse it. Nothing here sends anything anywhere.
 */
function MasiCv() {
  const [yaml, setYaml] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState<CvVersionMeta | null>(null);
  const [completeness, setCompleteness] = useState<CvCompleteness | null>(null);
  const [versions, setVersions] = useState<CvVersionMeta[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const [master, list] = await Promise.all([fetchCvMaster(signal), fetchCvVersions(signal)]);
    setActive(master.active);
    setCompleteness(master.completeness);
    setVersions(list);
    if (master.yaml !== null) {
      setYaml(master.yaml);
      setShown(master.active?.version ?? null);
    } else if (list.length === 0) {
      setYaml(EMPTY_MASTER);
      setShown(null);
    }
  }, []);

  // after a translation is made or approved: the list and the active version only — the editor is the operator's
  const reloadVersions = useCallback(async () => {
    const [master, list] = await Promise.all([fetchCvMaster(), fetchCvVersions()]);
    setActive(master.active);
    setVersions(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadData() {
      try {
        await reload(controller.signal);
      } catch (e: unknown) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reload]);

  async function onValidate() {
    setBusy(true);
    setMessage(null);
    try {
      const v = await validateCv(yaml);
      setErrors(v.valid ? [] : v.errors);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  }

  // an edited translation is saved as a translation of the same master, and is checked the same way
  const shownVersion = versions.find((v) => v.version === shown) ?? null;
  const editingTranslationOf = shownVersion?.translatedFrom ?? null;

  async function onSave() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await createCvVersion(yaml, note, editingTranslationOf ?? undefined);
      if (r.version === null) {
        setErrors(r.errors);
        return;
      }
      setErrors([]);
      setNote('');
      setMessage(`Version ${r.version.version} saved (not active yet)`);
      await reload();
      setShown(r.version.version);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onActivate(version: number) {
    setBusy(true);
    setMessage(null);
    try {
      await activateCvVersion(version);
      setMessage(`Version ${version} is now active`);
      await reload();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  }

  async function onShow(version: number) {
    setBusy(true);
    setMessage(null);
    try {
      const v = await fetchCvVersion(version);
      setYaml(v.yaml ?? '');
      setCompleteness(v.completeness);
      setShown(version);
      setErrors(null);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load the version');
    } finally {
      setBusy(false);
    }
  }

  async function onPreview(version: number) {
    setBusy(true);
    setMessage(null);
    try {
      openBlob(await fetchCvPreview(version), `cv-master-v${version}.pdf`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="masi">
        <MasiNav />
        <div className="loading">Loading CV master...</div>
      </div>
    );
  }

  return (
    <div className="masi-cv masi">
      <MasiNav />
      <div className="card">
        <div className="card-header">
          <span className="card-title">CV master</span>
          <span className="muted">
            {active ? `active: v${active.version}` : 'no active version'}
            {shown !== null && shown !== active?.version ? ` · showing v${shown}` : ''}
          </span>
        </div>
        {completeness && (
          <div className="cv-completeness" data-testid="completeness">
            <strong>Completeness {completeness.score} %</strong>
            {completeness.gaps.length > 0 && (
              <ul>
                {completeness.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="form-group">
          <label htmlFor="cv-yaml">Evidence bank (YAML)</label>
          <textarea
            id="cv-yaml"
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            rows={28}
            spellCheck={false}
            style={{ width: '100%', fontFamily: 'monospace', resize: 'vertical' }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="cv-note">Note for this version</label>
          <input
            id="cv-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. added the settlement achievements"
            style={{ width: '100%' }}
          />
        </div>
        {errors !== null && errors.length === 0 && (
          <div className="status-badge success">Valid</div>
        )}
        {errors !== null && errors.length > 0 && (
          <div className="error" role="alert">
            <strong>The schema refuses this master:</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {message && <div className="muted">{message}</div>}
        <div className="badge-group">
          <LoadingButton
            className="status-badge action"
            onClick={() => void onValidate()}
            loading={busy}
            label="Validate"
          />
          <LoadingButton
            className="status-badge add"
            onClick={() => void onSave()}
            loading={busy}
            label={
              editingTranslationOf === null
                ? 'Save as new version'
                : `Save as a new translation of v${editingTranslationOf}`
            }
          />
        </div>
      </div>

      <CvTranslations
        active={active}
        versions={versions}
        busy={busy}
        onVersionsChanged={reloadVersions}
        onShow={(v) => void onShow(v)}
        onPreview={(v) => void onPreview(v)}
      />

      <div className="card">
        <div className="card-header">
          <span className="card-title">Versions</span>
        </div>
        {versions.length === 0 ? (
          <p className="muted">No versions yet. Fill in the evidence bank and save it.</p>
        ) : (
          <MasiTable label="CV versions">
            <thead>
              <tr>
                <th>Version</th>
                <th>Note</th>
                <th>Language</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.version}>
                  <td>v{v.version}</td>
                  <td>{v.note ?? ''}</td>
                  <td>{languageName(v.language)}</td>
                  <td>{formatDate(v.createdAt)}</td>
                  <td>
                    {v.active ? `active since ${formatDate(v.activatedAt)}` : ''}
                    {v.translatedFrom === null ? '' : `translation of v${v.translatedFrom}`}
                  </td>
                  <td className="badge-group">
                    <button
                      className="status-badge edit"
                      onClick={() => void onShow(v.version)}
                      disabled={busy}
                    >
                      Show
                    </button>
                    <button
                      className="status-badge action"
                      onClick={() => void onPreview(v.version)}
                      disabled={busy}
                    >
                      Preview PDF
                    </button>
                    {!v.active && v.translatedFrom === null && (
                      <button
                        className="status-badge add"
                        onClick={() => void onActivate(v.version)}
                        disabled={busy}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </MasiTable>
        )}
      </div>
    </div>
  );
}

export default MasiCv;
