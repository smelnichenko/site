import { useState } from 'react';
import {
  MasiPackage,
  MasiTunedCv,
  MasiTunedRole,
  saveMasiPackageContent,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage } from './format';

interface Props {
  pkg: MasiPackage;
  onSaved: (next: MasiPackage) => void;
  onCancel: () => void;
}

/** What masi takes back: the tuned CV without the dates it adds for the preview (they are the master's, never edited). */
function content(
  cv: MasiTunedCv,
  roles: MasiTunedRole[],
  skills: string,
  letter: string,
): MasiTunedCv {
  return {
    title: cv.title,
    summary: cv.summary,
    roles: roles.map(({ company, title, collapsed, bullets }) => ({
      company,
      title,
      collapsed,
      bullets,
    })),
    skills: skills
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    coverLetter: letter,
  };
}

/**
 * The operator's own words for a prepared package: the target-role line, the summary, each bullet, which roles show as
 * one line, the skills and the letter. masi makes the PDF and the letter again from what is saved; every role stays
 * (one line hides it), and the dates, companies and titles stay the master's.
 */
export default function PackageEditor({ pkg, onSaved, onCancel }: Readonly<Props>) {
  const tuned = pkg.tunedCv!;
  const [title, setTitle] = useState(tuned.title);
  const [summary, setSummary] = useState(tuned.summary);
  const [roles, setRoles] = useState<MasiTunedRole[]>(tuned.roles);
  const [skills, setSkills] = useState(tuned.skills.join(', '));
  const [letter, setLetter] = useState(pkg.coverLetter ?? tuned.coverLetter ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function role(i: number, next: Partial<MasiTunedRole>) {
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...next } : r)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await saveMasiPackageContent(
          pkg.id,
          content({ ...tuned, title, summary }, roles, skills, letter),
        ),
      );
    } catch (e: unknown) {
      setError(errorMessage(e, 'The edit could not be saved'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="masi-tuned masi-edit">
      <div className="form-group">
        <label htmlFor={`edit-title-${pkg.id}`}>Target role</label>
        <input
          id={`edit-title-${pkg.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`edit-summary-${pkg.id}`}>Summary</label>
        <textarea
          id={`edit-summary-${pkg.id}`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
        />
      </div>
      {roles.map((r, i) => (
        <fieldset key={`${r.company}:${r.title}`} className="masi-role">
          <legend>
            <strong>{r.title}</strong> · {r.company}
            {r.period && (
              <>
                {' · '}
                <span className="masi-nowrap">{r.period}</span>
              </>
            )}
          </legend>
          <label className="masi-edit-check">
            <input
              type="checkbox"
              checked={r.collapsed}
              onChange={(e) => role(i, { collapsed: e.target.checked })}
              aria-label={`${r.title}: one line`}
            />{' '}
            One line (no bullets)
          </label>
          {!r.collapsed &&
            r.bullets.map((b, k) => {
              const name = `${r.title}: bullet ${k + 1}`;
              return (
                <div key={b.achievementIndex} className="masi-edit-bullet">
                  <textarea
                    aria-label={name}
                    value={b.text}
                    rows={2}
                    onChange={(e) =>
                      role(i, {
                        bullets: r.bullets.map((x, m) =>
                          m === k ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-small"
                    aria-label={`Remove ${name}`}
                    onClick={() => role(i, { bullets: r.bullets.filter((_, m) => m !== k) })}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
        </fieldset>
      ))}
      <div className="form-group">
        <label htmlFor={`edit-skills-${pkg.id}`}>Skills (comma-separated)</label>
        <input
          id={`edit-skills-${pkg.id}`}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`edit-letter-${pkg.id}`}>Cover letter</label>
        <textarea
          id={`edit-letter-${pkg.id}`}
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          rows={10}
        />
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <p className="muted">
        Saving makes the PDF and the letter again from this text. Regenerate replaces it.
      </p>
      <div className="badge-group">
        <LoadingButton
          className="status-badge action"
          onClick={() => void save()}
          loading={busy}
          label="Save edits"
        />
        <button type="button" className="status-badge" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
