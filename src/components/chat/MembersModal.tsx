import { useState, useEffect, useRef } from 'react';
import {
  ChannelMember,
  fetchChannelMembers,
  kickFromChannel,
  fetchPublicKeys,
  rotateChannelKeys,
} from '../../services/api';
import { generateChannelKey, wrapChannelKeyForMember, importPublicKey } from '../../services/crypto';
import * as keyStore from '../../services/keyStore';

interface MembersModalProps {
  channelId: number;
  channelName: string;
  encrypted?: boolean;
  onClose: () => void;
  onKicked: () => void;
}

function MembersModal({ channelId, channelName, encrypted, onClose, onKicked }: Readonly<MembersModalProps>) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [kicking, setKicking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchChannelMembers(channelId, controller.signal)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [channelId]);

  const currentUserEmail = localStorage.getItem('email');

  const handleKick = async (userUuid: string) => {
    setError('');
    setKicking(userUuid);
    try {
      await kickFromChannel(channelId, userUuid);
      const remaining = members.filter((m) => m.uuid !== userUuid);
      setMembers(remaining);

      // Rotate channel key for encrypted channels
      if (encrypted) {
        const newChannelKey = await generateChannelKey();
        const remainingIds = remaining.map((m) => m.uuid);
        const pubKeys = await fetchPublicKeys(remainingIds);
        const bundles = await Promise.all(
          pubKeys.map(async (pk) => {
            const recipientPubKey = await importPublicKey(JSON.parse(pk.publicKey));
            const wrapped = await wrapChannelKeyForMember(newChannelKey, recipientPubKey);
            return {
              userUuid: pk.userUuid,
              encryptedChannelKey: wrapped.encryptedChannelKey,
              wrapperPublicKey: JSON.stringify(wrapped.wrapperPublicKey),
            };
          })
        );
        if (bundles.length > 0) {
          const result = await rotateChannelKeys(channelId, bundles);
          keyStore.setChannelKey(channelId, result.newKeyVersion, newChannelKey);
        }
      }

      onKicked();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to kick member');
    } finally {
      setKicking(null);
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
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
          )}
          {!loading && members.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No members</div>
          )}
          {!loading && members.length > 0 &&
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
                    onClick={() => handleKick(member.uuid)}
                    disabled={kicking === member.uuid}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    {kicking === member.uuid ? '...' : 'Kick'}
                  </button>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </dialog>
  );
}

export default MembersModal;
