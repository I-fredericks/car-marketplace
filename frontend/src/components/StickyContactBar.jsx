import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle } from 'lucide-react';

/**
 * Mobile-only sticky contact bar.
 * "Chat" opens the in-app messaging conversation with the seller
 * (falls back to /login when the visitor isn't signed in).
 */
const StickyContactBar = ({ phone, sellerUserId, vehicleId, isLoggedIn }) => {
  const navigate = useNavigate();

  const openChat = () => {
    if (!isLoggedIn) return navigate('/login');
    navigate(`/messages/${sellerUserId}/${vehicleId}`);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-bordercol p-4 flex gap-3 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <button
        className="flex-1 min-h-[44px] bg-primary text-white rounded-md flex items-center justify-center gap-2 font-display text-sm"
        onClick={() => phone && window.open(`tel:${phone}`)}
      >
        <Phone size={18} /> Call
      </button>
      <button
        className="flex-1 min-h-[44px] border border-primary text-primary rounded-md flex items-center justify-center gap-2 font-display text-sm font-medium"
        onClick={openChat}
        aria-label="Chat with seller in app"
      >
        <MessageCircle size={18} /> Chat
      </button>
    </div>
  );
};

export default StickyContactBar;
