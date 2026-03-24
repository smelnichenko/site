import { useState, useEffect, useRef } from 'react';
import {
  ChatUser,
  ChannelMember,
  fetchChatUsers,
  fetchChannelMembers,
  inviteToChannel,
  fetchPublicKeys,
  setChannelKeys,
} from '../../services/api';
import { wrapChannelKeyForMember, importPublicKey } from '../../services/crypto';
import * as keyStore from '../../services/keyStore';

interface InviteModalProps {
  channelId: number;
  channelName: string;
  encrypted?: boolean;
  currentKeyVersion?: number;
  onClose: () => void;
  onInvited: () => void;
}

function InviteModal({ channelId, channelName, encrypted, currentKeyVersion, onClose, onInvited }: Readonly<InviteModalProps>) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchChatUsers(controller.signal),
      fetchChannelMembers(channelId, controller.signal),
    ])
      .then(([allUsers, members]: [ChatUser[], ChannelMember[]]) => {
        setUsers(allUsers);
        setMemberIds(new Set(members.map((m) => m.uuid)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [channelId]);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async (userUuid: string) => {
    setError('');
    setInviting(userUuid);
    try {
      await inviteToChannel(channelId, userUuid);

      // Wrap channel key for invited user (encrypted channels)
      if (encrypted && currentKeyVersion) {
        const channelKey = keyStore.getChannelKey(channelId, currentKeyVersion);
        if (channelKey) {
          const pubKeys = await fetchPublicKeys([userUuid]);
          if (pubKeys.length > 0) {
            const recipientPubKey = await importPublicKey(JSON.parse(pubKeys[0].publicKey));
            const wrapped = await wrapChannelKeyForMember(channelKey, recipientPubKey);
            await setChannelKeys(channelId, [{
              userUuid,
              encryptedChannelKey: wrapped.encryptedChannelKey,
              wrapperPublicKey: JSON.stringify(wrapped.wrapperPublicKey),
            }]);
          }
        }
      }

      setMemberIds((prev) => new Set(prev).add(userUuid));
      onInvited();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(null);
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
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              {search ? 'No matching users' : 'No users to invite'}
            </div>
          )}
          {!loading && filtered.length > 0 &&
            filtered.map((user) => {
              const isMember = memberIds.has(user.uuid);
              return (
                <div
                  key={user.id}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0',
                    opacity: isMember ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: isMember ? '#999' : 'inherit' }}>
                    {user.email}
                  </span>
                  {isMember ? (
                    <span style={{ fontSize: '0.7rem', color: '#999', padding: '2px 8px' }}>
                      Joined
                    </span>
                  ) : (
                    <button
                      className="status-badge action"
                      onClick={() => handleInvite(user.uuid)}
                      disabled={inviting === user.uuid}
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    >
                      {inviting === user.uuid ? '...' : 'Invite'}
                    </button>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    </dialog>
  );
}

export default InviteModal;
