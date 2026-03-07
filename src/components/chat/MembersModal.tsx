import { useState, useEffect } from 'react';
import { ChannelMember, fetchChannelMembers, kickFromChannel } from '../../services/api';

interface MembersModalProps {
  channelId: number;
  channelName: string;
  onClose: () => void;
  onKicked: () => void;
}

function MembersModal({ channelId, channelName, onClose, onKicked }: MembersModalProps) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [kicking, setKicking] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchChannelMembers(channelId, controller.signal)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [channelId]);

  const currentUserEmail = localStorage.getItem('email');

  const handleKick = async (userId: number) => {
    setError('');
    setKicking(userId);
    try {
      await kickFromChannel(channelId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      onKicked();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to kick member');
    } finally {
      setKicking(null);
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
          <span className="card-title">Members of #{channelName}</span>
          <button
            className="status-badge action"
            onClick={onClose}
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No members</div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>{member.email}</span>
                {member.email !== currentUserEmail && (
                  <button
                    className="status-badge danger"
                    onClick={() => handleKick(member.id)}
                    disabled={kicking === member.id}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    {kicking === member.id ? '...' : 'Kick'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default MembersModal;
