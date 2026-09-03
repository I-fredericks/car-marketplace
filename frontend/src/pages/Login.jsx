import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Car } from 'lucide-react';

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-md w-full bg-surface border border-bordercol rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Car size={24} className="text-primary" />
          </div>
          <h2 className="font-display font-bold text-3xl text-textprimary mb-2">Welcome Back</h2>
          <p className="text-textsecondary text-center">Sign in to your CarMarket Ghana account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
              className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-textprimary">Password</label>
              <a href="#" className="text-xs font-medium text-primary hover:text-primarylight">Forgot password?</a>
            </div>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter your password"
              required
              className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-textsecondary">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:text-primarylight transition-colors">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
