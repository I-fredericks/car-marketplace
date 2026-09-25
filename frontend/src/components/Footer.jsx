import React from 'react';
import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';

// Deep-navy footer: grounds the (otherwise white) page and gives the brand
// block real contrast. On mobile the three link columns collapse into a
// compact 2-column grid so the footer never eats a full screen.
const Footer = () => {
  const heading = 'font-display font-semibold text-lg text-white mb-3 sm:mb-4';
  const link = 'text-white/70 hover:text-accent transition-colors text-sm';

  return (
    <footer className="bg-primary mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6 sm:pt-14 sm:pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10 mb-8 sm:mb-12">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-2 mb-1 sm:mb-2">
              <Car size={28} className="text-accent" />
              <span className="font-display font-bold text-xl text-white tracking-tight">
                Sika<span className="text-accent">Ride</span>
              </span>
            </Link>
            <p className="text-white/70 text-sm leading-relaxed">
              Ghana's most trusted marketplace for buying and selling quality vehicles.
              Find your next car with confidence or sell your current one easily.
            </p>
          </div>

          {/* Popular Locations */}
          <div>
            <h4 className={heading}>Popular Locations</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><Link to="/search?location=Accra" className={link}>Accra</Link></li>
              <li><Link to="/search?location=Kumasi" className={link}>Kumasi</Link></li>
              <li><Link to="/search?location=Takoradi" className={link}>Takoradi</Link></li>
              <li><Link to="/search?location=Tamale" className={link}>Tamale</Link></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className={heading}>Quick Links</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><Link to="/buyer-protection" className={link}>Buyer Protection</Link></li>
              <li><Link to="/search" className={link}>Buy Cars</Link></li>
              <li><Link to="/sell" className={link}>Sell Your Car</Link></li>
              <li><Link to="/favorites" className={link}>Saved Cars</Link></li>
              <li><Link to="/login" className={link}>Login / Register</Link></li>
            </ul>
          </div>

          {/* Legal / Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className={heading}>Support & Legal</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><a href="mailto:support@sikaride.com" className={link}>Help Center</a></li>
              <li><Link to="/privacy" className={link}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={link}>Terms of Service</Link></li>
              <li><a href="mailto:support@sikaride.com" className={link}>Contact Us</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 sm:pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-white/60 text-sm text-center md:text-left">
            © {new Date().getFullYear()} SikaRide. All rights reserved.
          </p>
          <div className="text-white/60 text-sm">
            Buying and selling vehicles made simple.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
