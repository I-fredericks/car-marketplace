import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

import { Car } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Car size={24} className="logo-icon" /> CarMarket Ghana
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/search">Buy Cars</Link>
        <Link to="/sell" className="sell-btn">Sell Your Car</Link>
        
        {user ? (
          <div className="user-menu">
            <span>Hi, {user.name}</span>
            {user.role === 'ADMIN' && <Link to="/admin">Admin Panel</Link>}
            <button onClick={logout}>Logout</button>
          </div>
        ) : (
          <div className="auth-links">
            <Link to="/login">Login</Link>
            <Link to="/register" className="register-btn">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
