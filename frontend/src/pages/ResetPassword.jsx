import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldX } from 'lucide-react';
import api from '../utils/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-md w-full bg-surface border border-bordercol rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${done ? 'bg-success/10' : 'bg-primary/10'}`}>
            {done ? <ShieldCheck size={24} className="text-success" /> : <ShieldX size={24} className="text-primary" />}
          </div>
          <h2 className="font-display font-bold text-3xl text-textprimary mb-2">
            {done ? 'Password Reset' : 'Set a New Password'}
          </h2>
          <p className="text-textsecondary">
            {done ? 'All set — your password has been updated.' : 'Choose a new password for your account.'}
          </p>
        </div>

        {done ? (
          <Link to="/login" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
            Sign In With New Password
          </Link>
        ) : !token ? (
          <>
            <p className="text-textsecondary text-sm text-center mb-6">
              This link is missing its reset token. Please request a fresh reset link.
            </p>
            <Link to="/forgot-password" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
              Request New Link
            </Link>
          </>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-textprimary">New Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                  className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-textprimary">Confirm New Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  required
                  className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
