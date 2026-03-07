import { useState, useEffect } from 'react';
import { ChatUser, fetchChatUsers, inviteToChannel } from '../../services/api';

interface InviteModalProps {
  channelId: number;
  channelName: string;
  onClose: () => void;
  onInvited: () => void;
}

function InviteModal({ channelId, channelName, onClose, onInvited }: InviteModalProps) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchChatUsers(controller.signal)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async (userId: number) => {
    setError('');
    setInviting(userId);
    try {
      await inviteToChannel(channelId, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      onInvited();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(null);
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
          <span className="card-title">Invite to #{channelName}</span>
          <button
            className="status-badge action"
            onClick={onClose}
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            autoFocus
          />
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              {search ? 'No matching users' : 'No users to invite'}
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>{user.email}</span>
                <button
                  className="status-badge action"
                  onClick={() => handleInvite(user.id)}
                  disabled={inviting === user.id}
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                >
                  {inviting === user.id ? '...' : 'Invite'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteModal;
