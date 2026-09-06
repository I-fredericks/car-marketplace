import React, { useState } from 'react';

/**
 * Renders a user's approved profile photo with an initials fallback.
 *
 * The photo is served by GET /api/users/:id/avatar (public once APPROVED;
 * owners/admins also get their PENDING/REJECTED previews). A 404 — no photo,
 * or unapproved for this viewer — falls back to the name's first letter, so
 * every surface can simply drop this in and moderation stays intact.
 */
const Avatar = ({ userId, name = '', size = 40, version = '', className = '', fallbackClassName = 'bg-primary/10 border border-primary/20 text-primary' }) => {
  const [failedFor, setFailedFor] = useState(null);
  const cacheKey = `${userId}:${version}`;
  const failed = failedFor === cacheKey;
  const initials = (name || '?').trim().charAt(0).toUpperCase() || '?';

  const fallback = (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold ${fallbackClassName} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );

  if (!userId || failed) return fallback;

  const versionQuery = version ? `?v=${encodeURIComponent(version)}` : '';
  return (
    <img
      src={`/api/users/${userId}/avatar${versionQuery}`}
      alt={name ? `${name}'s profile` : 'Profile'}
      loading="lazy"
      decoding="async"
      onError={() => setFailedFor(cacheKey)}
      className={`flex-shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default Avatar;
