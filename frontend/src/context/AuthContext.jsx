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
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
