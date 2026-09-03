import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Car, Heart, MessageCircle, Menu, X, User } from 'lucide-react';
import api from '../utils/api';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState(null);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Show the seller's current plan next to their name
  useEffect(() => {
    if (!user || user.role !== 'SELLER') return;
    api.get('/billing/status')
      .then(({ data }) => setBilling(data))
      .catch(() => {});
  }, [user]);

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <nav className={`fixed w-full top-0 z-50 transition-all duration-300 border-b ${scrolled ? 'bg-surface/95 backdrop-blur-md border-bordercol shadow-sm' : 'bg-surface border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Car size={28} className="text-primary" />
            <span className="font-display font-bold text-xl text-textprimary tracking-tight">
              CarMarket<span className="text-accent">Ghana</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/search" className="text-textsecondary hover:text-primary font-medium transition-colors">
              Buy Cars
            </Link>
            <Link to="/pricing" className="text-textsecondary hover:text-primary font-medium transition-colors">
              Pricing
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-4 ml-4">
                <Link to="/favorites" className="text-textsecondary hover:text-primary transition-colors" title="Saved">
                  <Heart size={20} />
                </Link>
                <Link to="/messages" className="text-textsecondary hover:text-primary transition-colors" title="Messages">
                  <MessageCircle size={20} />
                </Link>
                
                <div className="flex items-center gap-4 border-l border-bordercol pl-4">
                  <div className="text-sm">
                    <span className="text-textmuted block text-xs">Welcome</span>
                    <span className="font-medium text-textprimary">{user.name}</span>
                  </div>

                  {billing && (
                    <Link
                      to="/pricing"
                      title={`${billing.plan.label} plan — view pricing`}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                        billing.isSubscribed
                          ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                          : 'bg-bg border border-bordercol text-textmuted hover:border-primary hover:text-primary'
                      }`}
                    >
                      {billing.plan.label}
                    </Link>
                  )}
                  
                  <div className="flex gap-2">
                    {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                      <Link to="/seller/dashboard" className="px-3 py-1.5 text-sm font-medium border border-bordercol rounded-md text-textprimary hover:bg-bg transition-colors">
                        My Listings
                      </Link>
                    )}
                    {user.role === 'ADMIN' && (
                      <Link to="/admin" className="px-3 py-1.5 text-sm font-medium bg-primarylight text-white rounded-md hover:bg-primary transition-colors">
                        Admin
                      </Link>
                    )}
                    <button onClick={logout} className="px-3 py-1.5 text-sm font-medium text-err hover:bg-err/10 rounded-md transition-colors">
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 ml-4">
                <Link to="/login" className="px-4 py-2 font-medium text-textprimary hover:text-primary transition-colors">
                  Login
                </Link>
                <Link to="/register" className="px-4 py-2 font-medium border border-bordercol rounded-md text-textprimary hover:bg-bg transition-colors">
                  Register
                </Link>
              </div>
            )}
            
            <Link to="/sell" className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primarylight transition-colors shadow-sm">
              Sell Your Car
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={toggleMenu} className="text-textprimary p-2 focus:outline-none">
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-surface border-b border-bordercol shadow-lg absolute w-full left-0 top-16">
          <div className="px-4 py-5 space-y-4">
            <Link to="/search" className="block text-lg font-medium text-textprimary">Buy Cars</Link>
            <Link to="/pricing" className="block text-lg font-medium text-textprimary">Pricing</Link>
            
            {user ? (
              <div className="space-y-4 pt-4 border-t border-bordercol">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-medium text-textprimary">{user.name}</div>
                    <div className="text-sm text-textmuted capitalize">
                      {user.role}
                      {billing && (
                        <Link to="/pricing" className="ml-2 text-xs font-bold text-primary uppercase">
                          {billing.plan.label} plan
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                
                <Link to="/favorites" className="flex items-center gap-3 text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">
                  <Heart size={20} /> Saved Cars
                </Link>
                <Link to="/messages" className="flex items-center gap-3 text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">
                  <MessageCircle size={20} /> Messages
                </Link>
                
                {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                  <Link to="/seller/dashboard" className="block text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">My Listings</Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="block text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">Admin Panel</Link>
                )}
                <button onClick={logout} className="w-full text-left text-err font-medium p-2 -mx-2 rounded-md hover:bg-err/10">
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-bordercol">
                <Link to="/login" className="flex justify-center items-center py-2 border border-bordercol rounded-md text-textprimary font-medium">
                  Login
                </Link>
                <Link to="/register" className="flex justify-center items-center py-2 bg-primary/10 text-primary rounded-md font-medium">
                  Register
                </Link>
              </div>
            )}
            
            <Link to="/sell" className="block w-full text-center py-3 bg-accent text-primarydark font-bold rounded-md shadow-sm mt-4">
              Sell Your Car
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
