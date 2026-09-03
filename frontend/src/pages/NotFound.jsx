import React from 'react';
import { Link } from 'react-router-dom';
import { Car, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
      <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-err/10 rounded-full flex items-center justify-center mb-6">
          <Car size={40} className="text-err" />
        </div>
        <h1 className="font-display font-bold text-5xl text-primary mb-2">404</h1>
        <h2 className="font-display font-semibold text-2xl text-textprimary mb-4">Page Not Found</h2>
        <p className="text-textsecondary mb-8 leading-relaxed">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link 
          to="/" 
          className="w-full h-12 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} /> Return to Homepage
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
