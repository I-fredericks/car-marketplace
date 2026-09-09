import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Star, Loader2 } from 'lucide-react';
import StarRating from './StarRating';

/**
 * Inline review form shown on a completed order. One review per purchase,
 * buyer-only — the backend enforces both. Shows existing review if left.
 */
const ReviewForm = ({ purchaseId, sellerName, onReviewed }) => {
  const { user } = useContext(AuthContext);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/reviews/eligible');
      const found = data.reviewed.find((p) => p.id === parseInt(purchaseId, 10));
      if (found?.review) {
        // Fetch the full review from the seller's review list
        setExisting({ rating: 0, comment: null, ...found.review });
      }
    } catch {
      // best-effort — form still shows
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (stars < 1) {
      setError('Pick a star rating from 1 to 5.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/reviews', { purchaseId, rating: stars, comment: comment || undefined });
      setExisting(data.review);
      if (onReviewed) onReviewed();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (existing) {
    return (
      <div className="bg-success/5 border border-success/25 rounded-lg p-4 flex items-center gap-3">
        <StarRating value={existing.rating} size={18} />
        <p className="text-sm text-textprimary">
          <span className="font-medium">You reviewed this seller.</span>
          {existing.comment ? ` "${existing.comment}"` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-bordercol rounded-lg p-5 bg-surface">
      <h4 className="font-display font-semibold text-textprimary mb-1">Rate your experience with {sellerName}</h4>
      <p className="text-xs text-textmuted mb-4">
        Your review is verified — it's tied to this completed escrow transaction.
      </p>

      {/* Star picker */}
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStars(i + 1)}
            onMouseEnter={() => setHover(i + 1)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            aria-label={`${i + 1} star${i > 0 ? 's' : ''}`}
          >
            <Star
              size={28}
              className={(hover || stars) > i ? 'text-accent fill-accent transition-colors' : 'text-bordercol transition-colors'}
            />
          </button>
        ))}
        {stars > 0 && <span className="ml-2 text-sm font-bold text-textprimary">{stars}/5</span>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was the car? Was the seller honest about its condition? (optional)"
        rows={3}
        maxLength={1000}
        className="w-full p-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary resize-none mb-3"
      />

      {error && <p className="mb-2 text-sm text-err font-medium" role="alert">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || stars < 1}
        className="px-6 py-2.5 bg-primary text-white font-bold rounded-md text-sm hover:bg-primarylight disabled:opacity-50 flex items-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} className="fill-white" />}
        Submit review
      </button>
    </div>
  );
};

export default ReviewForm;
