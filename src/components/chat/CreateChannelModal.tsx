import { useState } from 'react';
import { createChatChannel, setChannelKeys } from '../../services/api';
import { generateChannelKey, wrapChannelKeyForMember } from '../../services/crypto';
import * as keyStore from '../../services/keyStore';

interface CreateChannelModalProps {
  onCreated: () => void;
  onClose: () => void;
}

function CreateChannelModal({ onCreated, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [encrypted, setEncrypted] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const canEncrypt = keyStore.hasIdentityKeys();

  const handleSubmit = async (e: React.FormEvent) => {
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
        const uid = localStorage.getItem('userId');
        if (publicKey && uid) {
          const wrapped = await wrapChannelKeyForMember(channelKey, publicKey);
          await setChannelKeys(channel.id, [{
            userId: parseInt(uid),
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '0 20px' }}>
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
            <label>Channel Name</label>
            <input
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
                />
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
    </div>
  );
}

export default CreateChannelModal;
