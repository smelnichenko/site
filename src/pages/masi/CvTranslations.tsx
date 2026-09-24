import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Reloads the version list after a translation is made or approved; never touches the editor. */
  onVersionsChanged: () => Promise<void>;
  onShow: (version: number) => void;
  onPreview: (version: number) => void;
}

/** Where a translation stands, in words and as a badge: what is in its way first, then current, then waiting. */
function standing(t: CvVersionMeta): { text: string; badge: string } {
  const problems = t.parity ?? [];
  if (problems.length > 0) {
    return {
      text: `${problems.length} problem${problems.length === 1 ? '' : 's'}`,
      badge: 'status-badge error',
    };
  }
  if (t.current) return { text: 'current', badge: 'status-badge success' };
  if (t.reviewedAt) return { text: 'approved, not current', badge: 'status-badge' };
  return { text: 'awaiting approval', badge: 'status-badge add' };
}

/** What the running or last translation says, for the always-present status line. */
function statusText(status: CvTranslationStatus | null, stoppedAsking: boolean): string {
  if (!status) return '';
  const into = languageName(status.language);
  if (status.state === 'RUNNING') {
    return stoppedAsking
      ? `Still translating into ${into}; reload the page to look again.`
      : `Translating into ${into}…`;
  }
  if (status.state === 'DONE')
    return `v${status.version} made in ${into}: read it, then approve it below.`;
  return '';
}

/**
 * The master in another language: a translation is made once by the model, checked against the master
 * (every figure, every fact, no stronger verb), approved by the operator, and kept. An Estonian posting
 * is then tuned from the current Estonian translation instead of the English master.
 */
export default function CvTranslations({
  active,
  versions,
  busy,
  onVersionsChanged,
  onShow,
  onPreview,
}: Readonly<Props>) {
  const [status, setStatus] = useState<CvTranslationStatus | null>(null);
  const [polls, setPolls] = useState(0);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const statusLine = useRef<HTMLOutputElement>(null);
  // read through a ref: a parent re-rendering (the editor, keystroke by keystroke) must not restart the poll's timer
  const changed = useRef(onVersionsChanged);
  useEffect(() => {
    changed.current = onVersionsChanged;
  }, [onVersionsChanged]);

  const refresh = useCallback(async () => {
    const s = await fetchCvTranslationStatus();
    setStatus(s);
    setPolls((n) => n + 1);
    if (s && s.state !== 'RUNNING') setMessage(null); // the news is the translation's now
    if (s && s.state !== 'RUNNING') await changed.current();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCvTranslationStatus(controller.signal)
      .then(setStatus)
      .catch(() => undefined); // no status is no translation: the card still offers one
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
  const translatable =
    active.language !== null && TRANSLATED.includes(active.language) && target !== undefined;
  const translations = versions.filter((v) => v.translatedFrom === active.version);
  const shownStatus = status?.sourceVersion === active.version ? status : null;

  async function onTranslate() {
    if (!active || !target) return;
    setWorking(true);
    setMessage(null);
    setRefusal(null);
    try {
      setStatus(await startCvTranslation(active.version, target));
      setPolls(0);
      setMessage(null);
      statusLine.current?.focus(); // the button is disabled while the model works: focus goes where the news will be
    } catch (e: unknown) {
      setRefusal(errorMessage(e, 'The translation could not start'));
    } finally {
      setWorking(false);
    }
  }

  async function onApprove(version: number) {
    setWorking(true);
    setMessage(null);
    setRefusal(null);
    try {
      await reviewCvTranslation(version);
      setMessage(`v${version} approved`);
      await changed.current();
    } catch (e: unknown) {
      setRefusal(errorMessage(e, 'The approval was refused'));
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
        <p className="muted">
          A {languageName(active.language)} master is not translated: masi translates between
          English and Estonian.
        </p>
      )}
      {/* always present, so a screen reader announces what changes in it (an <output> is a status region) */}
      <output className="muted masi-cv-translation-status" ref={statusLine} tabIndex={-1}>
        {message ?? statusText(shownStatus, polls >= MAX_POLLS)}
      </output>
      {shownStatus?.state === 'FAILED' && (
        <p className="error" role="alert">
          The translation failed: {shownStatus.error ?? 'no reason given'}
        </p>
      )}
      {refusal && (
        <p className="error" role="alert">
          {refusal}
        </p>
      )}
      {translations.length === 0 ? (
        <p className="muted">No translation of this master yet.</p>
      ) : (
        <ul className="masi-translation-list">
          {translations.map((t) => {
            const problems = t.parity ?? [];
            const where = standing(t);
            return (
              <li key={t.version} data-testid={`translation-${t.version}`}>
                <div className="masi-translation-head">
                  <strong>v{t.version}</strong> · {languageName(t.language)} ·{' '}
                  <span className={where.badge}>{where.text}</span>
                </div>
                {problems.length > 0 && (
                  <>
                    <ul className="error">
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <p className="muted">
                      To approve it, fix these in the editor, save it as a new translation, then
                      approve that one.
                    </p>
                  </>
                )}
                <div className="badge-group">
                  <button
                    className="status-badge edit"
                    onClick={() => onShow(t.version)}
                    disabled={busy || working}
                  >
                    Show
                  </button>
                  <button
                    className="status-badge action"
                    onClick={() => onPreview(t.version)}
                    disabled={busy || working}
                  >
                    Preview PDF
                  </button>
                  {!t.reviewedAt && (
                    <button
                      className="status-badge add"
                      onClick={() => void onApprove(t.version)}
                      disabled={busy || working || problems.length > 0}
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
