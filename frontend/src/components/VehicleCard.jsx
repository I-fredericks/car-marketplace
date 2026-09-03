import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import Badge from './Badge';

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
    <div className="bg-surface border border-bordercol rounded-lg overflow-hidden flex flex-col transition-transform hover:-translate-y-1 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] group">
      <Link to={`/car/${id}`} className="block relative aspect-[4/3] overflow-hidden bg-bg">
        {/* Placeholder if no image */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-textmuted">
            No Image
          </div>
        )}
        
        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {badge && (
            <Badge type={badge.toLowerCase() === 'featured' ? 'accent' : 'success'}>
              {badge}
            </Badge>
          )}
          {condition && (
            <span className="hidden md:inline-block px-2 py-1 bg-surface/90 backdrop-blur-sm text-textprimary text-xs font-semibold rounded-md border border-bordercol/50">
              {condition}
            </span>
          )}
        </div>
      </Link>
      
      <div className="p-4 flex flex-col flex-1">
        <Link to={`/car/${id}`} className="block mb-1">
          <h3 className="font-display font-semibold text-lg text-primary truncate" title={title}>
            {title}
          </h3>
        </Link>
        <div className="font-display font-bold text-xl text-textprimary mb-3">
          {typeof price === 'number' ? `GH₵ ${price.toLocaleString()}` : price}
        </div>
        
        {/* Basic Specs */}
        {specs.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-textsecondary mb-4 pb-4 border-b border-bordercol">
            {specs.slice(0, 3).map((spec, i) => (
              <React.Fragment key={i}>
                <span>{spec}</span>
                {i < Math.min(specs.length, 3) - 1 && <span className="w-1 h-1 rounded-full bg-bordercol"></span>}
              </React.Fragment>
            ))}
          </div>
        )}
        
        {/* Footer: Location & Seller */}
        <div className="mt-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-textmuted">
            <MapPin size={14} />
            <span className="truncate max-w-[100px]">{location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-textsecondary font-medium min-w-0">
            <span className="truncate max-w-[80px]">{sellerName}</span>
            {verified && <ShieldCheck size={14} className="text-success flex-shrink-0" title="Verified Seller" />}
            {sellerPlanBadge && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-accent/15 text-accentdark" title="Paid plan seller">
                {sellerPlanBadge}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
