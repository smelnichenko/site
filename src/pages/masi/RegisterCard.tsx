import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchMasiRegisterCandidates,
  fetchMasiRegisterPlacement,
  MasiCompany,
  MasiRegisterCandidate,
  MasiRegisterPlacement,
  placeMasiCompany,
  takeBackMasiPlacement,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import MasiTable from '../../components/MasiTable';
import { errorMessage, formatDate } from './format';
import { consequence, restores } from './register';

interface Props {
  company: MasiCompany;
  onChange: (c: MasiCompany) => void;
}

/**
 * Which registered company this employer is. Without a code: the candidates masi found, for the operator to choose —
 * nothing is placed on a guess. Placed: what it was placed on, and a way back. A code the register import itself gave
 * has nothing to take back, and the card says nothing.
 */
export default function RegisterCard({ company, onChange }: Readonly<Props>) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<MasiRegisterCandidate[] | null>(null);
  const [placement, setPlacement] = useState<MasiRegisterPlacement | null>(null);
  const [pending, setPending] = useState<MasiRegisterCandidate | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const coded = company.registryCode !== null;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        // what the card shows is set only once the answer is in: nothing is reset synchronously inside the effect
        const found = coded
          ? { placement: await fetchMasiRegisterPlacement(company.id, controller.signal), candidates: null }
          : { placement: null, candidates: await fetchMasiRegisterCandidates(company.id, controller.signal) };
        setPlacement(found.placement);
        setCandidates(found.candidates);
        setPending(null);
        setMessage(null);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setMessage(errorMessage(e, 'Failed to load the register'));
      }
    })();
    return () => controller.abort();
  }, [company.id, coded]);

  async function place(code: string) {
    setBusy(true);
    setMessage(null);
    try {
      const placed = await placeMasiCompany(company.id, code);
      if (placed.id !== company.id) {
        // merged into the company masi already held: this one is gone, its page with it
        void navigate(`/masi/companies/${placed.id}`);
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
            Placed on the register as reg. {placement.registryCode} on {formatDate(placement.placedAt)}.{' '}
            <span className="muted">{restores(placement)}</span>
          </div>
          <LoadingButton className="status-badge error" onClick={() => void takeBack()} loading={busy} label="Take back" />
        </div>
      )}
      {!coded && candidates && (
        <>
          <div className="muted">
            Which registered company is “{company.name}”? masi places an employer only when it is sure.
          </div>
          {candidates.length === 0 && <div className="empty-state">The register has no company by this name.</div>}
          {candidates.length > 0 && (
            <MasiTable label="Registered companies it might be">
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
                  <tr key={c.registryCode}>
                    <td>
                      {c.name}
                      <div className="muted">reg. {c.registryCode}</div>
                    </td>
                    <td>{c.legalForm ?? ''}</td>
                    <td>{c.emtakCode ?? ''}</td>
                    <td>{c.hqCity ?? ''}</td>
                    <td>
                      {c.how === 'EXACT' ? 'same name' : 'starts with it'}
                      {!c.employerForm && <div className="muted">never an employer</div>}
                      {c.heldById !== null && <div className="muted">masi holds it</div>}
                    </td>
                    <td>
                      <button type="button" className="btn-small" onClick={() => setPending(c)} disabled={busy}>
                        Choose
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </MasiTable>
          )}
          {pending && (
            <div role="group" aria-label="Confirm the placement">
              <div>{consequence(company, pending)}.</div>
              <LoadingButton
                className="status-badge action"
                onClick={() => void place(pending.registryCode)}
                loading={busy}
                label={`Place on ${pending.name}`}
              />
              <button type="button" className="btn-small" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          )}
          <form
            className="masi-filters"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) void place(typed.trim());
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
              Place
            </button>
          </form>
        </>
      )}
    </div>
  );
}
