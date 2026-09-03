import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, Heart, MessageCircle } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

/**
 * App-style bottom tab bar for mobile (like jiji.com).
 * Hidden on desktop. The Sell tab is the prominent center action.
 */
const BottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  const tab = (to, label, Icon, center = false) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${
          active ? 'text-primary' : 'text-textmuted'
        }`}
      >
        {center ? (
          <span className="w-11 h-11 -mt-5 rounded-full bg-accent text-primarydark shadow-lg flex items-center justify-center ring-4 ring-surface">
            <Icon size={24} />
          </span>
        ) : (
          <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        )}
        <span className={`text-[10px] ${center ? 'text-primary font-bold' : ''} ${active ? 'font-bold' : 'font-medium'}`}>
          {label}
        </span>
        {active && !center && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-bordercol h-16 flex items-stretch shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      {tab('/', 'Home', Home)}
      {tab('/search', 'Search', Search)}
      {tab('/sell', 'Sell', PlusCircle, true)}
      {tab('/favorites', 'Saved', Heart)}
      {tab(user ? '/messages' : '/login', 'Chats', MessageCircle)}
    </nav>
  );
};

export default BottomNav;
