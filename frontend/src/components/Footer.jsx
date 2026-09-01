import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer>
      <div className="footer-content">
        <div>
          <div className="footer-logo">CarMarket<span className="logo-accent">Ghana</span></div>
          <p>© 2025 CarMarket Ghana. All rights reserved.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/search">Buy Cars</Link></li>
            <li><Link to="/sell">Sell Your Car</Link></li>
            <li><Link to="/favorites">Saved Cars</Link></li>
            <li><Link to="/login">Login</Link></li>
          </ul>
        </div>
        <div>
          <h4>Popular Locations</h4>
          <ul>
            <li><Link to="/search?location=Accra">Accra</Link></li>
            <li><Link to="/search?location=Kumasi">Kumasi</Link></li>
            <li><Link to="/search?location=Takoradi">Takoradi</Link></li>
            <li><Link to="/search?location=Tamale">Tamale</Link></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-copyright">
        <p>CarMarket Ghana © {new Date().getFullYear()} | Buying and selling vehicles made simple</p>
      </div>
    </footer>
  );
};

export default Footer;
