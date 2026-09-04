import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import api from '../utils/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-md w-full bg-surface border border-bordercol rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <KeyRound size={24} className="text-primary" />
          </div>
          <h2 className="font-display font-bold text-3xl text-textprimary mb-2">Forgot Password</h2>
          {sent ? (
            <p className="text-textsecondary">Check your inbox for the reset link.</p>
          ) : (
            <p className="text-textsecondary">Enter the email you registered with and we'll send you a reset link.</p>
          )}
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <MailCheck size={28} className="text-success" />
            </div>
            <p className="text-textsecondary text-sm leading-relaxed mb-8">{message}</p>
            <Link to="/login" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="mt-8 text-center text-sm text-textsecondary">
              Remembered it?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-primarylight transition-colors">
                Sign in here
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
