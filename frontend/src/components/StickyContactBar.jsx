import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, ShoppingCart } from 'lucide-react';

/**
 * Mobile-only sticky action bar.
 * Buy Now takes buyers into the escrow checkout; "Chat" opens the in-app
 * messaging conversation (both fall back to /login when signed out).
 */
const StickyContactBar = ({ phone, sellerUserId, vehicleId, isLoggedIn, canBuy = false }) => {
  const navigate = useNavigate();

  const openChat = () => {
    if (!isLoggedIn) return navigate('/login');
    navigate(`/messages/${sellerUserId}/${vehicleId}`);
  };

  const buyNow = () => {
    if (!isLoggedIn) return navigate('/login');
    navigate(`/checkout/${vehicleId}`);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-bordercol p-3 flex gap-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {canBuy && (
        <button
          onClick={buyNow}
          className="flex-[1.4] min-h-[44px] bg-accent text-textprimary rounded-md flex items-center justify-center gap-2 font-bold text-sm"
          aria-label="Buy this car via secure escrow"
        >
          <ShoppingCart size={18} /> Buy Now
        </button>
      )}
      {/* Native tel: link — same-tab handoff to the dialer. window.open()
          was leaving a dead blank tab behind on mobile browsers. */}
      <a
        href={phone ? `tel:${phone}` : undefined}
        onClick={(e) => !phone && e.preventDefault()}
        className={`${canBuy ? 'flex-1' : 'flex-1'} min-h-[44px] ${canBuy ? 'border border-primary text-primary' : 'bg-primary text-white'} rounded-md flex items-center justify-center gap-2 font-display text-sm`}
      >
        <Phone size={18} /> Call
      </a>
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
