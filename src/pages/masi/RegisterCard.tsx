import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMasiRegisterCandidates,
  fetchMasiRegisterPlacement,
  MasiCompany,
  MasiRegisterCandidate,
  MasiRegisterCandidates,
  MasiRegisterPlacement,
  placeMasiCompany,
  takeBackMasiPlacement,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDate } from './format';
import { consequence, restores, whyNone } from './register';

/** How the register found a candidate, as the operator reads it. */
const FOUND_BY: Record<MasiRegisterCandidate['how'], string> = {
  EXACT: 'same name',
  PREFIX: 'starts with it',
  DOMAIN: 'its people write from its domain',
  CODE: 'the code you typed',
};

interface Props {
  company: MasiCompany;
  /** The company changed on the register: its code, its facts, the board it brought — the page reloads what it shows. */
  onChange: (c: MasiCompany) => void;
}

/**
 * Which registered company this employer is. Without a code: the candidates masi found, for the operator to choose —
 * nothing is placed on a guess, and a typed code is shown like a candidate before it is placed, because placing may
 * merge two companies and nothing takes that back. Placed: what it was placed on, and a way back. A code the register
 * import gave has nothing to take back, and the card says nothing.
 */
export default function RegisterCard({ company, onChange }: Readonly<Props>) {
  const navigate = useNavigate();
  const [found, setFound] = useState<MasiRegisterCandidates | null>(null);
  const [placement, setPlacement] = useState<MasiRegisterPlacement | null>(null);
  const [pending, setPending] = useState<MasiRegisterCandidate | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const placeButton = useRef<HTMLButtonElement>(null);
  const coded = company.registryCode !== null;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        // what the card shows is set only once the answer is in: nothing is reset synchronously inside the effect
        if (coded) {
          const p = await fetchMasiRegisterPlacement(company.id, controller.signal);
          setPlacement(p);
          setFound(null);
        } else {
          const f = await fetchMasiRegisterCandidates(company.id, controller.signal);
          setFound(f);
          setPlacement(null);
        }
        setPending(null);
        setMessage(null);
        setLoaded(true);
      } catch (e: unknown) {
        if (!controller.signal.aborted) {
          setMessage(errorMessage(e, 'Failed to load the register'));
          setLoaded(true);
        }
      }
    })();
    return () => controller.abort();
  }, [company.id, coded]);

  useEffect(() => {
    // the confirmation is where the choice is made: focus goes there, or it may be below the fold and look like nothing
    if (pending) placeButton.current?.focus();
  }, [pending]);

  async function place(code: string) {
    setBusy(true);
    setMessage(null);
    try {
      const placed = await placeMasiCompany(company.id, code);
      if (placed.id !== company.id) {
        // merged into the company masi already held: this one is gone, its page with it
        await navigate(`/masi/companies/${placed.id}`, { state: { mergedFrom: company.name } });
        return;
      }
      onChange(placed);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Placing failed'));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  /** A typed code is looked up first and confirmed like any candidate: the register says what it is, and whether masi holds it. */
  async function lookUp(code: string) {
    setBusy(true);
    setMessage(null);
    try {
      const answer = await fetchMasiRegisterCandidates(company.id, undefined, code);
      if (answer.candidates.length === 0) {
        setMessage(
          answer.indexed
            ? `The register has no company with the code ${code}.`
            : 'The register has not been read yet: masi reads it every Sunday.',
        );
      } else {
        setPending(answer.candidates[0]);
      }
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Looking the code up failed'));
    } finally {
      setBusy(false);
    }
  }

  async function takeBack() {
    setBusy(true);
    setMessage(null);
    try {
      const back = await takeBackMasiPlacement(company.id);
      setPlacement(null); // gone now: not offered again while the candidates load, or if they fail to
      onChange(back);
    } catch (e: unknown) {
      setMessage(errorMessage(e, 'Taking it back failed'));
    } finally {
      setBusy(false);
    }
  }

  if (coded && !placement && !message) {
    return null;
  }
  const candidates = found?.candidates ?? [];
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Register</span>
      </div>
      {message && (
        <div className="error" role="alert">
          {message}
        </div>
      )}
      {placement && (
        <div>
          <div>
            Placed on the register as reg. {placement.registryCode} on{' '}
            {formatDate(placement.placedAt)}. <span className="muted">{restores(placement)}</span>
          </div>
          <LoadingButton
            type="button"
            className="status-badge error"
            onClick={() => void takeBack()}
            loading={busy}
            label="Take back"
          />
        </div>
      )}
      {!coded && !loaded && <div className="loading">Looking in the register...</div>}
      {!coded && found && (
        <>
          <div className="muted">
            Which registered company is “{company.name}”? masi places an employer only when it is
            sure.
          </div>
          {candidates.length === 0 && <div className="empty-state">{whyNone(found)}</div>}
          {candidates.length > 0 && found.truncated && (
            <div className="muted">
              More registered companies begin with this name than can be listed: if it is none of
              these, type its registry code.
            </div>
          )}
          {candidates.length > 0 && (
            <MasiTable label="Registered companies it might be" testId="register-candidates">
              <thead>
                <tr>
                  <th>Registered name</th>
                  <th>Form</th>
                  <th>EMTAK</th>
                  <th>City</th>
                  <th>How</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr
                    key={c.registryCode}
                    className={pending?.registryCode === c.registryCode ? 'masi-chosen' : undefined}
                    aria-current={pending?.registryCode === c.registryCode ? 'true' : undefined}
                  >
                    <td>
                      {c.name}
                      <div className="muted">reg. {c.registryCode}</div>
                    </td>
                    <td>{c.legalForm ?? ''}</td>
                    <td>{c.emtakCode ?? ''}</td>
                    <td>{c.hqCity ?? ''}</td>
                    <td>
                      {FOUND_BY[c.how] ?? c.how}
                      {c.sure && <div className="muted">masi is sure of this one</div>}
                      {!c.employerForm && <div className="muted">never an employer</div>}
                      {c.heldById !== null && <div className="muted">masi holds it</div>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => setPending(c)}
                        disabled={busy}
                        aria-label={`Choose ${c.name}`}
                      >
                        Choose
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </MasiTable>
          )}
          <form
            className="masi-filters"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) void lookUp(typed.trim());
            }}
          >
            <label htmlFor="register-code">Or a registry code</label>
            <input
              id="register-code"
              inputMode="numeric"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button type="submit" className="btn-small" disabled={busy || !typed.trim()}>
              Look up
            </button>
          </form>
        </>
      )}
      {pending && (
        <fieldset aria-label="Confirm the placement" className="masi-confirm">
          <div>
            {pending.name} (reg. {pending.registryCode}): {consequence(company, pending)}.
          </div>
          <div className="badge-group">
            <LoadingButton
              ref={placeButton}
              type="button"
              className="status-badge action"
              onClick={() => void place(pending.registryCode)}
              loading={busy}
              label="Place it"
            />
            <button
              type="button"
              className="btn-small"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
