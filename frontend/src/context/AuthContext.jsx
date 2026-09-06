import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on app load
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        console.error("Token invalid or expired");
        localStorage.removeItem('token');
      }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user); // Initial basic user info
    // Fetch full profile to get seller context if any
    const profile = await api.get('/auth/me');
    setUser(profile.data);
  };

  const loginWithGoogle = async (credential, role, sellerType) => {
    const { data } = await api.post('/auth/google', { credential, role, sellerType });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const profile = await api.get('/auth/me');
    setUser(profile.data);
    return profile.data;
  };

  // Upgrade the logged-in buyer to a seller account; the backend returns a
  // fresh token carrying the new role
  const upgradeToSeller = async (details) => {
    const { data } = await api.put('/auth/upgrade', details);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const profile = await api.get('/auth/me');
    setUser(profile.data);
    return profile.data;
  };

  const updateProfile = async (details) => {
    const { data } = await api.put('/auth/profile', details);
    setUser(data.user);
    if (data.sellerProfile) {
      setUser(prev => ({ ...prev, sellerProfile: data.sellerProfile }));
    }
    return data.user;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    // Automatically log in after registration could be done here, 
    // but typically we just return success
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, loginWithGoogle, register, upgradeToSeller, updateProfile, logout, loading }}>
      {/* Render children immediately: gating on `loading` blanks the whole
          app for every visitor until /auth/me resolves. Protected pages
          consume `loading` themselves to avoid flashing login prompts. */}
      {children}
    </AuthContext.Provider>
  );
};
