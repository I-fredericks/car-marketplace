import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Car, User, Store, Building2, ShieldCheck } from 'lucide-react';

const SELLER_TYPES = [
  {
    value: 'PRIVATE',
    label: 'Private Seller',
    description: 'Selling your own car',
    Icon: User,
  },
  {
    value: 'DEALER',
    label: 'Car Dealer',
    description: 'Buy and sell cars for profit',
    Icon: Store,
  },
  {
    value: 'COMPANY',
    label: 'Company',
    description: 'Registered company with multiple vehicles',
    Icon: Building2,
  },
];

const BecomeSeller = () => {
  const { user, upgradeToSeller, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    sellerType: 'PRIVATE',
    whatsapp: '',
    location: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Buyers only — sellers/admins go straight to their dashboard
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === 'SELLER' || user.role === 'ADMIN') {
      navigate('/seller/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
        <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Car size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Become a Seller</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            Sign in or create an account first, then upgrade to a seller account in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => navigate('/login', { state: { from: '/become-seller' } })}
              className="flex-1 h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 h-11 bg-bg border border-bordercol text-textprimary font-medium rounded-md hover:bg-bordercol/30 transition-colors"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await upgradeToSeller({
        sellerType: form.sellerType,
        whatsapp: form.whatsapp || undefined,
        location: form.location || undefined,
      });
      navigate('/sell');
    } catch (err) {
      setError(err.response?.data?.message || 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-xl w-full bg-surface border border-bordercol rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Car size={24} className="text-primary" />
          </div>
          <h2 className="font-display font-bold text-3xl text-textprimary mb-2">Become a Seller</h2>
          <p className="text-textsecondary">
            Hi {user.name.split(' ')[0]} — tell us a bit about how you'll sell, and your account
            will be upgraded instantly. You can list your first car right after.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">I am selling as...</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SELLER_TYPES.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, sellerType: value })}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-md border-2 text-center transition-colors ${
                    form.sellerType === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-bordercol bg-surface text-textsecondary hover:bg-bg'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-textmuted leading-snug">{description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">WhatsApp Number</label>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="e.g. 024XXXXXXX — so buyers can reach you fast"
              className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Accra"
              className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
            />
          </div>

          <div className="flex items-start gap-2 text-xs text-textmuted">
            <ShieldCheck size={14} className="text-success flex-shrink-0 mt-0.5" />
            <span>
              You'll start on the Free plan (1 active listing). Upgrade any time from the Pricing
              page for more listings and higher search ranking.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Upgrading your account...
              </span>
            ) : (
              'Become a Seller'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BecomeSeller;
