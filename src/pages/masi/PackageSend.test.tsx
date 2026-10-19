import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import PackagePanel from './PackagePanel';
import { prepared, sendPreview } from './testUtils';
import { MasiMailLeftUnrecorded } from '../../services/api';
import type { MasiPackage, MasiPackageSend, MasiSendPreview, MasiSent } from '../../services/api';

vi.mock('../../services/api', async (importOriginal) => ({
  // the real error class: the panel tells a mail that left unrecorded by it
  MasiMailLeftUnrecorded: (await importOriginal<typeof import('../../services/api')>())
    .MasiMailLeftUnrecorded,
  reviewMasiPackage: vi.fn(),
  regenerateMasiPackage: vi.fn(),
  fetchMasiArtifact: vi.fn(),
  fetchMasiSendPreview: vi.fn(),
  sendMasiPackage: vi.fn(),
  fetchMasiPackageSend: vi.fn(),
}));
const api = await import('../../services/api');

const reviewed: MasiPackage = { ...prepared, status: 'REVIEWED' };
const preview: MasiSendPreview = sendPreview;
const SENT_AT = '2026-10-19T09:30:00Z';

function sentTo(to: string, contactId = 40): MasiSent {
  return {
    send: {
      contactId,
      to,
      status: 'SENT',
      error: null,
      messageId: '<m1@pmon.dev>',
      claimedAt: SENT_AT,
      sentAt: SENT_AT,
      attempt: 1,
      token: null,
      note: null,
    },
    packageStatus: 'APPLIED',
  };
}

/** The panel as a page holds it: what it reports changed is what it is given next. */
function Held({ pkg, jobOpen = true }: Readonly<{ pkg: MasiPackage; jobOpen?: boolean }>) {
  const [current, setCurrent] = useState(pkg);
  return <PackagePanel pkg={current} onChanged={setCurrent} jobOpen={jobOpen} />;
}

/** A send that answers only when the test says so. */
function held<T>() {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets the answers already given reach the page. */
const settle = () => Promise.resolve();

/** A field of the mail by its term: the dialog lists each as a term and its definition. */
function fieldsOf(dialog: HTMLElement) {
  const terms = within(dialog)
    .getAllByRole('term')
    .map((t) => t.textContent);
  const definitions = within(dialog).getAllByRole('definition');
  return (term: string) => definitions[terms.indexOf(term)];
}

async function openDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'Send' }));
  return screen.getByRole('dialog', { name: 'Send the application' });
}

beforeEach(() => {
  vi.mocked(api.fetchMasiSendPreview).mockReset();
  vi.mocked(api.sendMasiPackage).mockReset();
  vi.mocked(api.fetchMasiPackageSend).mockReset();
});

describe('PackageSend — who is offered Send', () => {
  it('a REVIEWED package of an open job with someone to mail offers Send, from its own preview', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    render(<Held pkg={reviewed} />);
    const send = await screen.findByRole('button', { name: 'Send' });
    expect(send).toHaveAttribute('aria-haspopup', 'dialog');
    expect(api.fetchMasiSendPreview).toHaveBeenCalledWith(11, expect.any(AbortSignal));
    // nothing is sent by being shown
    expect(api.sendMasiPackage).not.toHaveBeenCalled();
  });

  it('a PREPARED package, or a REVIEWED one of a closed job, is never previewed and offers no Send', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    const { unmount } = render(<Held pkg={prepared} />);
    expect(await screen.findByRole('button', { name: 'Mark reviewed' })).toBeInTheDocument();
    unmount();
    render(<Held pkg={reviewed} jobOpen={false} />);
    expect(await screen.findByRole('button', { name: 'Mark applied' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(api.fetchMasiSendPreview).not.toHaveBeenCalled();
  });

  it('switched off in masi (404, the preview is null): no Send, and no error either', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(null);
    render(<Held pkg={reviewed} />);
    await waitFor(() => expect(api.fetchMasiSendPreview).toHaveBeenCalled());
    // the answer is in: the panel has drawn it
    await act(settle);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('package-panel')).not.toHaveTextContent(
      /sendable|apply at|nothing to send|failed/i,
    );
  });

  it('a package masi refuses to send (409) says why, and offers no Send', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockRejectedValue(
      new Error('the company of job 7 is blacklisted'),
    );
    render(<Held pkg={reviewed} />);
    expect(
      await screen.findByText('Not sendable: the company of job 7 is blacklisted'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('nobody to mail but apply links: "apply at" each, in a new tab that is handed nothing of this page', async () => {
    const url = 'https://nortal.teamtailor.com/jobs/123-senior-java/applications/new';
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      to: [],
      defaultContactId: null,
      applyAt: [url, 'https://cv.ee/apply/9'],
    });
    render(<Held pkg={reviewed} />);
    const link = await screen.findByRole('link', { name: url });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const where = screen.getByRole('list', { name: 'Where to apply' });
    expect(within(where).getAllByRole('listitem')[0]).toHaveTextContent(`Apply at ${url}`);
    expect(screen.getByRole('link', { name: 'https://cv.ee/apply/9' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('nobody to mail and no apply link: says so, offers no Send', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      to: [],
      defaultContactId: null,
    });
    render(<Held pkg={reviewed} />);
    expect(
      await screen.findByText(
        'Nothing to send to: the postings published no address and no apply link.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('the last press failed: says so beside Send, which presses again', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      lastSend: {
        contactId: 40,
        to: 'kati.karu@nortal.com',
        status: 'FAILED',
        error: '550 mailbox unavailable',
        messageId: null,
        claimedAt: SENT_AT,
        sentAt: null,
        attempt: 1,
        token: null,
        note: null,
      },
    });
    render(<Held pkg={reviewed} />);
    expect(
      await screen.findByText('The last send failed: 550 mailbox unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});

describe('PackageSend — the confirm dialog shows exactly the mail', () => {
  it('From, Reply-To, Bcc, the recipients (the first chosen), Subject, the body as plain text, the attachment', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    const field = fieldsOf(dialog);
    expect(field('From')).toHaveTextContent('Mari Operaator <apply@pmon.dev>');
    expect(field('Reply-To')).toHaveTextContent('operator@example.com');
    expect(field('Bcc')).toHaveTextContent('operator@example.com');
    expect(field('Subject')).toHaveTextContent(
      'Application: Senior Java Developer - Mari Operaator',
    );
    expect(field('Attachment')).toHaveTextContent('Mari-Operaator-CV.pdf · 47.1 KB');
    // the body is the letter's own text, line breaks and all
    expect(field('Body')).toHaveTextContent(preview.body, { normalizeWhitespace: false });

    const to = within(dialog).getByRole('group', { name: 'To' });
    const kati = within(to).getByRole('radio', {
      name: 'Kati Karu <kati.karu@nortal.com> · Talent Partner · posted 18 Oct 2026',
    });
    const jobs = within(to).getByRole('radio', {
      name: 'jobs@nortal.com · posted 1 Oct 2026',
    });
    expect(kati).toBeChecked();
    expect(jobs).not.toBeChecked();
    // production: no sink line
    expect(dialog).not.toHaveTextContent(/test: goes to/);
  });

  it('outside production: the sink line, and no Bcc copy', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      bcc: null,
      deliveredTo: 'sink@pmon.dev',
      note: 'test: goes to sink@pmon.dev, not to the contact; no Bcc copy',
    });
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    expect(
      within(dialog).getByText('test: goes to sink@pmon.dev, not to the contact; no Bcc copy'),
    ).toBeInTheDocument();
    expect(fieldsOf(dialog)('Bcc')).toHaveTextContent('none');
  });

  it('a sink with no note from masi still says where the mail goes', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      bcc: null,
      deliveredTo: 'sink@pmon.dev',
    });
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    expect(within(dialog).getByText('test: goes to sink@pmon.dev')).toBeInTheDocument();
  });

  it('focus moves into the dialog (Cancel: the mail cannot be called back) and back to Send on Escape', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    render(<Held pkg={reviewed} />);
    const opener = await screen.findByRole('button', { name: 'Send' });
    const dialog = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(api.sendMasiPackage).not.toHaveBeenCalled();
  });

  it("the browser's cancel of the modal dialog (its Escape) closes it the same way", async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
  });

  it('Cancel closes it, sends nothing, and gives focus back to Send', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
    expect(api.sendMasiPackage).not.toHaveBeenCalled();
    // a cancel is no refusal: the preview shown is still the mail, not asked again
    expect(api.fetchMasiSendPreview).toHaveBeenCalledTimes(1);
  });
});

describe('PackageSend — the press', () => {
  it('posts the chosen contact and the preview hash; the package is APPLIED and says to whom and when', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    vi.mocked(api.sendMasiPackage).mockResolvedValue(sentTo('kati.karu@nortal.com'));
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(api.sendMasiPackage).toHaveBeenCalledWith(11, 40, 'h1', undefined);
    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent(
      'Sent to Kati Karu <kati.karu@nortal.com> at 19 Oct 2026, 12:30',
    );
    expect(done).not.toHaveTextContent('delivered to');
    expect(done).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('applied', { selector: '.status-badge' })).toBeInTheDocument();
    // APPLIED: no second Send, no manual apply
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark applied' })).not.toBeInTheDocument();
    // the mail that left in this session is not asked for again
    expect(api.fetchMasiPackageSend).not.toHaveBeenCalled();
  });

  it('another recipient chosen is the one posted; outside production it says where the mail was delivered', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      bcc: null,
      deliveredTo: 'sink@pmon.dev',
    });
    vi.mocked(api.sendMasiPackage).mockResolvedValue(sentTo('sink@pmon.dev', 41));
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('radio', { name: /^jobs@nortal\.com/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(api.sendMasiPackage).toHaveBeenCalledWith(11, 41, 'h1', undefined);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent to jobs@nortal.com at 19 Oct 2026, 12:30, delivered to sink@pmon.dev',
    );
  });

  it.each([
    [
      '409, a stale preview',
      'package 11 changed since its preview (the package, the people it may go to, or the settings): preview it again',
    ],
    [
      '409, another press holds it',
      'package 11 is being sent by another press (since 2026-10-19T09:29:00Z)',
    ],
    ['502, the mail server refused', 'the mail did not leave: 550 5.1.1 mailbox unavailable'],
  ])(
    '%s: the reason in the dialog, nothing retried, and a new press is allowed',
    async (_case, reason) => {
      vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
      vi.mocked(api.sendMasiPackage).mockRejectedValue(new Error(reason));
      render(<Held pkg={reviewed} />);
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(reason);
      expect(screen.getByRole('dialog')).toBe(dialog);
      // nothing tries again on its own
      await act(settle);
      expect(api.sendMasiPackage).toHaveBeenCalledTimes(1);
      // still REVIEWED, nothing claimed sent
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByText('reviewed', { selector: '.status-badge' })).toBeInTheDocument();
      const again = within(dialog).getByRole('button', { name: 'Send' });
      expect(again).toBeEnabled();
      await userEvent.click(again);
      await waitFor(() => expect(api.sendMasiPackage).toHaveBeenCalledTimes(2));
    },
  );

  it('closed after a refusal, the next open shows the mail as it is now, and its press carries the new hash', async () => {
    vi.mocked(api.fetchMasiSendPreview)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({
        ...preview,
        subject: 'Application: Java Developer - Mari Operaator',
        hash: 'h2',
      });
    vi.mocked(api.sendMasiPackage)
      .mockRejectedValueOnce(new Error('package 11 changed since its preview: preview it again'))
      .mockResolvedValueOnce(sentTo('kati.karu@nortal.com'));
    render(<Held pkg={reviewed} />);
    let dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await within(dialog).findByRole('alert');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.fetchMasiSendPreview).toHaveBeenCalledTimes(2));
    dialog = await openDialog();
    expect(
      await within(dialog).findByText('Application: Java Developer - Mari Operaator'),
    ).toBeInTheDocument();
    // a fresh dialog: the old refusal is not shown over the new mail
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(api.sendMasiPackage).toHaveBeenLastCalledWith(11, 40, 'h2', undefined);
  });

  it('a double click sends once: Send is disabled while the press is out, and Escape does not hide its answer', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    const pending = held<MasiSent>();
    vi.mocked(api.sendMasiPackage).mockReturnValue(pending.promise);
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Send' }));
    const sending = within(dialog).getByRole('button', { name: 'Sending…' });
    expect(sending).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    for (const radio of within(dialog).getAllByRole('radio')) expect(radio).toBeDisabled();
    await userEvent.click(sending);
    // Escape on the dialog, and the browser's own cancel of a modal dialog (its Escape wherever the focus is)
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(
      fireEvent(dialog, new Event('cancel', { cancelable: true })),
      'the cancel is refused',
    ).toBe(false);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(api.sendMasiPackage).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(sentTo('kati.karu@nortal.com'));
      await settle();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Sent to Kati Karu');
    expect(api.sendMasiPackage).toHaveBeenCalledTimes(1);
  });
});

describe('PackageSend — an APPLIED package', () => {
  it('mailed by masi: says to whom and when, from the send record', async () => {
    vi.mocked(api.fetchMasiPackageSend).mockResolvedValue(sentTo('kati.karu@nortal.com').send);
    render(<Held pkg={{ ...prepared, status: 'APPLIED', appliedAt: SENT_AT }} />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent to kati.karu@nortal.com at 19 Oct 2026, 12:30',
    );
    expect(api.fetchMasiPackageSend).toHaveBeenCalledWith(11, expect.any(AbortSignal));
    expect(api.fetchMasiSendPreview).not.toHaveBeenCalled();
  });

  it('applied by hand (no send: 404), or a send that failed before: says nothing of a mail', async () => {
    vi.mocked(api.fetchMasiPackageSend)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...sentTo('kati.karu@nortal.com').send,
        status: 'FAILED',
        error: '550',
        sentAt: null,
      });
    const applied = { ...prepared, status: 'APPLIED', appliedAt: SENT_AT };
    const { unmount } = render(<Held pkg={applied} />);
    await waitFor(() => expect(api.fetchMasiPackageSend).toHaveBeenCalledTimes(1));
    await act(settle);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();
    render(<Held pkg={applied} />);
    await waitFor(() => expect(api.fetchMasiPackageSend).toHaveBeenCalledTimes(2));
    await act(settle);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save response' })).toBeInTheDocument();
  });

  it('a send record that cannot be loaded says so', async () => {
    vi.mocked(api.fetchMasiPackageSend).mockRejectedValue(new Error('the database is down'));
    render(<Held pkg={{ ...prepared, status: 'APPLIED', appliedAt: SENT_AT }} />);
    expect(await screen.findByText('the database is down')).toBeInTheDocument();
  });
});

/** A send of unknown outcome, as masi's preview reports it: the attempt, its Message-ID, its token and what to check. */
const unknownSend: MasiPackageSend = {
  contactId: 40,
  to: 'kati.karu@nortal.com',
  status: 'UNKNOWN',
  error: 'the connection dropped after the whole mail went',
  messageId: '<m7@pmon.dev>',
  claimedAt: '2026-10-19T09:00:00Z',
  sentAt: null,
  attempt: 2,
  token: 'tok-2',
  note: 'the mail may have left - check your Bcc copy before sending it again',
};
const UNKNOWN_LINE =
  'The mail may have left - check your Bcc copy before sending it again (attempt 2 of 19 Oct 2026, 12:00, Message-ID <m7@pmon.dev>)';

describe('PackageSend — a send that may have left', () => {
  it('the last send UNKNOWN: a warning beside Send, and in the dialog only an explicit "Send again anyway"', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({ ...preview, lastSend: unknownSend });
    vi.mocked(api.sendMasiPackage).mockResolvedValue(sentTo('kati.karu@nortal.com'));
    render(<Held pkg={reviewed} />);
    expect(await screen.findByText(UNKNOWN_LINE)).toBeInTheDocument();
    const dialog = await openDialog();
    expect(within(dialog).getByText(UNKNOWN_LINE)).toBeInTheDocument();
    // a plain Send would only earn masi's 409: the dialog does not offer one
    expect(within(dialog).queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send again anyway' }));
    expect(api.sendMasiPackage).toHaveBeenCalledWith(11, 40, 'h1', 'tok-2');
    expect(await screen.findByRole('status')).toHaveTextContent('Sent to Kati Karu');
  });

  it('a plain press carries no confirmation; an UNKNOWN send with no token cannot be confirmed', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue({
      ...preview,
      lastSend: { ...unknownSend, token: null },
    });
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Send again anyway' })).toBeDisabled();
    expect(api.sendMasiPackage).not.toHaveBeenCalled();
  });

  it('a FAILED or SENT-less preview is pressed with no confirmation at all', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    vi.mocked(api.sendMasiPackage).mockResolvedValue(sentTo('kati.karu@nortal.com'));
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    expect(
      within(dialog).queryByRole('button', { name: 'Send again anyway' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/may have left/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(api.sendMasiPackage).toHaveBeenCalledWith(11, 40, 'h1', undefined);
  });

  it('502 "may have left": the reason in the dialog; closed, the next preview shows it UNKNOWN', async () => {
    const reason =
      'the mail may have left (Message-ID <m7@pmon.dev>): the connection dropped. Check your Bcc copy; sending it again needs your confirmation';
    vi.mocked(api.fetchMasiSendPreview)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, lastSend: unknownSend });
    vi.mocked(api.sendMasiPackage).mockRejectedValueOnce(new Error(reason));
    render(<Held pkg={reviewed} />);
    let dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(reason);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(UNKNOWN_LINE)).toBeInTheDocument();
    dialog = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Send again anyway' })).toBeEnabled();
    expect(api.sendMasiPackage).toHaveBeenCalledTimes(1);
  });

  it('the mail LEFT but masi has not recorded it: said as sent, no error, and no Send to press again', async () => {
    const said =
      'the mail LEFT (Message-ID <m9@pmon.dev>) but was not recorded (the database is down); masi keeps trying to record it. Do not send it again';
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    vi.mocked(api.sendMasiPackage).mockRejectedValue(new MasiMailLeftUnrecorded(said));
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent(`Sent to Kati Karu <kati.karu@nortal.com>: ${said}`);
    expect(done).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(api.sendMasiPackage).toHaveBeenCalledTimes(1);
  });

  it('sent, while masi has still to mark the package APPLIED: said as sent, never offered again', async () => {
    vi.mocked(api.fetchMasiSendPreview).mockResolvedValue(preview);
    vi.mocked(api.sendMasiPackage).mockResolvedValue({
      ...sentTo('kati.karu@nortal.com'),
      packageStatus: 'REVIEWED',
    });
    render(<Held pkg={reviewed} />);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sent to Kati Karu');
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    // the preview is not asked again: what was sent stays said
    expect(api.fetchMasiSendPreview).toHaveBeenCalledTimes(1);
  });
});
