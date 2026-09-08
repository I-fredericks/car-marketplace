import React from 'react';

/**
 * Layout-stable placeholder for VehicleCard while a grid loads. Mirrors the
 * real card's skeleton (image aspect, title lines, price, chips, footer) so
 * the page doesn't jump when data lands — perceived load beats a spinner.
 */
const VehicleCardSkeleton = () => (
  <div className="bg-surface border border-bordercol rounded-xl overflow-hidden flex flex-col shadow-sm" aria-hidden="true">
    <div className="relative aspect-[4/3] bg-bg animate-pulse" />
    <div className="p-2.5 sm:p-4 md:p-5 flex flex-col gap-1.5 sm:gap-3 flex-1">
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-bg animate-pulse" />
        <div className="h-6 w-1/2 rounded bg-bg animate-pulse" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-bg animate-pulse" />
        <div className="h-5 w-12 rounded-full bg-bg animate-pulse" />
        <div className="h-5 w-14 rounded-full bg-bg animate-pulse" />
      </div>
      <div className="mt-auto pt-2 sm:pt-3 border-t border-bordercol flex items-center justify-between">
        <div className="h-3.5 w-24 rounded bg-bg animate-pulse" />
        <div className="h-3.5 w-16 rounded bg-bg animate-pulse" />
      </div>
    </div>
  </div>
);

/** Grid of N skeleton cards. `className` carries the caller's column spans —
 *  it's required because Tailwind resolves duplicate responsive utilities by
 *  stylesheet order, so the component ships no defaults of its own. */
const VehicleGridSkeleton = ({ count = 8, className = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' }) => (
  <div className={`grid gap-3 sm:gap-6 ${className}`}>
    {Array.from({ length: count }).map((_, i) => <VehicleCardSkeleton key={i} />)}
  </div>
);

export default VehicleGridSkeleton;
export { VehicleCardSkeleton };
