import { useState, useEffect, useRef } from 'react';
import {
  ChatMessage,
  ChatChannel,
  ChainVerification,
  fetchChatMessages,
  sendChatMessage,
  editChatMessage,
  markChannelRead,
  verifyChannelChain,
  fetchChannelKeys,
  approveRegistration,
  declineRegistration,
} from '../../services/api';
import { encryptMessage, decryptMessage, unwrapChannelKey } from '../../services/crypto';
import * as keyStore from '../../services/keyStore';
import { subscribe } from '../../services/centrifugoClient';

function mergeMessage(prev: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  return prev.some((m) => m.messageId === incoming.messageId) ? prev : [...prev, incoming];
}

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

function MessageArea({ channel }: Readonly<MessageAreaProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [chainStatus, setChainStatus] = useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(!channel.encrypted);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  const currentUserEmail = localStorage.getItem('email');
  const isEncrypted = channel.encrypted;

  // Load channel key for encrypted channels
  useEffect(() => {
    if (!isEncrypted) {
      setKeyLoaded(true);
      return;
    }

    let cancelled = false;
    async function loadChannelKey() {
      try {
        const existing = keyStore.getLatestChannelKey(channel.id);
        if (existing) {
          setKeyLoaded(true);
          return;
        }
        const bundles = await fetchChannelKeys(channel.id);
        const privateKey = keyStore.getIdentityPrivateKey();
        if (!privateKey || bundles.length === 0) return;

        for (const bundle of bundles) {
          const channelKey = await unwrapChannelKey(
            bundle.encryptedChannelKey,
            JSON.parse(bundle.wrapperPublicKey),
            privateKey
          );
          keyStore.setChannelKey(channel.id, bundle.keyVersion, channelKey);
        }
        if (!cancelled) setKeyLoaded(true);
      } catch (e) {
        console.warn('Failed to load channel key:', e);
      }
    }
    loadChannelKey();
    return () => { cancelled = true; };
  }, [channel.id, isEncrypted]);

  async function decryptMessages(msgs: ChatMessage[]): Promise<ChatMessage[]> {
    if (!isEncrypted) return msgs;
    return Promise.all(msgs.map(async (msg) => {
      try {
        const version = msg.keyVersion ?? channel.currentKeyVersion;
        const key = keyStore.getChannelKey(channel.id, version);
        if (!key) return { ...msg, content: '[Unable to decrypt]' };
        const plaintext = await decryptMessage(msg.content, key);
        const decrypted: ChatMessage = { ...msg, content: plaintext };
        if (msg.editedContent) {
          decrypted.editedContent = await decryptMessage(msg.editedContent, key);
        }
        return decrypted;
      } catch {
        return { ...msg, content: '[Unable to decrypt]' };
      }
    }));
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadMessages() {
      try {
        const msgs = await fetchChatMessages(channel.id, 50, controller.signal);
        if (!cancelled) {
          const decrypted = await decryptMessages(msgs);
          setMessages(decrypted);
          markChannelRead(channel.id).catch(() => {});
        }
      } catch {
        // Ignore aborted requests
      }
    }

    if (keyLoaded || !isEncrypted) {
      // Initial REST fetch + subscribe to live publications. Backend
      // publishes the same ChatMessage shape on `chat:room:<id>` as
      // /api returns, so the sub handler can splice into local state.
      loadMessages();

      const handlePublication = async (msg: ChatMessage) => {
        if (cancelled) return;
        const [decrypted] = await decryptMessages([msg]);
        setMessages((prev) => mergeMessage(prev, decrypted));
        markChannelRead(channel.id).catch(() => {});
      };
      const sub = subscribe<ChatMessage>(`chat:room:${channel.id}`, {
        onPublication: handlePublication,
      });

      // Fallback poll kept while we soak the subscription path; drop
      // once we're confident every page hands off cleanly.
      const interval = setInterval(loadMessages, 30000);

      return () => {
        cancelled = true;
        controller.abort();
        clearInterval(interval);
        sub.unsubscribe();
      };
    }
    return () => { cancelled = true; };
  }, [channel.id, keyLoaded]);

  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
      let msgContent = content;
      let keyVersion: number | undefined;
      if (isEncrypted) {
        const key = keyStore.getLatestChannelKey(channel.id);
        if (!key) {
          setError('No encryption key available');
          setSending(false);
          return;
        }
        msgContent = await encryptMessage(content, key);
        keyVersion = channel.currentKeyVersion;
      }
      const newMsg = await sendChatMessage(channel.id, msgContent, undefined, keyVersion);
      // Show plaintext locally
      setMessages((prev) => [...prev, { ...newMsg, content }]);
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

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingId(msg.messageId);
    setEditContent(msg.editedContent || msg.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    const content = editContent.trim();
    if (!content) return;

    setError('');
    try {
      let contentToSend = content;
      if (channel.encrypted) {
        const channelKey = keyStore.getChannelKey(channel.id, channel.currentKeyVersion);
        if (channelKey) {
          contentToSend = await encryptMessage(content, channelKey);
        }
      }
      await editChatMessage(channel.id, messageId, contentToSend);
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === messageId ? { ...m, editedContent: content } : m
        )
      );
      setEditingId(null);
      setEditContent('');
    } catch {
      setError('Failed to edit message');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, messageId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(messageId);
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const result = await verifyChannelChain(channel.id);
      setChainStatus(result);
    } catch {
      setError('Failed to verify chain');
    } finally {
      setVerifying(false);
    }
  };

  const handleApprove = async (approvalId: number) => {
    try {
      await approveRegistration(approvalId);
    } catch {
      setError('Failed to approve registration');
    }
  };

  const handleDecline = async (approvalId: number) => {
    const reason = prompt('Reason for declining (optional):');
    try {
      await declineRegistration(approvalId, reason || undefined);
    } catch {
      setError('Failed to decline registration');
    }
  };

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
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
          {isEncrypted ? '\uD83D\uDD12 ' : '# '}{channel.name}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>
          {channel.memberCount} member{channel.memberCount === 1 ? '' : 's'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {chainStatus && (
            <span style={{
              fontSize: '0.75rem',
              color: chainStatus.intact ? '#28a745' : '#dc3545',
              fontWeight: 600,
            }}>
              {chainStatus.intact
                ? `Chain OK (${chainStatus.messageCount} msgs)`
                : `Chain broken at ${chainStatus.validCount}/${chainStatus.messageCount}`}
            </span>
          )}
          <button
            className="status-badge action"
            onClick={handleVerifyChain}
            disabled={verifying}
            style={{ fontSize: '0.7rem', padding: '2px 8px' }}
          >
            {verifying ? '...' : 'Verify'}
          </button>
        </div>
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
          const isSystemMessage = msg.messageType === 'SYSTEM';
          const isOwnMessage = msg.username === currentUserEmail;
          const isEdited = msg.editedContent != null;
          const displayContent = msg.editedContent || msg.content;

          let approvalMeta: { type?: string; approvalId?: number; status?: string } | null = null;
          if (isSystemMessage && msg.metadata) {
            try { approvalMeta = JSON.parse(msg.metadata); } catch { /* ignore */ }
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
              {isSystemMessage ? (
                <div style={{
                  padding: '8px 16px',
                  margin: '4px 0',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '3px solid #6c757d',
                  fontSize: '0.85rem',
                  color: '#555',
                }}>
                  <div style={{ lineHeight: 1.5 }}>{displayContent}</div>
                  {approvalMeta?.type === 'approval' && approvalMeta.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="status-badge add"
                        onClick={() => handleApprove(approvalMeta.approvalId!)}
                        style={{ fontSize: '0.75rem', padding: '3px 12px' }}
                      >
                        Accept
                      </button>
                      <button
                        className="status-badge danger"
                        onClick={() => handleDecline(approvalMeta.approvalId!)}
                        style={{ fontSize: '0.75rem', padding: '3px 12px' }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {approvalMeta?.type === 'approval' && approvalMeta.status !== 'PENDING' && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '0.75rem',
                      color: approvalMeta.status === 'APPROVED' ? '#28a745' : '#dc3545',
                      fontWeight: 600,
                    }}>
                      {approvalMeta.status === 'APPROVED' ? 'Approved' : 'Declined'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '4px' }}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              ) : (
              <div
                style={{ padding: '4px 0', position: 'relative' }}
                className="chat-message"
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
                    {msg.username}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    {formatTime(msg.createdAt)}
                  </span>
                  {isEdited && (
                    <span style={{ fontSize: '0.7rem', color: '#999', fontStyle: 'italic' }}>
                      (edited)
                    </span>
                  )}
                  {isOwnMessage && editingId !== msg.messageId && (
                    <button
                      onClick={() => handleStartEdit(msg)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        padding: '0 4px',
                      }}
                    >
                      edit
                    </button>
                  )}
                </div>
                {editingId === msg.messageId ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, msg.messageId)}
                      autoFocus
                      rows={1}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: '1px solid #0066cc',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: 1.5,
                      }}
                    />
                    <button
                      className="status-badge action"
                      onClick={() => handleSaveEdit(msg.messageId)}
                      style={{ fontSize: '0.7rem', padding: '2px 8px', alignSelf: 'flex-end' }}
                    >
                      Save
                    </button>
                    <button
                      className="status-badge danger"
                      onClick={handleCancelEdit}
                      style={{ fontSize: '0.7rem', padding: '2px 8px', alignSelf: 'flex-end' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {displayContent}
                  </div>
                )}
                {msg.hash && (
                  <div
                    style={{
                      fontSize: '0.65rem',
                      color: '#ccc',
                      fontFamily: 'monospace',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={`hash: ${msg.hash}\nprev: ${msg.prevHash}`}
                  >
                    {msg.hash?.substring(0, 16)}...
                  </div>
                )}
              </div>
              )}
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
