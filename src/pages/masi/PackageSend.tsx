import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import {
  fetchMasiPackageSend,
  fetchMasiSendPreview,
  MasiPackage,
  MasiPackageSend,
  MasiSendPreview,
  MasiSendRefused,
  MasiSent,
  sendMasiPackage,
} from '../../services/api';
import LoadingButton from '../../components/LoadingButton';
import { errorMessage, formatBytes, formatDate, formatDateTime } from './format';

interface Props {
  pkg: MasiPackage;
  /** False when the job closed: masi refuses to send to it, so nothing is asked. */
  jobOpen: boolean;
  onChanged: (next: MasiPackage) => void;
}

/** What a request answered, and for which package state: an answer for an older state is not shown. */
interface Loaded<T> {
  key: string;
  value: T | null;
  error: string | null;
}

/**
 * A mail that left: masi's row of it, and - when masi has not recorded it yet (LEFT_UNRECORDED) - the Message-ID it left
 * with, which the row does not carry until it is recorded.
 */
interface Delivered {
  send: MasiPackageSend;
  unrecorded: { messageId: string | null } | null;
}

function whom(name: string | null, address: string): string {
  return name ? `${name} <${address}>` : address;
}

/**
 * "Sent to Mari <mari@x.ee> at …" from the row - who it was for, and where it was delivered when that was not them (a
 * test's sink). A mail that left unrecorded is sent too: it says so, and that it must not be sent again.
 */
function sentLine({ send, unrecorded }: Delivered): string {
  const address = send.toAddress ?? send.deliveredTo;
  const sink = send.deliveredTo === address ? '' : `, delivered to ${send.deliveredTo}`;
  const to = whom(send.toName, address);
  if (unrecorded) {
    const id = unrecorded.messageId ? ` (Message-ID ${unrecorded.messageId})` : '';
    return `Sent to ${to}${sink}: the mail left${id} but masi has not recorded it yet - it keeps trying. Do not send it again.`;
  }
  return `Sent to ${to} at ${formatDateTime(send.sentAt)}${sink}`;
}

/** A send of unknown outcome: it may have left. What to check before sending again, and which attempt it was. */
function unknownLine(last: MasiPackageSend): string {
  const note = last.note ?? 'the mail may have left - check your Bcc copy before sending it again';
  const id = last.messageId ? `, Message-ID ${last.messageId}` : '';
  return `${note.charAt(0).toUpperCase()}${note.slice(1)} (attempt ${last.attempt} of ${formatDateTime(last.claimedAt)}${id})`;
}

/** What became of the last press, when it did not end in a mail that left: the operator presses again or not. */
function lastSendLine(last: MasiPackageSend | null): string | null {
  if (last?.status === 'FAILED') return `The last send failed: ${last.error ?? 'no reason given'}`;
  if (last?.status === 'CLAIMED')
    return `A send is under way since ${formatDateTime(last.claimedAt)}`;
  return null;
}

/**
 * Send on the operator's press: a REVIEWED package of an open job is mailed to a person the job's own postings named,
 * after a dialog that shows exactly the mail. Switched off in masi (404), there is no Send and no error. With nobody to
 * mail, the postings' apply links. Once sent, the package is APPLIED and says to whom and when.
 */
export default function PackageSend({ pkg, jobOpen, onChanged }: Readonly<Props>) {
  const [loaded, setLoaded] = useState<Loaded<MasiSendPreview> | null>(null);
  const [record, setRecord] = useState<Loaded<MasiPackageSend> | null>(null);
  const [delivered, setDelivered] = useState<Delivered | null>(null);
  const [open, setOpen] = useState(false);
  // a refused press may have been refused for a stale preview: the next open shows the mail as it is now
  const [generation, setGeneration] = useState(0);
  const openerRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLOutputElement>(null);
  const focusNext = useRef<'opener' | 'done' | null>(null);

  const sendable = pkg.status === 'REVIEWED' && jobOpen;
  const applied = pkg.status === 'APPLIED';
  // the package as it is: a preview of an earlier state (notes saved since, regenerated) is not the mail any more
  const state = `${pkg.id}:${pkg.updatedAt}`;

  useEffect(() => {
    if (!sendable) return;
    const controller = new AbortController();
    fetchMasiSendPreview(pkg.id, controller.signal).then(
      (value) => setLoaded({ key: state, value, error: null }),
      (e: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({
            key: state,
            value: null,
            error: errorMessage(e, 'The mail could not be previewed'),
          });
        }
      },
    );
    return () => controller.abort();
  }, [sendable, pkg.id, state, generation]);

  // an APPLIED package says whether masi mailed it; a mail that left in this session needs no asking
  const known = delivered !== null;
  useEffect(() => {
    if (!applied || known) return;
    const controller = new AbortController();
    const key = String(pkg.id);
    fetchMasiPackageSend(pkg.id, controller.signal).then(
      (value) => setRecord({ key, value, error: null }),
      (e: unknown) => {
        if (!controller.signal.aborted) {
          setRecord({ key, value: null, error: errorMessage(e, 'The send could not be loaded') });
        }
      },
    );
    return () => controller.abort();
  }, [applied, known, pkg.id]);

  // focus goes back where it came from: to Send when the dialog closes, to what was done when the mail left
  useEffect(() => {
    if (open) return;
    if (focusNext.current === 'opener') openerRef.current?.focus();
    if (focusNext.current === 'done') doneRef.current?.focus();
    focusNext.current = null;
  }, [open, applied]);

  function close(refused: boolean) {
    focusNext.current = 'opener';
    setOpen(false);
    if (refused) setGeneration((g) => g + 1);
  }

  function sent(result: MasiSent) {
    focusNext.current = 'done';
    const unrecorded =
      result.outcome === 'LEFT_UNRECORDED' ? { messageId: result.messageId } : null;
    setDelivered({ send: result.send, unrecorded });
    setOpen(false);
    // the mail left: the package is what masi says it is now - APPLIED, or still REVIEWED while masi has the send (or
    // the APPLIED write after it) still to record
    onChanged({
      ...pkg,
      status: result.packageStatus,
      appliedAt: result.packageStatus === 'APPLIED' ? result.send.sentAt : pkg.appliedAt,
    });
  }

  // a mail that left in this session is said as sent, whatever the package's status says yet
  const done =
    delivered ??
    (applied && record?.key === String(pkg.id) && record.value?.status === 'SENT'
      ? { send: record.value, unrecorded: null }
      : null);
  if (done) {
    return (
      <output className="masi-send masi-send-done" tabIndex={-1} ref={doneRef}>
        {sentLine(done)}
      </output>
    );
  }
  if (applied) {
    return record?.error ? <p className="masi-send muted">{record.error}</p> : null;
  }
  if (!sendable || loaded?.key !== state) return null;
  if (loaded.error) {
    return <p className="masi-send muted">Not sendable: {loaded.error}</p>;
  }
  const preview = loaded.value;
  // switched off in masi: nothing to offer, and nothing wrong to say
  if (!preview) return null;
  if (preview.to.length === 0) {
    return preview.applyAt.length > 0 ? (
      <ul className="masi-send masi-send-apply" aria-label="Where to apply">
        {preview.applyAt.map((url) => (
          <li key={url}>
            Apply at{' '}
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          </li>
        ))}
      </ul>
    ) : (
      <p className="masi-send muted">
        Nothing to send to: the postings published no address and no apply link.
      </p>
    );
  }
  const last = lastSendLine(preview.lastSend);
  return (
    <div className="masi-send">
      {last && <p className="muted">{last}</p>}
      {preview.lastSend?.status === 'UNKNOWN' && (
        <p className="masi-send-warning">{unknownLine(preview.lastSend)}</p>
      )}
      <button
        ref={openerRef}
        type="button"
        className="status-badge add"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Send
      </button>
      {open && <SendDialog pkg={pkg} preview={preview} onDismiss={close} onSent={sent} />}
    </div>
  );
}

interface DialogProps {
  pkg: MasiPackage;
  preview: MasiSendPreview;
  onDismiss: (refused: boolean) => void;
  onSent: (result: MasiSent) => void;
}

/** The confirm dialog: exactly the mail a press sends, the recipient to choose, and the press. */
function SendDialog({ pkg, preview, onDismiss, onSent }: Readonly<DialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  const titleId = useId();
  const [contactId, setContactId] = useState<number>(
    preview.defaultContactId ?? preview.to[0].contactId,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the send so far: the preview's, or - after a 502 in this dialog - masi's word on what came of that press
  const [lastSend, setLastSend] = useState<MasiPackageSend | null>(preview.lastSend);
  // its last send may have left: only an explicit "Send again anyway", carrying that attempt's token, sends it again
  const unknown = lastSend?.status === 'UNKNOWN' ? lastSend : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // a modal dialog: the page behind it inert, Escape its own; a DOM without showModal (jsdom) gets it open in the flow
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    // the mail cannot be called back: the least final control has the focus first - without scrolling the dialog to
    // it, so the mail is read from its top (its heading, the test sink's line)
    cancelRef.current?.focus({ preventScroll: true });
  }, []);

  function dismiss(e: SyntheticEvent) {
    e.preventDefault();
    // while a press is out, its answer is what the operator needs to see: the dialog stays
    if (!sending) onDismiss(error !== null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === 'Escape') dismiss(e);
  }

  /**
   * The browser may close a modal dialog itself (a second Escape with no click between is not cancellable): while a
   * press is out it is opened again, so its answer is seen; otherwise the page learns it is closed.
   */
  function onNativeClose() {
    const dialog = dialogRef.current;
    if (sending && dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      return;
    }
    onDismiss(error !== null);
  }

  /**
   * A 502 is a mail that did not leave or one that may have: masi's preview says which, by the send it now holds. Asked
   * here, the dialog turns to the may-have-left warning and "Send again anyway" without being closed - unless the mail
   * itself changed since this preview, which then has to be opened again. Nothing is sent by asking.
   */
  async function settled(said: string): Promise<string> {
    try {
      const fresh = await fetchMasiSendPreview(pkg.id);
      if (!fresh) return said;
      if (fresh.hash !== preview.hash) {
        return `${said}. The mail has changed since this preview: close it and open Send again`;
      }
      setLastSend(fresh.lastSend);
      return said;
    } catch (e: unknown) {
      return `${said}. What became of it could not be read: ${errorMessage(e, 'the preview failed')}`;
    }
  }

  async function press() {
    // one press, one request: a second click before the first answer is not a second send
    if (pressed.current) return;
    pressed.current = true;
    setSending(true);
    setError(null);
    try {
      const result = await sendMasiPackage(
        pkg.id,
        contactId,
        preview.hash,
        unknown?.token ?? undefined,
      );
      // SENT or LEFT_UNRECORDED: either way the mail left
      onSent(result);
    } catch (e: unknown) {
      const said = errorMessage(e, 'The application was not sent');
      setError(e instanceof MasiSendRefused && e.status === 502 ? await settled(said) : said);
    } finally {
      pressed.current = false;
      setSending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="masi-send-dialog"
      aria-labelledby={titleId}
      onCancel={dismiss}
      onClose={onNativeClose}
      onKeyDown={onKeyDown}
    >
      <h2 id={titleId} className="card-title">
        Send the application
      </h2>
      {unknown && <p className="masi-send-warning">{unknownLine(unknown)}</p>}
      {preview.deliveredTo && (
        <p className="masi-send-sink">{preview.note ?? `test: goes to ${preview.deliveredTo}`}</p>
      )}
      <dl className="masi-send-fields">
        <dt>From</dt>
        <dd>{preview.from}</dd>
        <dt>Reply-To</dt>
        <dd>{preview.replyTo}</dd>
        <dt>Bcc</dt>
        <dd>{preview.bcc ?? 'none'}</dd>
      </dl>
      <fieldset className="masi-send-to" disabled={sending}>
        <legend>To</legend>
        {preview.to.map((r) => (
          <label key={r.contactId} className="masi-send-recipient">
            <input
              type="radio"
              name={`send-to-${pkg.id}`}
              value={r.contactId}
              checked={r.contactId === contactId}
              onChange={() => setContactId(r.contactId)}
            />
            <span>
              {whom(r.name, r.email)}
              {r.title ? ` · ${r.title}` : ''}
              {r.postedAt ? ` · posted ${formatDate(r.postedAt)}` : ''}
            </span>
          </label>
        ))}
      </fieldset>
      <dl className="masi-send-fields">
        <dt>Subject</dt>
        <dd>{preview.subject}</dd>
        <dt>Body</dt>
        <dd>
          {/* the letter as it leaves: plain text, its own lines, scrolled inside the dialog */}
          <pre className="masi-send-body">{preview.body}</pre>
        </dd>
        <dt>Attachment</dt>
        <dd>
          {preview.attachment.name} · {formatBytes(preview.attachment.size)}
        </dd>
      </dl>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="badge-group masi-send-actions">
        <button
          ref={cancelRef}
          type="button"
          className="status-badge"
          onClick={() => onDismiss(error !== null)}
          disabled={sending}
        >
          Cancel
        </button>
        <LoadingButton
          type="button"
          className="status-badge add"
          onClick={() => void press()}
          loading={sending}
          // an UNKNOWN send without its token cannot be confirmed: masi would refuse the press
          disabled={unknown !== null && !unknown.token}
          loadingLabel="Sending…"
          label={unknown ? 'Send again anyway' : 'Send'}
        />
      </div>
    </dialog>
  );
}
