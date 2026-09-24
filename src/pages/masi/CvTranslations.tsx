import { useCallback, useEffect, useState } from 'react';
import {
  fetchCvTranslationStatus,
  reviewCvTranslation,
  startCvTranslation,
  CvTranslationStatus,
  CvVersionMeta,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage } from './format';
import { languageName } from './language';

/** The languages masi translates a master between. */
const TRANSLATED = ['en', 'et'];
/** The model takes half a minute or more; the page asks every few seconds for a few minutes, then stops asking. */
const POLL_MS = 5_000;
const MAX_POLLS = 60;

interface Props {
  active: CvVersionMeta | null;
  versions: CvVersionMeta[];
  busy: boolean;
  /** Reloads the versions after a translation is made or approved. */
  onChanged: () => Promise<void>;
  onShow: (version: number) => void;
  onPreview: (version: number) => void;
}

/** Where a translation stands, in words: current, approved but not current, or what is in its way. */
function standing(t: CvVersionMeta): string {
  const problems = t.parity ?? [];
  if (problems.length > 0) return `${problems.length} problem${problems.length === 1 ? '' : 's'}`;
  if (t.current) return 'current';
  if (t.reviewedAt) return 'approved, not current';
  return 'awaiting approval';
}

/**
 * The master in another language: a translation is made once by the model, checked against the master
 * (every figure, every fact, no stronger verb), approved by the operator, and kept. An Estonian posting
 * is then tuned from the current Estonian translation instead of the English master.
 */
export default function CvTranslations({ active, versions, busy, onChanged, onShow, onPreview }: Readonly<Props>) {
  const [status, setStatus] = useState<CvTranslationStatus | null>(null);
  const [polls, setPolls] = useState(0);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchCvTranslationStatus();
    setStatus(s);
    setPolls((n) => n + 1);
    if (s && s.state !== 'RUNNING') await onChanged();
  }, [onChanged]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCvTranslationStatus(controller.signal)
      .then(setStatus)
      .catch(() => undefined);   // no status is no translation: the card still offers one
    return () => controller.abort();
  }, []);

  const running = status?.state === 'RUNNING';
  useEffect(() => {
    if (!running || polls >= MAX_POLLS) return;
    const t = setTimeout(() => void refresh().catch(() => undefined), POLL_MS);
    return () => clearTimeout(t);
  }, [running, polls, refresh]);

  if (!active) {
    return null;
  }
  const target = TRANSLATED.find((l) => l !== active.language);
  const translatable = active.language !== null && TRANSLATED.includes(active.language) && target !== undefined;
  const translations = versions.filter((v) => v.translatedFrom === active.version);

  async function onTranslate() {
    if (!active || !target) return;
    setWorking(true);
    setMessage(null);
    try {
      setStatus(await startCvTranslation(active.version, target));
      setPolls(0);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The translation could not start'));
    } finally {
      setWorking(false);
    }
  }

  async function onApprove(version: number) {
    setWorking(true);
    setMessage(null);
    try {
      await reviewCvTranslation(version);
      setMessage(`v${version} approved`);
      await onChanged();
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The approval was refused'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="card masi-cv-translations" data-testid="cv-translations">
      <div className="card-header">
        <span className="card-title">Translations of v{active.version}</span>
        <span className="muted">the master is in {languageName(active.language)}</span>
      </div>
      {translatable ? (
        <div className="badge-group">
          <LoadingButton
            className="status-badge add"
            onClick={() => void onTranslate()}
            loading={working || busy || running}
            label={`Translate into ${languageName(target ?? null)}`}
          />
        </div>
      ) : (
        <p className="muted">A {languageName(active.language)} master is not translated: masi translates between English and Estonian.</p>
      )}
      {status?.sourceVersion === active.version && (
        <p className={status.state === 'FAILED' ? 'error' : 'muted'} role={status.state === 'FAILED' ? 'alert' : 'status'}>
          {status.state === 'RUNNING' && polls >= MAX_POLLS && `Still translating into ${languageName(status.language)}; reload the page to look again.`}
          {status.state === 'RUNNING' && polls < MAX_POLLS && `Translating into ${languageName(status.language)}…`}
          {status.state === 'DONE' && `v${status.version} made in ${languageName(status.language)}: read it, then approve it below.`}
          {status.state === 'FAILED' && `The translation failed: ${status.error ?? 'no reason given'}`}
        </p>
      )}
      {message && <p className="muted">{message}</p>}
      {translations.length === 0 ? (
        <p className="muted">No translation of this master yet.</p>
      ) : (
        <ul className="masi-translation-list">
          {translations.map((t) => {
            const problems = t.parity ?? [];
            return (
              <li key={t.version} data-testid={`translation-${t.version}`}>
                <div className="masi-translation-head">
                  <strong>v{t.version}</strong> · {languageName(t.language)} ·{' '}
                  <span className={t.current ? 'status-badge success' : 'status-badge'}>{standing(t)}</span>
                </div>
                {problems.length > 0 && (
                  <ul className="error">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="badge-group">
                  <button className="status-badge edit" onClick={() => onShow(t.version)} disabled={busy || working}>
                    Show
                  </button>
                  <button className="status-badge action" onClick={() => onPreview(t.version)} disabled={busy || working}>
                    Preview PDF
                  </button>
                  {!t.reviewedAt && (
                    <button
                      className="status-badge add"
                      onClick={() => void onApprove(t.version)}
                      disabled={busy || working || problems.length > 0}
                      title={problems.length > 0 ? 'Fix the problems first: edit it, save it, approve the new version' : undefined}
                    >
                      Approve
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
