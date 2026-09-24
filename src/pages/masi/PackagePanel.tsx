import { useState } from 'react';
import {
  fetchMasiArtifact,
  MasiPackage,
  MasiPackageLanguage,
  regenerateMasiPackage,
  reviewMasiPackage,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import PackageLanguage from './PackageLanguage';
import { languageLine } from './language';
import { badgeClass, errorMessage, formatDateTime, formatUsd, openBlob } from './format';

const RESPONSES = ['NONE', 'REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

interface Props {
  pkg: MasiPackage;
  onChanged: (next: MasiPackage) => void;
  /** False when the job closed: regenerating would only earn a 409. */
  jobOpen?: boolean;
}

/**
 * One package as the operator reviews it: the tuned CV over the master's facts, the claims
 * report and the lint next to it, the PDF and the letter, and the transitions masi never takes
 * by itself — Mark reviewed, Mark applied, Skip, Regenerate. Applying is the operator's act.
 */
export default function PackagePanel({ pkg, onChanged, jobOpen = true }: Readonly<Props>) {
  const [notes, setNotes] = useState(pkg.userNotes ?? '');
  const [response, setResponse] = useState(pkg.response);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<MasiPackageLanguage>((pkg.language as MasiPackageLanguage | null) ?? 'auto');

  async function act(fn: () => Promise<MasiPackage>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fn();
      onChanged(next);
      setMessage(done);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The action failed'));
    } finally {
      setBusy(false);
    }
  }

  async function openArtifact(kind: 'CV_PDF' | 'LETTER_TXT') {
    setBusy(true);
    try {
      openBlob(
        await fetchMasiArtifact(pkg.id, kind),
        kind === 'CV_PDF' ? `cv-${pkg.id}.pdf` : `letter-${pkg.id}.txt`,
      );
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'The artifact could not be fetched'));
    } finally {
      setBusy(false);
    }
  }

  async function copyLetter() {
    if (!pkg.coverLetter) return;
    try {
      await navigator.clipboard.writeText(pkg.coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage('The clipboard is not available; select the letter and copy it');
    }
  }

  const claims = pkg.claims ?? [];
  const lint = pkg.lint ?? [];
  const reviewable = pkg.status === 'PREPARED' || pkg.status === 'REVIEWED';
  const cvPdf = pkg.artifacts.find((a) => a.kind === 'CV_PDF');
  const letterTxt = pkg.artifacts.find((a) => a.kind === 'LETTER_TXT');
  const canRegenerate = jobOpen && pkg.status !== 'APPLIED' && pkg.status !== 'PREPARING';
  return (
    <div className="card masi-package" data-testid="package-panel">
      <div className="card-header">
        <span className="card-title">
          Package #{pkg.id} · CV v{pkg.cvVersion ?? '?'}
        </span>
        <span className={badgeClass(pkg.status)}>{pkg.status.toLowerCase().replace('_', ' ')}</span>
      </div>
      <div className="muted">
        {pkg.model ? `${pkg.model} · ` : ''}
        {pkg.attempts} attempt(s) · cost {formatUsd(pkg.costUsd)} · updated{' '}
        {formatDateTime(pkg.updatedAt)}
        {pkg.appliedAt ? ` · applied ${formatDateTime(pkg.appliedAt)}` : ''}
      </div>
      <div className="muted" data-testid="package-language">
        {languageLine(pkg.writtenIn, pkg.tunedFromVersion, pkg.language)}
      </div>
      {pkg.error && (
        <div className="error" role="alert">
          {pkg.error}
        </div>
      )}
      {claims.length > 0 && (
        <div className="error" role="alert" data-testid="claims">
          <strong>Claims the checker refused ({claims.length}):</strong>
          <ul>
            {claims.map((c) => (
              <li key={`${c.rule}:${c.detail}`}>
                <code>{c.rule}</code> {c.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pkg.claims?.length === 0 && pkg.status !== 'NEW' && pkg.status !== 'PREPARING' && (
        <div className="status-badge success" data-testid="claims-clean">
          0 claims violations
        </div>
      )}
      {lint.length > 0 && (
        <details className="masi-lint" data-testid="lint">
          <summary>{lint.length} lint warning(s)</summary>
          <ul>
            {lint.map((w) => (
              <li key={`${w.rule}:${w.detail}`}>
                <code>{w.rule}</code> {w.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
      {pkg.tunedCv && (
        <div className="masi-tuned">
          <h3>{pkg.tunedCv.title}</h3>
          <p>{pkg.tunedCv.summary}</p>
          {pkg.tunedCv.roles.map((r) => (
            <div key={`${r.company}:${r.title}`} className="masi-role">
              <strong>{r.title}</strong> · {r.company}
              {r.collapsed ? (
                <span className="muted"> (collapsed)</span>
              ) : (
                <ul>
                  {r.bullets.map((b) => (
                    <li key={b.achievementIndex}>{b.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {pkg.tunedCv.skills.length > 0 && (
            <p className="muted">Skills: {pkg.tunedCv.skills.join(', ')}</p>
          )}
        </div>
      )}
      {pkg.coverLetter && (
        <div className="masi-letter">
          <div className="card-header">
            <span className="card-title">Cover letter</span>
            <button type="button" className="btn-small" onClick={() => void copyLetter()}>
              {copied ? 'Copied' : 'Copy letter'}
            </button>
          </div>
          <pre>{pkg.coverLetter}</pre>
        </div>
      )}
      <div className="badge-group">
        {cvPdf?.available && (
          <LoadingButton
            className="status-badge action"
            onClick={() => void openArtifact('CV_PDF')}
            loading={busy}
            label="Open CV PDF"
          />
        )}
        {letterTxt?.available && (
          <LoadingButton
            className="status-badge"
            onClick={() => void openArtifact('LETTER_TXT')}
            loading={busy}
            label="Download letter"
          />
        )}
      </div>
      <div className="form-group">
        <label htmlFor={`notes-${pkg.id}`}>Notes</label>
        <textarea
          id={`notes-${pkg.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ width: '100%' }}
        />
      </div>
      {pkg.status === 'APPLIED' && (
        <div className="form-group">
          <label htmlFor={`response-${pkg.id}`}>Employer response</label>
          <select
            id={`response-${pkg.id}`}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          >
            {RESPONSES.map((r) => (
              <option key={r} value={r}>
                {r.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      )}
      {message && <div className="muted">{message}</div>}
      <div className="badge-group">
        {pkg.status === 'PREPARED' && (
          <LoadingButton
            className="status-badge action"
            onClick={() =>
              void act(() => reviewMasiPackage(pkg.id, 'REVIEWED', notes), 'Marked reviewed')
            }
            loading={busy}
            label="Mark reviewed"
          />
        )}
        {reviewable && (
          <LoadingButton
            className="status-badge add"
            onClick={() =>
              void act(
                () => reviewMasiPackage(pkg.id, 'APPLIED', notes),
                'Marked applied — you sent it, masi never does',
              )
            }
            loading={busy}
            label="Mark applied"
          />
        )}
        {pkg.status === 'APPLIED' && (
          <LoadingButton
            className="status-badge action"
            onClick={() =>
              void act(
                () => reviewMasiPackage(pkg.id, 'APPLIED', notes, response),
                'Response recorded',
              )
            }
            loading={busy}
            label="Save response"
          />
        )}
        {pkg.status !== 'APPLIED' && pkg.status !== 'PREPARING' && (
          <LoadingButton
            className="status-badge"
            onClick={() => void act(() => reviewMasiPackage(pkg.id, 'SKIPPED', notes), 'Skipped')}
            loading={busy}
            label="Skip"
          />
        )}
        {canRegenerate && (
          <PackageLanguage
            id={`package-language-${pkg.id}`}
            label={`Language of package #${pkg.id}`}
            value={language}
            onChange={setLanguage}
            disabled={busy}
          >
            <LoadingButton
              className="status-badge edit"
              onClick={() => void act(() => regenerateMasiPackage(pkg.id, language), 'Regenerating…')}
              loading={busy}
              label="Regenerate"
            />
          </PackageLanguage>
        )}
      </div>
    </div>
  );
}
