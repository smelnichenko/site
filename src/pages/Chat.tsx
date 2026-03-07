import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChatChannel,
  fetchChatChannels,
  joinChatChannel,
  leaveChatChannel,
} from '../services/api';
import ChannelList from '../components/chat/ChannelList';
import MessageArea from '../components/chat/MessageArea';
import CreateChannelModal from '../components/chat/CreateChannelModal';

function Chat() {
  const { channelId: channelIdParam } = useParams<{ channelId?: string }>();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');

  const activeChannelId = channelIdParam ? parseInt(channelIdParam, 10) : null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  const loadChannels = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchChatChannels(signal);
      setChannels(data);
      setLoading(false);
    } catch {
      // Ignore aborted requests
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadChannels(controller.signal);
    // Poll channels for unread counts
    const interval = setInterval(() => loadChannels(), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadChannels]);

  const handleSelectChannel = (id: number) => {
    navigate(`/chat/${id}`);
  };

  const handleJoinChannel = async (id: number) => {
    setError('');
    try {
      await joinChatChannel(id);
      await loadChannels();
      navigate(`/chat/${id}`);
    } catch {
      setError('Failed to join channel');
    }
  };

  const handleLeaveChannel = async (id: number) => {
    setError('');
    try {
      await leaveChatChannel(id);
      await loadChannels();
      if (activeChannelId === id) {
        navigate('/chat');
      }
    } catch {
      setError('Failed to leave channel');
    }
  };

  const handleChannelCreated = async () => {
    setShowCreateModal(false);
    await loadChannels();
  };

  if (loading) {
    return <div className="loading">Loading chat...</div>;
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div style={{
        display: 'flex',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        height: 'calc(100vh - 160px)',
        minHeight: '400px',
        overflow: 'hidden',
      }}>
        {/* Channel sidebar */}
        <div style={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid #eee',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <ChannelList
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
            onCreateChannel={() => setShowCreateModal(true)}
            onJoinChannel={handleJoinChannel}
            onLeaveChannel={handleLeaveChannel}
          />
        </div>

        {/* Message area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeChannel && activeChannel.joined ? (
            <MessageArea channel={activeChannel} />
          ) : activeChannel && !activeChannel.joined ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: '#666',
            }}>
              <span style={{ fontSize: '1.1rem' }}>
                # {activeChannel.name}
              </span>
              <span style={{ fontSize: '0.9rem' }}>
                Join this channel to see messages and participate.
              </span>
              <button
                className="status-badge action"
                onClick={() => handleJoinChannel(activeChannel.id)}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
              >
                Join Channel
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#999',
              fontSize: '0.95rem',
            }}>
              Select a channel to start chatting
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateChannelModal
          onCreated={handleChannelCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

export default Chat;
