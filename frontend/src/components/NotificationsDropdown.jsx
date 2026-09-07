import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, CheckCheck } from 'lucide-react';
import api from '../utils/api';
import { useEvents } from '../context/EventContext';

/**
 * Bell with an unread badge + dropdown listing recent notifications.
 * New ones arrive live over SSE (EventContext toasts independently); this
 * panel is the persistent place to read them and mark them handled.
 */
const NotificationsDropdown = () => {
  const { unreadSystem, refreshUnread } = useEvents();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setItems((data.notifications || []).slice(0, 20));
    } catch { /* panel is non-critical */ }
    finally { setLoading(false); }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const openItem = async (n) => {
    if (!n.readAt) {
      api.put(`/notifications/${n.id}/read`).then(refreshUnread).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.data?.path) navigate(n.data.path);
    else if (n.type === 'NEW_MESSAGE' && n.data?.senderId != null && n.data?.vehicleId != null) {
      navigate(`/messages/${n.data.senderId}/${n.data.vehicleId}`);
    }
    setOpen(false);
  };

  const markAll = async () => {
    try { await api.put('/notifications/read-all'); } catch { /* ignore */ }
    refreshUnread();
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={toggle}
        className="relative p-2 text-textsecondary hover:text-primary transition-colors"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadSystem > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-err text-white text-[10px] font-bold rounded-full">
            {unreadSystem > 99 ? '99+' : unreadSystem}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-86 sm:w-96 max-w-[calc(100vw-2rem)] bg-surface border border-bordercol rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-bordercol">
            <h3 className="font-display font-semibold text-textprimary">Notifications</h3>
            {items.some((n) => !n.readAt) && (
              <button onClick={markAll} className="text-xs text-primary hover:text-primarylight font-medium flex items-center gap-1">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-bordercol">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin w-6 h-6 border-4 border-bordercol border-t-primary rounded-full"></div>
              </div>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-textmuted">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}
                >
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    {n.type === 'NEW_MESSAGE' ? <MessageCircle size={15} /> : <Bell size={15} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-textprimary truncate">{n.title}</span>
                    {n.body && <span className="block text-xs text-textsecondary truncate">{n.body}</span>}
                    <span className="block text-[10px] text-textmuted mt-0.5">{new Date(n.createdAt).toLocaleString()}</span>
                  </span>
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
