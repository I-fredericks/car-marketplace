import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ShieldCheck, MailCheck, ArrowLeft, Car } from 'lucide-react';

/**
 * Staff portal — the ONLY sign-in surface for ADMIN accounts.
 * Two steps: email + password -> 6-digit code emailed -> code verifies into
 * a full admin session. Public /login rejects admin accounts outright, and
 * this URL is intentionally unlinked from the public site.
 */
const StaffLogin = () => {
  const { adminLogin, verifyAdminCode } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await adminLogin(form.email, form.password);
      setInfo(data.message || 'Security code sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid staff credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyAdminCode(form.email, code);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired security code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0F1729] px-4 sm:px-6 lg:px-8">
      {/* Branded top bar — the page is chrome-free, so it carries its own identity */}
      <header className="pt-8 pb-2 flex justify-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Car size={20} className="text-accent" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-lg text-white tracking-tight">
              CarMarket<span className="text-accent">Ghana</span>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Staff Portal</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          <div className="bg-[#16203A] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck size={28} className="text-primary" />
            </div>
            <h1 className="font-display font-bold text-2xl text-white mb-1">Staff Portal</h1>
            <p className="text-white/50 text-sm">
              {step === 1 ? 'Restricted access — authorised staff only' : 'Enter the 6-digit code sent to your email'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-err/15 border border-err/30 rounded-md text-err text-sm font-medium">
              {error}
            </div>
          )}
          {info && step === 2 && (
            <div className="mb-6 p-4 bg-success/10 border border-success/25 rounded-md text-success text-sm flex items-start gap-2">
              <MailCheck size={16} className="flex-shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/70">Staff Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@carmarket.com"
                  required
                  autoComplete="username"
                  className="w-full h-11 px-3 border border-white/15 rounded-md bg-white/5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/70">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 px-3 border border-white/15 rounded-md bg-white/5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 flex items-center justify-center"
              >
                {loading ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/70 text-center">Security Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="w-full h-14 px-3 border border-white/15 rounded-md bg-white/5 text-white text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 flex items-center justify-center"
              >
                {loading ? 'Signing in…' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setCode(''); setError(''); setInfo(''); }}
                className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft size={12} /> Use different credentials
              </button>
            </form>
          )}
          </div>

          <p className="mt-6 text-center text-[11px] text-white/30 leading-relaxed px-4">
            Protected area. All sign-in attempts are logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
