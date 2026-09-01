import React from 'react';
import { Link } from 'react-router-dom';
import { Car, Home } from 'lucide-react';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <div className="not-found-icon">
          <Car size={64} />
        </div>
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page or listing you are looking for might have been moved or doesn't exist.</p>
        <Link to="/" className="home-btn">
          <Home size={18} /> Back to Homepage
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
