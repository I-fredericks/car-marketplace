import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

import { Car, Heart, MessageCircle, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Handle scroll effect for glassmorphism
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <Car size={28} className="logo-icon" />
            <span>CarMarket<span className="logo-accent">Ghana</span></span>
          </Link>
        </div>

        <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle navigation">
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        <div className={`navbar-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link to="/search" className="nav-link">Buy Cars</Link>
          <Link to="/sell" className="sell-btn">Sell Your Car</Link>

          {user ? (
            <div className="user-menu">
              <span className="user-greeting">Hi, {user.name}</span>
              <Link to="/messages" className="nav-icon-link"><MessageCircle size={18} /> <span className="mobile-text">Messages</span></Link>
              <Link to="/favorites" className="nav-icon-link"><Heart size={18} /> <span className="mobile-text">Saved</span></Link>
              {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                <Link to="/seller/dashboard" className="nav-link">My Listings</Link>
              )}
              {user.role === 'ADMIN' && <Link to="/admin" className="nav-link">Admin Panel</Link>}
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="login-btn">Login</Link>
              <Link to="/register" className="register-btn">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
