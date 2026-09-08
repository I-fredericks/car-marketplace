import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import api from '../utils/api';
import OfferPanel from '../components/OfferPanel';
import { MessageCircle, Send, ArrowLeft, Lock, Trash2, MailOpen, MailX } from 'lucide-react';
import Avatar from '../components/Avatar';

const Messages = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { subscribeToMessages, setActiveConversation, markConversationRead } = useEvents();
  const { userId, vehicleId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingConv, setDeletingConv] = useState(null);
  const [deletingMsg, setDeletingMsg] = useState(null);
  const [filter, setFilter] = useState('all');
  const chatScrollRef = useRef(null);

  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'unread') return conv.unreadCount > 0;
    if (filter === 'spam') return conv.spamCount > 0;
    return true;
  });

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

  // Tell the realtime layer which chat is open (suppresses toasts/unread
  // for the conversation the user is already reading)
  useEffect(() => {
    setActiveConversation(
      isConversationView ? { userId: Number(userId), vehicleId: Number(vehicleId) } : null
    );
    return () => setActiveConversation(null);
  }, [isConversationView, userId, vehicleId, setActiveConversation]);

  useEffect(() => {
    if (!isConversationView && user) {
      fetchConversations();
    }
  }, [isConversationView, user]);

  useEffect(() => {
    if (!isConversationView) return;
    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/messages/${userId}/${vehicleId}`);
        setMessages(data);
        // Clear the unread badge for this conversation
        markConversationRead(userId, vehicleId);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [isConversationView, userId, vehicleId, markConversationRead]);

  // Live delivery: new messages arrive over SSE without any refresh
  useEffect(() => {
    if (!user) return undefined;
    return subscribeToMessages((msg) => {
      if (isConversationView && msg.senderId === Number(userId) && msg.vehicleId === Number(vehicleId)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        markConversationRead(userId, vehicleId);
      } else if (!isConversationView) {
        // List view: keep the conversation list fresh
        fetchConversations();
      }
    });
  }, [user, isConversationView, userId, vehicleId, subscribeToMessages, markConversationRead]);

  // Keep the newest message in view as messages arrive
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
      setMessages(prev => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async (conv) => {
    if (!window.confirm('Delete this entire conversation? This cannot be undone.')) return;
    setDeletingConv(conv.vehicle?.id);
    try {
      await api.delete(`/messages/${conv.otherUser.id}/${conv.vehicle?.id}`);
      setConversations(prev => prev.filter(c => c.otherUser.id !== conv.otherUser.id || c.vehicle?.id !== conv.vehicle?.id));
    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Failed to delete conversation.');
    } finally {
      setDeletingConv(null);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setDeletingMsg(messageId);
    try {
      await api.delete(`/messages/message/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message.');
    } finally {
      setDeletingMsg(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
        <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Lock size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Login Required</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            Please log in to your account to view your messages and communicate with sellers.
          </p>
          <Link 
            to="/login" 
            className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 flex flex-col">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col">
        
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 max-h-[80vh]">
          
          {!isConversationView ? (
            <>
              {/* Conversations List Header */}
              <div className="p-4 sm:p-6 border-b border-bordercol">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h1 className="font-display font-bold text-2xl text-textprimary">Messages</h1>
                  <div className="flex items-center gap-2">
                    {[
                      { key: 'all', label: 'All', Icon: MessageCircle },
                      { key: 'unread', label: 'Unread', Icon: MailOpen },
                      { key: 'spam', label: 'Spam', Icon: MailX },
                    ].map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                          filter === key
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface text-textsecondary border-bordercol hover:bg-bg'
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Conversations List Body */}
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-textmuted">
                    <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
                    <p>Loading messages...</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center">
                    <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-4">
                      <MessageCircle size={32} className="text-bordercol" />
                    </div>
                    <h3 className="font-display font-semibold text-xl text-textprimary mb-2">
                      {filter === 'unread' ? 'No unread messages' : filter === 'spam' ? 'No spam conversations' : 'No messages yet'}
                    </h3>
                    <p className="text-textsecondary">
                      {filter === 'unread' ? 'All caught up!' : filter === 'spam' ? 'Good, no spam here.' : 'Start a conversation from any car listing page.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-bordercol">
                    {filteredConversations.map((conv, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 sm:p-6 hover:bg-bg transition-colors"
                      >
                        <Link
                          to={`/messages/${conv.otherUser.id}/${conv.vehicle?.id}`}
                          className="flex items-center gap-4 flex-1 min-w-0"
                        >
                          <Avatar userId={conv.otherUser.id} name={conv.otherUser.name} size={48} />
                           <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-center mb-1">
                               <div className="flex items-center gap-2">
                                 <h4 className="font-medium text-textprimary truncate">{conv.otherUser.name}</h4>
                                 {conv.unreadCount > 0 && (
                                   <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full">
                                     {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                   </span>
                                 )}
                               </div>
                               <span className="text-xs text-textmuted flex-shrink-0 ml-2">
                                 {new Date(conv.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                               </span>
                             </div>
                            {conv.vehicle && (
                              <p className="text-xs font-medium text-primary mb-1 truncate">
                                {conv.vehicle.year} {conv.vehicle.make} {conv.vehicle.model}
                              </p>
                            )}
                            <p className="text-sm text-textsecondary truncate">
                              {conv.lastMessage}
                            </p>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteConversation(conv); }}
                          disabled={deletingConv === conv.vehicle?.id}
                          className="p-2 text-textmuted hover:text-err hover:bg-err/10 rounded-md transition-colors disabled:opacity-50"
                          title="Delete conversation"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="flex items-center gap-4 p-4 border-b border-bordercol bg-surface shadow-sm z-10">
                <Link to="/messages" className="p-2 -ml-2 text-textsecondary hover:text-primary transition-colors rounded-full hover:bg-bg">
                  <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-3">
                  <Avatar userId={Number(userId)} name={messages.find((m) => m.senderId === Number(userId))?.sender?.name || conversations.find((c) => c.otherUser?.id === Number(userId))?.otherUser?.name} size={40} />
                  <div>
                    <h2 className="font-medium text-textprimary line-clamp-1">
                      {messages.find((m) => m.senderId === Number(userId))?.sender?.name
                        || conversations.find((c) => c.otherUser?.id === Number(userId))?.otherUser?.name
                        || 'Conversation'}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-bg flex flex-col gap-4 custom-scrollbar">
                {/* Price negotiation surface for this vehicle */}
                <OfferPanel vehicleId={vehicleId} otherUserId={userId} />

                {loading ? (
                  <div className="flex justify-center py-10 text-textmuted">
                    <div className="animate-spin w-6 h-6 border-2 border-bordercol border-t-primary rounded-full"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-textmuted text-sm">
                    Send a message to start the conversation.
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.senderId === user.id;
                    return (
                      <div key={i} className={`flex flex-col max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                        <div className={`px-4 py-2.5 rounded-2xl ${
                          isMine 
                            ? 'bg-primary text-white rounded-br-sm' 
                            : 'bg-surface border border-bordercol text-textprimary rounded-bl-sm shadow-sm'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[11px] text-textmuted">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              disabled={deletingMsg === msg.id}
                              className="text-[11px] text-textmuted hover:text-err disabled:opacity-50 transition-colors"
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-surface border-t border-bordercol">
                <form onSubmit={sendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    // 16px on mobile prevents iOS Safari's auto-zoom on focus;
                    // compact 14px returns on sm+ screens.
                    className="flex-1 h-11 px-4 border border-bordercol rounded-full bg-bg text-base sm:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                  />
                  <button 
                    type="submit" 
                    disabled={sending || !newMessage.trim()}
                    className="w-11 h-11 flex-shrink-0 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primarylight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={18} className="ml-1" />
                  </button>
                </form>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Messages;
