import { ChatChannel } from '../../services/api';

interface ChannelListProps {
  channels: ChatChannel[];
  activeChannelId: number | null;
  onSelectChannel: (channelId: number) => void;
  onCreateChannel: () => void;
  onLeaveChannel: (channelId: number) => void;
  onInvite: (channelId: number) => void;
  onDeleteChannel: (channelId: number) => void;
  onManageMembers: (channelId: number) => void;
}

function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onLeaveChannel,
  onInvite,
  onDeleteChannel,
  onManageMembers,
}: Readonly<ChannelListProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Channels</span>
        <button
          className="status-badge action"
          onClick={onCreateChannel}
          style={{ fontSize: '0.8rem', padding: '4px 12px' }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {channels.length > 0 ? (
          channels.map((channel) => (
            <div
              key={channel.id}
              style={{
                padding: '8px 16px',
                background: activeChannelId === channel.id ? '#e8f0fe' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
            >
              <button
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                style={{
                  minWidth: 0,
                  flex: 1,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  padding: 0,
                }}
              >
                <div style={{
                  fontWeight: activeChannelId === channel.id ? 600 : 400,
                  fontSize: '0.9rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {channel.encrypted ? '\uD83D\uDD12 ' : '# '}{channel.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
                  {channel.memberCount} member{channel.memberCount === 1 ? '' : 's'}
                </div>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {channel.unreadCount > 0 && (
                  <span style={{
                    background: '#0066cc',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minWidth: '18px',
                    textAlign: 'center',
                  }}>
                    {channel.unreadCount}
                  </span>
                )}
                {channel.isOwner && (
                  <button
                    className="status-badge action"
                    onClick={() => onManageMembers(channel.id)}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    Members
                  </button>
                )}
                {channel.isOwner && (
                  <button
                    className="status-badge action"
                    onClick={() => onInvite(channel.id)}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    Invite
                  </button>
                )}
                {channel.isOwner ? (
                  <button
                    className="status-badge danger"
                    onClick={() => {
                      if (confirm(`Delete #${channel.name}? All messages will be permanently lost.`)) {
                        onDeleteChannel(channel.id);
                      }
                    }}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    className="status-badge danger"
                    onClick={() => onLeaveChannel(channel.id)}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px 16px', color: '#999', textAlign: 'center', fontSize: '0.85rem' }}>
            No channels yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelList;
