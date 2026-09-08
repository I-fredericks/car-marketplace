import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Handshake, Check, X, ArrowLeftRight, Loader2, TrendingDown, ShieldCheck } from 'lucide-react';

/**
 * In-chat price negotiation panel. Buyers open with an offer below asking;
 * the seller accepts, declines, or counters. Counter-offers from the seller
 * require an active subscription (the plan-upgrade lever). Once accepted,
 * THAT amount binds the buyer's checkout price for this vehicle only.
 */
const OfferPanel = ({ vehicleId, otherUserId }) => {
  const { user } = useContext(AuthContext);
  const [thread, setThread] = useState(null);
  const [offerInput, setOfferInput] = useState('');
  const [busy, setBusy] = useState(null); // 'offer' | 'accept' | 'decline' | 'counter'
  const [error, setError] = useState('');
  const [countering, setCountering] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/offers?vehicleId=${vehicleId}&withUserId=${otherUserId}`);
      setThread(data);
    } catch {
      // Negotiation panel hides itself when the thread can't be resolved
    } finally {
      setLoading(false);
    }
  }, [vehicleId, otherUserId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (fn, tag) => {
    setError('');
    setBusy(tag);
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const makeOffer = () => {
    const cedis = parseFloat(offerInput);
    if (!Number.isFinite(cedis) || cedis <= 0) {
      setError('Enter your offer in cedis — e.g. 75000');
      return;
    }
    submit(() => api.post('/offers', { vehicleId, amount: Math.round(cedis * 100) }), 'offer')
      .then((ok) => { if (ok) setOfferInput(''); });
  };

  const respond = (offerId, action, amount) =>
    submit(() => api.post(`/offers/${offerId}/respond`, { action, amount }), action);

  if (loading || !thread) return null;

  const { live, acceptedPrice, offers, vehicle } = thread;
  const ghs = (p) => `GH₵${(p / 100).toLocaleString()}`;
  const isSeller = user && vehicle?.seller?.user?.id === user.id;
  const asking = vehicle ? Math.round(vehicle.price * 100) : null;
  const liveSitsWithMe = live && (
    (live.proposedBy === 'SELLER' && !isSeller) || (live.proposedBy === 'BUYER' && isSeller)
  );

  return (
    <div className="border border-primary/20 bg-primary/[0.04] rounded-xl p-4 mb-4">
      {/* Agreed price lock */}
      {acceptedPrice && !live && (
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-textprimary text-sm">
              Price agreed: {ghs(acceptedPrice)}
            </p>
            <p className="text-xs text-textsecondary mt-0.5">
              {isSeller
                ? 'Waiting for the buyer to check out at this price.'
                : 'This price is locked for you — tap Buy Now to complete it.'}
            </p>
            {!isSeller && (
              <Link
                to={`/checkout/${vehicleId}`}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent text-textprimary font-bold rounded-md text-sm hover:bg-accentdark transition-colors"
              >
                Buy Now at {ghs(acceptedPrice)}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Live offer, sitting with me: act on it */}
      {live && liveSitsWithMe && (
        <div>
          <div className="flex items-start gap-3">
            <TrendingDown size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-textprimary text-sm">
                {live.proposedBy === 'BUYER'
                  ? `They offer ${ghs(live.amount)}`
                  : `They counter-offer ${ghs(live.amount)}`}
              </p>
              {asking && <p className="text-xs text-textmuted mt-0.5">Asking price: {ghs(asking)}</p>}
            </div>
          </div>

          {!countering ? (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => respond(live.id, 'accept')}
                disabled={Boolean(busy)}
                className="flex-1 min-w-24 py-2 bg-success text-white font-bold rounded-md text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {busy === 'accept' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
              </button>
              <button
                onClick={() => setCountering(true)}
                disabled={Boolean(busy)}
                className="flex-1 min-w-24 py-2 bg-primary text-white font-bold rounded-md text-sm hover:bg-primarylight disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <ArrowLeftRight size={14} /> Counter
              </button>
              <button
                onClick={() => respond(live.id, 'decline')}
                disabled={Boolean(busy)}
                className="flex-1 min-w-24 py-2 border border-bordercol text-err font-medium rounded-md text-sm hover:bg-err/5 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {busy === 'decline' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <label className="block text-xs font-medium text-textsecondary mb-1">Your counter-offer (cedis)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  placeholder={asking ? String(asking / 100 - 5000) : ''}
                  className="flex-1 h-10 px-3 border border-bordercol rounded-md bg-surface text-base sm:text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    const cedis = parseFloat(offerInput);
                    if (!Number.isFinite(cedis) || cedis <= 0) return;
                    respond(live.id, 'counter', Math.round(cedis * 100)).then((ok) => {
                      if (ok) { setCountering(false); setOfferInput(''); }
                    });
                  }}
                  disabled={Boolean(busy)}
                  className="px-4 h-10 bg-primary text-white font-bold rounded-md text-sm disabled:opacity-50"
                >
                  {busy === 'counter' ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live offer waits on the other side */}
      {live && !liveSitsWithMe && (
        <div className="flex items-start gap-3">
          <Handshake size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-textsecondary">
            Your offer of{' '}
            <span className="font-bold text-textprimary">{ghs(live.amount)}</span>{' '}
            is with {isSeller ? 'the buyer' : 'the seller'} — waiting for a response.
          </p>
        </div>
      )}

      {/* No live offer: buyer can open one */}
      {!live && !acceptedPrice && !isSeller && (
        <div>
          <p className="text-sm text-textsecondary mb-2">
            Want a better price than {asking ? ghs(asking) : 'asking'}?
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={offerInput}
              onChange={(e) => setOfferInput(e.target.value)}
              placeholder="Your offer in GH₵"
              className="flex-1 h-10 px-3 border border-bordercol rounded-md bg-surface text-base sm:text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={makeOffer}
              disabled={busy === 'offer'}
              className="px-4 h-10 bg-accent text-textprimary font-bold rounded-md text-sm hover:bg-accentdark disabled:opacity-50 flex items-center gap-2"
            >
              {busy === 'offer' ? <Loader2 size={14} className="animate-spin" /> : <Handshake size={15} />} Offer
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-err font-medium" role="alert">{error}</p>}

      {/* History strip (compact) */}
      {offers.length > 1 && (
        <p className="mt-3 text-[11px] text-textmuted">
          Negotiation: {offers.map((o) => `${o.proposedBy.toLowerCase()} ${ghs(o.amount)}`).join(' → ')}
        </p>
      )}
    </div>
  );
};

export default OfferPanel;
