import { useState } from 'react';
import { createChatChannel } from '../../services/api';

interface CreateChannelModalProps {
  onCreated: () => void;
  onClose: () => void;
}

function CreateChannelModal({ onCreated, onClose }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setError('');
    setCreating(true);
    try {
      await createChatChannel(trimmed, type);
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

          <div className="form-group">
            <label>Type</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <label className="toggle-label">
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'PUBLIC'}
                  onChange={() => setType('PUBLIC')}
                />
                Public
              </label>
              <label className="toggle-label">
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'PRIVATE'}
                  onChange={() => setType('PRIVATE')}
                />
                Private
              </label>
            </div>
          </div>

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
