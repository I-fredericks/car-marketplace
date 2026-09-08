import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Slide-to-confirm control for irreversible order actions (receipt /
 * handover / cash-collection). A plain tap is one stray thumb away from
 * releasing escrowed money — dragging the thumb to the far end is a
 * deliberate gesture that also reads "advanced" on mobile.
 *
 * Keyboard / screen-node fallback: focusing the control and pressing
 * Enter fires the same action (the slider is decorative confirmation).
 */
const SlideToConfirm = ({ label, confirmLabel = 'Confirmed', onConfirm, busy = false, disabled = false }) => {
  const [progress, setProgress] = useState(0); // 0..1
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const trackRef = useRef(null);

  const applyFraction = useCallback((frac) => {
    const clamped = Math.max(0, Math.min(1, frac));
    setProgress(clamped);
    if (clamped >= 0.92 && !busy && !done) {
      setDone(true);
      setProgress(1);
      onConfirm();
    }
  }, [busy, done, onConfirm]);

  const moveFromEvent = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const handleWidth = 52;
    applyFraction((clientX - rect.left - handleWidth / 2) / (rect.width - handleWidth));
  }, [applyFraction]);

  const onPointerDown = (e) => {
    if (disabled || busy || done) return;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    moveFromEvent(e.clientX);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    moveFromEvent(e.clientX);
  };
  const onPointerUp = () => {
    setDragging(false);
    if (!done) setProgress(0); // snap back unless it reached the end
  };

  const THUMB = 52;
  const thumbOffset = `calc(${(progress * 100).toFixed(2)}% - ${(progress * (THUMB + 8)).toFixed(2)}px + 4px)`;

  return (
    <button
      type="button"
      ref={trackRef}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={() => { if (!done && !busy) { setDone(true); setProgress(1); onConfirm(); } }} // keyboard/click fallback
      aria-label={busy ? 'Confirming' : label}
      className={`relative w-full h-[52px] rounded-full overflow-hidden select-none touch-none transition-colors disabled:opacity-60 ${
        done ? 'bg-success/90' : 'bg-primary'
      }`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Fill follows the thumb */}
      <div
        className="absolute inset-y-0 left-0 bg-white/15"
        style={{ width: `${(progress * 100).toFixed(2)}%`, transition: dragging ? 'none' : 'width 0.25s ease' }}
      />

      {/* Hint text fades out as the thumb travels */}
      <span
        className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm tracking-wide pointer-events-none"
        style={{ opacity: done ? 1 : Math.max(0, 1 - progress * 1.6) }}
      >
        {busy ? (
          <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Confirming…</span>
        ) : done ? (
          <span className="flex items-center gap-2"><CheckCircle2 size={18} /> {confirmLabel}</span>
        ) : (
          label
        )}
      </span>

      {/* Thumb */}
      {!done && !busy && (
        <span
          className="absolute top-1 bottom-1 rounded-full bg-white text-primary flex items-center justify-center shadow-md pointer-events-none"
          style={{ left: thumbOffset, width: THUMB, transition: dragging ? 'none' : 'left 0.25s ease' }}
        >
          <ChevronRight size={22} />
        </span>
      )}
    </button>
  );
};

export default SlideToConfirm;
