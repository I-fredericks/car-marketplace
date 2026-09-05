import React from 'react';
import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-surface border-t border-bordercol pt-14 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand Column */}
          <div className="flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-2 mb-2">
              <Car size={28} className="text-primary" />
              <span className="font-display font-bold text-xl text-textprimary tracking-tight">
                CarMarket<span className="text-accent">Ghana</span>
              </span>
            </Link>
            <p className="text-textsecondary text-sm leading-relaxed">
              Ghana's most trusted marketplace for buying and selling quality vehicles. 
              Find your next car with confidence or sell your current one easily.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-lg text-textprimary mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li><Link to="/search" className="text-textsecondary hover:text-primary transition-colors text-sm">Buy Cars</Link></li>
              <li><Link to="/sell" className="text-textsecondary hover:text-primary transition-colors text-sm">Sell Your Car</Link></li>
              <li><Link to="/favorites" className="text-textsecondary hover:text-primary transition-colors text-sm">Saved Cars</Link></li>
              <li><Link to="/login" className="text-textsecondary hover:text-primary transition-colors text-sm">Login / Register</Link></li>
            </ul>
          </div>

          {/* Popular Locations */}
          <div>
            <h4 className="font-display font-semibold text-lg text-textprimary mb-4">Popular Locations</h4>
            <ul className="space-y-3">
              <li><Link to="/search?location=Accra" className="text-textsecondary hover:text-primary transition-colors text-sm">Accra</Link></li>
              <li><Link to="/search?location=Kumasi" className="text-textsecondary hover:text-primary transition-colors text-sm">Kumasi</Link></li>
              <li><Link to="/search?location=Takoradi" className="text-textsecondary hover:text-primary transition-colors text-sm">Takoradi</Link></li>
              <li><Link to="/search?location=Tamale" className="text-textsecondary hover:text-primary transition-colors text-sm">Tamale</Link></li>
            </ul>
          </div>

          {/* Legal / Contact */}
          <div>
            <h4 className="font-display font-semibold text-lg text-textprimary mb-4">Support & Legal</h4>
            <ul className="space-y-3">
              <li><a href="mailto:support@carmarket.com.gh" className="text-textsecondary hover:text-primary transition-colors text-sm">Help Center</a></li>
              <li><Link to="/privacy" className="text-textsecondary hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-textsecondary hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
              <li><a href="mailto:support@carmarket.com.gh" className="text-textsecondary hover:text-primary transition-colors text-sm">Contact Us</a></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-bordercol flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-textmuted text-sm text-center md:text-left">
            © {new Date().getFullYear()} CarMarket Ghana. All rights reserved.
          </p>
          <div className="text-textmuted text-sm">
            Buying and selling vehicles made simple.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
