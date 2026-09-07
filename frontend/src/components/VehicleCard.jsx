import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, SlidersHorizontal, Fuel, Gauge } from 'lucide-react';
import Badge from './Badge';
import Avatar from './Avatar';

const SPEC_ICONS = [SlidersHorizontal, Fuel, Gauge];

/**
 * Listing card used across Home / Search / Favorites.
 * Mobile-first compact layout (2-col phone grids), full styling from sm up:
 * frosted condition chip, gradient image overlay, spec icon chips, clearer
 * price hierarchy, seller identity with avatar chip.
 */
const VehicleCard = ({
  id,
  title,
  price,
  location,
  condition,
  specs = [],
  sellerName,
  verified,
  badge,
  sellerPlanBadge,
  imageUrl
}) => {
  return (
    <div className="group bg-surface border border-bordercol rounded-xl overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-16px_rgba(27,42,74,0.35)] hover:border-primary/30 focus-within:ring-2 ring-primary/30">
      <Link
        to={`/car/${id}`}
        className="block relative aspect-[4/3] overflow-hidden bg-bg outline-none"
        aria-label={`View details for ${title}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-textmuted">
            <SlidersHorizontal size={22} className="opacity-60" />
            <span className="text-[10px] sm:text-xs font-medium">No Image</span>
          </div>
        )}

        {/* Readability gradient over the image bottom */}
        <div className="absolute inset-x-0 bottom-0 h-12 sm:h-16 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />

        {/* Featured / status badge — top left */}
        {badge && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1.5 sm:gap-2">
            <Badge type={badge.toLowerCase() === 'featured' ? 'accent' : 'success'}>
              {badge}
            </Badge>
          </div>
        )}

        {/* Condition chip floats above the gradient */}
        {condition && (
          <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-white/90 text-[#1B2A4A] text-[9px] sm:text-[11px] font-bold rounded-md shadow-sm backdrop-blur-sm">
            {condition}
          </span>
        )}
      </Link>

      <div className="p-2.5 sm:p-4 md:p-5 flex flex-col gap-1.5 sm:gap-3 flex-1">
        <div>
          <Link to={`/car/${id}`} className="block">
            <h3 className="font-display font-semibold text-sm sm:text-lg leading-snug text-textprimary truncate group-hover:text-primary transition-colors" title={title}>
              {title}
            </h3>
          </Link>
          <div className="font-display font-bold text-lg sm:text-2xl text-primary tracking-tight mt-0.5 sm:mt-1">
            {typeof price === 'number' ? `GH₵ ${price.toLocaleString()}` : price}
          </div>
        </div>

        {/* Spec chips (kept minimal on phones) */}
        {specs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {specs.slice(0, 3).map((spec, i) => {
              const Icon = SPEC_ICONS[i];
              return (
                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-bg rounded-full text-[9px] sm:text-[11px] font-medium text-textsecondary border border-bordercol/60">
                  {Icon && <Icon size={11} className="text-textmuted" />}
                  {spec}
                </span>
              );
            })}
          </div>
        )}

        {/* Footer: location + seller, anchored to the card bottom */}
        <div className="mt-auto pt-2 sm:pt-3 border-t border-bordercol flex items-center justify-between gap-2 text-[11px] sm:text-xs">
          <span className="inline-flex items-center gap-1 text-textmuted min-w-0">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{location}</span>
          </span>
          <span className="inline-flex items-center gap-1 sm:gap-1.5 text-textsecondary font-medium min-w-0">
            <Avatar name={sellerName} size={18} className="flex-shrink-0 hidden min-[420px]:block" />
            <span className="truncate max-w-[64px] sm:max-w-[90px]">{sellerName}</span>
            {verified && <ShieldCheck size={13} className="text-success flex-shrink-0" title="Verified Seller" />}
            {sellerPlanBadge && (
              <span className="hidden sm:inline-flex flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded bg-accent/15 text-accentdark" title="Paid plan seller">
                {sellerPlanBadge}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
