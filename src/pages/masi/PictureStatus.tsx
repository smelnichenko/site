import { useCallback, useEffect, useState } from 'react';
import LoadingButton from '../../components/LoadingButton';
import { collectMasiPictures, fetchMasiPictureStatus, MasiPictureStatus } from '../../services/api';
import { badgeClass, errorMessage } from './format';
import { daysToClear } from './pictureRate';

/**
 * What the contact-picture lane is doing, on the Sources page.
 *
 * The lane collects a few contacts' pictures a tick in the background, and until this panel existed "switched off",
 * "asked and nobody had one" and "every attempt failed" looked identical from the outside - the only way to tell them
 * apart was a SQL query against contact_picture_lookup.
 */
export default function PictureStatus() {
  const [status, setStatus] = useState<MasiPictureStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setStatus(await fetchMasiPictureStatus(controller.signal));
      } catch (e: unknown) {
        if (!controller.signal.aborted)
          setError(errorMessage(e, 'Failed to load the picture status'));
      }
    })();
    return () => controller.abort();
  }, []);

  const collect = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const started = await collectMasiPictures();
      const plural = started.started === 1 ? '' : 's';
      setMessage(
        `A pass over ${started.started} contact${plural} started; it runs in the background.`,
      );
      setStatus(await fetchMasiPictureStatus());
      setError(null);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to start the picture pass'));
    } finally {
      setBusy(false);
    }
  }, []);

  if (error && !status) {
    return (
      <div className="card">
        <h3>Contact pictures</h3>
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="card">
        <h3>Contact pictures</h3>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const found = status.lookupsByOutcome.FOUND ?? 0;
  const none = status.lookupsByOutcome.NONE ?? 0;
  const failed = status.lookupsByOutcome.FAILED ?? 0;
  const days = daysToClear(status.dueNow, status.perTick, status.tick);

  return (
    <div className="card">
      <h3>
        Contact pictures{' '}
        <span className={badgeClass(status.enabled ? 'OK' : 'DISABLED_AUTO')}>
          {status.enabled ? 'collecting' : 'switched off'}
        </span>
      </h3>
      <p className="muted">
        {status.perTick} contacts every {status.tick}, each revisited after {status.revisit}. Face
        matching {status.face ? 'on' : 'off'}.
      </p>
      <table className="table">
        <tbody>
          <tr>
            <th>Contacts with a picture</th>
            <td>{status.contactsWithAPicture}</td>
          </tr>
          <tr>
            <th>Attempts: found / none / failed</th>
            <td>
              {found} / {none} / <span className={failed > 0 ? 'error' : ''}>{failed}</span>
            </td>
          </tr>
          <tr>
            <th>Asked today</th>
            <td>{status.askedToday}</td>
          </tr>
          <tr>
            <th>Waiting to be asked</th>
            <td>
              {status.dueNow}
              {days === null ? null : (
                <span className="muted">
                  {' '}
                  — about {days} day{days === 1 ? '' : 's'} at this rate
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {status.enabled ? (
        <LoadingButton
          loading={busy}
          loadingLabel="Starting…"
          label="Collect pictures now"
          onClick={() => void collect()}
        />
      ) : (
        <p className="muted">
          Nothing is collected while the lane is off: contact-pictures.enabled is false in the
          chart.
        </p>
      )}
      {message === null ? null : <p className="muted">{message}</p>}
      {error === null ? null : <p className="error">{error}</p>}
    </div>
  );
}
