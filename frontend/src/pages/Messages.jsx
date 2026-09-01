import React, { useState, useEffect, useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { MessageCircle, Send, ArrowLeft } from 'lucide-react';
import './Messages.css';

const Messages = () => {
  const { user } = useContext(AuthContext);
  const { userId, vehicleId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const isConversationView = Boolean(userId) && Boolean(vehicleId);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/messages/conversations');
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!isConversationView) return;
    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/messages/${userId}/${vehicleId}`);
        setMessages(data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [isConversationView, userId, vehicleId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post('/messages', {
        receiverId: userId,
        vehicleId: vehicleId,
        content: newMessage.trim()
      });
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="msg-guard">
        <h2>Please log in to view messages.</h2>
        <Link to="/login" className="btn-primary">Login</Link>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-container">
        {!isConversationView ? (
          <>
            <div className="messages-header">
              <h1>Messages</h1>
            </div>
            {loading ? (
              <p className="loading-msg">Loading...</p>
            ) : conversations.length === 0 ? (
              <div className="empty-state">
                <MessageCircle size={48} className="empty-icon" />
                <p>No messages yet. Start a conversation from a car listing.</p>
              </div>
            ) : (
              <div className="conversations-list">
                {conversations.map((conv, i) => (
                  <Link
                    key={i}
                    to={`/messages/${conv.otherUser.id}/${conv.vehicle.id}`}
                    className="conversation-item"
                  >
                    <div className="conv-avatar">
                      {conv.otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="conv-info">
                      <div className="conv-header">
                        <span className="conv-name">{conv.otherUser.name}</span>
                        <span className="conv-time">
                          {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="conv-preview">{conv.lastMessage}</p>
                      {conv.vehicle && (
                        <span className="conv-vehicle">
                          {conv.vehicle.year} {conv.vehicle.make} {conv.vehicle.model}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="chat-header">
              <Link to="/messages" className="back-btn">
                <ArrowLeft size={20} />
              </Link>
              <div className="chat-user">
                <span className="chat-name">
                  {messages[0]?.sender?.name || 'Conversation'}
                </span>
              </div>
            </div>
            <div className="chat-messages">
              {loading ? (
                <p className="loading-msg">Loading messages...</p>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`message-bubble ${msg.senderId === user.id ? 'sent' : 'received'}`}
                  >
                    <p>{msg.content}</p>
                    <span className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form className="chat-input" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit" disabled={sending || !newMessage.trim()}>
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Messages;
