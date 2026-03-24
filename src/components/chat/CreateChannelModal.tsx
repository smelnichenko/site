import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { createChatChannel, setChannelKeys } from '../../services/api';
import { generateChannelKey, wrapChannelKeyForMember } from '../../services/crypto';
import * as keyStore from '../../services/keyStore';

interface CreateChannelModalProps {
  onCreated: () => void;
  onClose: () => void;
}

function CreateChannelModal({ onCreated, onClose }: Readonly<CreateChannelModalProps>) {
  const [name, setName] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const canEncrypt = keyStore.hasIdentityKeys();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setError('');
    setCreating(true);
    try {
      const channel = await createChatChannel(trimmed, encrypted);

      if (encrypted && canEncrypt) {
        const channelKey = await generateChannelKey();
        const publicKey = keyStore.getIdentityPublicKey();
        const uid = null; // TODO: get from auth context
        if (publicKey && uid) {
          const wrapped = await wrapChannelKeyForMember(channelKey, publicKey);
          await setChannelKeys(channel.id, [{
            userUuid: uid,
            encryptedChannelKey: wrapped.encryptedChannelKey,
            wrapperPublicKey: JSON.stringify(wrapped.wrapperPublicKey),
          }]);
          keyStore.setChannelKey(channel.id, 1, channelKey);
        }
      }

      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      style={{
        border: 'none',
        padding: 0,
        background: 'transparent',
        maxWidth: '420px',
        width: '100%',
      }}
      onClose={onClose}
    >
      <div className="card" style={{ width: '100%', margin: 0 }}>
        <div className="card-header">
          <span className="card-title">Create Channel</span>
          <button
            className="status-badge action"
            onClick={onClose}
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="channel-name">Channel Name</label>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. general"
              autoFocus
              required
              maxLength={50}
            />
          </div>

          {canEncrypt && (
            <div className="form-group">
              <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={encrypted}
                  onChange={(e) => setEncrypted(e.target.checked)}
                />{' '}
                End-to-end encrypted
              </label>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>
                Messages can only be read by channel members
              </div>
            </div>
          )}

          <div className="form-actions">
            <div />
            <div>
              <button
                type="button"
                className="status-badge action"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="status-badge action"
                disabled={!name.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export default CreateChannelModal;
