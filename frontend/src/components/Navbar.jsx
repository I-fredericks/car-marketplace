import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import { Car, Heart, MessageCircle, Menu, X, User, Package, ChevronDown, LayoutDashboard, ShieldCheck, List, LogOut } from 'lucide-react';
import useBillingStatus from '../hooks/useBillingStatus';
import Avatar from './Avatar';
import NotificationsDropdown from './NotificationsDropdown';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { unreadMessages } = useEvents();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { data: billing } = useBillingStatus();
  const location = useLocation();
  const userMenuRef = useRef(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location]);

  // Close the user dropdown on outside click / Escape
  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setIsUserMenuOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setIsUserMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
                <Link to="/favorites" className="text-textsecondary hover:text-primary transition-colors" title="Saved" aria-label="Saved cars">
                  <Heart size={20} />
                </Link>
                 <NotificationsDropdown />
                 <Link to="/messages" className="relative text-textsecondary hover:text-primary transition-colors" title="Messages" aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}>
                   <MessageCircle size={20} />
                   {unreadMessages > 0 && (
                     <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-err text-white text-[10px] font-bold rounded-full">
                       {unreadMessages > 99 ? '99+' : unreadMessages}
                     </span>
                   )}
                 </Link>
                
                 <div className="relative flex items-center border-l border-bordercol pl-4" ref={userMenuRef}>
                  {/* Account menu: identity trigger + dropdown, standard app pattern */}
                  <button
                    onClick={() => setIsUserMenuOpen((o) => !o)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-lg hover:bg-bg transition-colors"
                  >
                    <Avatar userId={user.id} name={user.name} size={32} version={user.updatedAt} />
                    <div className="text-left leading-tight hidden lg:block">
                      <div className="text-[13px] font-semibold text-textprimary truncate max-w-[120px]">{user.name}</div>
                      <div className="text-[11px] text-textmuted">
                        {user.role === 'ADMIN' ? 'Administrator' : billing ? `${billing.plan.label} plan` : 'Buyer'}
                      </div>
                    </div>
                    <ChevronDown size={15} className={`text-textmuted transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-60 bg-surface border border-bordercol rounded-xl shadow-lg py-2 z-50">
                      <div className="px-4 py-2.5 sm:hidden">
                        <div className="text-sm font-semibold text-textprimary truncate">{user.name}</div>
                        <div className="text-xs text-textmuted truncate">{user.email}</div>
                      </div>

                      <Link to="/profile" role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textprimary hover:bg-bg transition-colors">
                        <User size={16} className="text-textmuted" /> Profile
                      </Link>
                      <Link to="/purchases" role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textprimary hover:bg-bg transition-colors">
                        <Package size={16} className="text-textmuted" /> My Purchases
                      </Link>
                      {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                        <Link to="/seller/dashboard" role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm text-textprimary hover:bg-bg transition-colors">
                          <List size={16} className="text-textmuted" /> My Listings
                        </Link>
                      )}
                      {user.role === 'ADMIN' && (
                        <Link to="/admin" role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
                          <LayoutDashboard size={16} /> Admin Panel
                        </Link>
                      )}
                      {user.sellerProfile?.verified && (
                        <div className="flex items-center gap-3 px-4 py-2 text-xs text-success">
                          <ShieldCheck size={15} /> Verified Seller
                        </div>
                      )}

                      <div className="border-t border-bordercol mt-2 pt-2">
                        <button onClick={logout} role="menuitem" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-err hover:bg-err/5 transition-colors">
                          <LogOut size={16} /> Logout
                        </button>
                      </div>
                    </div>
                  )}
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
            
            <Link
              to={user && user.role === 'BUYER' ? '/become-seller' : '/sell'}
              className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primarylight transition-colors shadow-sm"
            >
              Sell Your Car
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-1">
            {user && <NotificationsDropdown />}
            <button onClick={toggleMenu} aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMobileMenuOpen} className="text-textprimary p-2 focus:outline-none">
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
                  <Avatar userId={user.id} name={user.name} size={40} version={user.updatedAt} />
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
                 <Link to="/profile" className="flex items-center gap-3 text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">
                   <User size={20} /> Profile
                 </Link>
                 <Link to="/messages" className="flex items-center gap-3 text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">
                   <span className="relative">
                     <MessageCircle size={20} />
                     {unreadMessages > 0 && (
                       <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-err text-white text-[10px] font-bold rounded-full">
                         {unreadMessages > 99 ? '99+' : unreadMessages}
                       </span>
                     )}
                   </span>
                   Messages
                 </Link>

                 <Link to="/purchases" className="flex items-center gap-3 text-textsecondary p-2 -mx-2 rounded-md hover:bg-bg">
                   <Package size={20} /> My Purchases
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
            
            <Link
              to={user && user.role === 'BUYER' ? '/become-seller' : '/sell'}
              className="block w-full text-center py-3 bg-accent text-primarydark font-bold rounded-md shadow-sm mt-4"
            >
              Sell Your Car
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
