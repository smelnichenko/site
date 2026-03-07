import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatChannel, fetchChatMessages, sendChatMessage, markChannelRead } from '../../services/api';

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface MessageAreaProps {
  channel: ChatChannel;
}

function MessageArea({ channel }: MessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadMessages() {
      try {
        const msgs = await fetchChatMessages(channel.id, 50, controller.signal);
        if (!cancelled) {
          setMessages(msgs);
          markChannelRead(channel.id).catch(() => {});
        }
      } catch {
        // Ignore aborted requests
      }
    }

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [channel.id]);

  // Auto-scroll to bottom when messages change, if user is near bottom
  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initial scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [channel.id]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setError('');
    setSending(true);
    try {
      const newMsg = await sendChatMessage(channel.id, content);
      setMessages((prev) => [...prev, newMsg]);
      setInput('');
      shouldScrollRef.current = true;
    } catch {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  let lastDate = '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Channel header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}># {channel.name}</span>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>
          {channel.memberCount} member{channel.memberCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', padding: '40px 0', fontSize: '0.9rem' }}>
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg) => {
          const msgDate = new Date(msg.createdAt).toDateString();
          let showDateSeparator = false;
          if (msgDate !== lastDate) {
            showDateSeparator = true;
            lastDate = msgDate;
          }

          return (
            <div key={msg.messageId}>
              {showDateSeparator && (
                <div style={{
                  textAlign: 'center',
                  padding: '12px 0 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#999',
                }}>
                  {formatDateSeparator(msg.createdAt)}
                </div>
              )}
              <div style={{ padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                    {msg.username}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {error && (
        <div style={{ padding: '4px 16px', fontSize: '0.8rem', color: '#721c24' }}>{error}</div>
      )}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #eee',
        display: 'flex',
        gap: '8px',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channel.name}`}
          rows={1}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#0066cc'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#ddd'; }}
        />
        <button
          className="status-badge action"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{ alignSelf: 'flex-end', padding: '8px 16px' }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default MessageArea;
