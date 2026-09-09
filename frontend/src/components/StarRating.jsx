import React from 'react';
import { Star } from 'lucide-react';

/**
 * Display-only star rating. `size` controls icon pixels; shows a numeric
 * suffix when `showNumber` is true. Renders nothing when value is 0.
 */
const StarRating = ({ value = 0, size = 16, showNumber = false, className = '' }) => {
  if (!value || value <= 0) return null;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < full || (i === full && half) ? 'text-accent fill-accent' : 'text-bordercol'}
        />
      ))}
      {showNumber && <span className="ml-1 text-xs font-bold text-textsecondary">{value.toFixed(1)}</span>}
    </span>
  );
};

export default StarRating;
