import React, { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Car, MailCheck } from 'lucide-react';
import GoogleButton from '../components/GoogleButton';

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = location.state?.registeredEmail || '';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set when the backend blocks sign-in due to an unconfirmed email
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setResendMsg('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.emailNotVerified) {
        setUnverifiedEmail(form.email);
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      const { data } = await api.post('/auth/resend-verification', { email: unverifiedEmail });
      setResendMsg(data.message || 'A new confirmation link has been sent.');
    } catch {
      setResendMsg('A new confirmation link has been sent if an unverified account exists for that email.');
    } finally {
      setResending(false);
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

        {registeredEmail && !unverifiedEmail && !resendMsg && (
          <div className="mb-6 p-4 bg-success/10 border border-success/25 rounded-md text-sm">
            <p className="flex items-center gap-2 font-medium text-success mb-1">
              <MailCheck size={14} /> Account created — check your inbox
            </p>
            <p className="text-textsecondary">
              We've sent a confirmation link to <span className="font-medium text-textprimary">{registeredEmail}</span>.
              Open it, click <span className="font-medium">Confirm Email</span>, then come back and sign in.
            </p>
          </div>
        )}

        {unverifiedEmail && (
          <div className="mb-6 p-4 bg-[#EAB308]/10 border border-[#EAB308]/25 rounded-md text-sm">
            <p className="font-medium text-textprimary mb-1">Confirm your email address before signing in.</p>
            <p className="text-textsecondary mb-3">Check your inbox for the confirmation link. Didn't get it?</p>
            {resendMsg ? (
              <p className="flex items-center gap-2 text-success font-medium"><MailCheck size={14} /> {resendMsg}</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}

        {error && !unverifiedEmail && (
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
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primarylight">Forgot password?</Link>
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

        <div className="flex items-center gap-4 my-6">
          <span className="flex-1 h-px bg-bordercol"></span>
          <span className="text-xs font-medium text-textmuted uppercase tracking-wide">or</span>
          <span className="flex-1 h-px bg-bordercol"></span>
        </div>

        <GoogleButton onError={setError} navigate={navigate} />

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
