import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import api from '../utils/api';
import { MessageCircle, Bell, X } from 'lucide-react';

/**
 * Realtime layer: one SSE connection per logged-in user.
 * - 'message:new'      -> live chat append (subscribers, e.g. Messages page)
 * - 'notification:new' -> unread badge + toast (source of truth: DB rows)
 */
const EventContext = createContext(null);

export const useEvents = () => useContext(EventContext);

const MAX_TOASTS = 3;

export const EventProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  // Split for navbar surfaces: the Messages icon badge uses `messages`, the
  // bell uses `system` (everything else: listings, moderation, billing, ...).
  const [unreadSplit, setUnreadSplit] = useState({ messages: 0, system: 0 });
  const [toasts, setToasts] = useState([]);
  const activeConversationRef = useRef(null);
  const subscribersRef = useRef(new Set());
  const esRef = useRef(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications');
      const total = data.unreadCount || 0;
      const messages = (data.notifications || []).filter(
        (n) => !n.readAt && n.type === 'NEW_MESSAGE'
      ).length;
      setUnread(total);
      setUnreadSplit({ messages, system: Math.max(0, total - messages) });
    } catch (_) { /* badge is non-critical */ }
  }, [user]);

  // Register/unregister the open conversation so notifications for the chat
  // the user is currently looking at don't toast or count as unread.
  const setActiveConversation = useCallback((conv) => {
    activeConversationRef.current = conv;
  }, []);

  const subscribeToMessages = useCallback((cb) => {
    subscribersRef.current.add(cb);
    return () => subscribersRef.current.delete(cb);
  }, []);

  const pushToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Mark every NEW_MESSAGE notification of a conversation read
  const markConversationRead = useCallback(async (senderId, vehicleId) => {
    try {
      await api.put(`/messages/${senderId}/${vehicleId}/read`);
      refreshUnread();
    } catch (_) { /* non-critical */ }
  }, [refreshUnread]);

  // Open the SSE stream whenever a user is signed in
  useEffect(() => {
    if (!user) {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
      setUnread(0);
      setUnreadSplit({ messages: 0, system: 0 });
      setToasts([]);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.addEventListener('connected', () => setConnected(true));
    es.onerror = () => setConnected(false);

    // Live chat delivery — subscribers decide relevance (append vs ignore)
    es.addEventListener('message:new', (e) => {
      try {
        const msg = JSON.parse(e.data);
        subscribersRef.current.forEach((cb) => cb(msg));
      } catch (_) { /* malformed frame */ }
    });

    // Badge + toast — DB count is the source of truth
    es.addEventListener('notification:new', (e) => {
      try {
        const n = JSON.parse(e.data);
        refreshUnread();

        const active = activeConversationRef.current;
        const isOpenChat = n.type === 'NEW_MESSAGE'
          && active
          && n.data?.senderId === active.userId
          && n.data?.vehicleId === active.vehicleId;
        if (isOpenChat) return;

        pushToast({
          title: n.title,
          body: n.body,
          path: n.data?.path || '/messages',
          kind: n.type === 'NEW_MESSAGE' ? 'message' : 'system',
        });
      } catch (_) { /* malformed frame */ }
    });

    refreshUnread();

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [user?.id, refreshUnread, pushToast]);

  const value = {
    connected,
    unread,
    unreadMessages: unreadSplit.messages,
    unreadSystem: unreadSplit.system,
    refreshUnread,
    setActiveConversation,
    subscribeToMessages,
    markConversationRead,
    pushToast,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => { navigate(t.path); dismissToast(t.id); }}
            className="bg-surface border border-bordercol rounded-xl shadow-lg p-4 cursor-pointer hover:border-primary transition-colors flex items-start gap-3 animate-[slideIn_.2s_ease-out]"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
              {t.kind === 'message' ? <MessageCircle size={18} /> : <Bell size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-textprimary truncate">{t.title}</p>
              {t.body && <p className="text-xs text-textsecondary truncate">{t.body}</p>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}
              className="text-textmuted hover:text-textprimary flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </EventContext.Provider>
  );
};
