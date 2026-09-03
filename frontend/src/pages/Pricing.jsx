import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Sparkles, Crown, Building2, Check, Smartphone, Loader2, Lock, Info } from 'lucide-react';

const Pricing = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // plan being purchased
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [currentPlanKey, setCurrentPlanKey] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/billing/plans');
        setPlans(data.plans);
      } catch {
        setError('Could not load pricing. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Highlight the plan the seller is currently on
  useEffect(() => {
    if (!user || user.role !== 'SELLER') return;
    api.get('/billing/status')
      .then(({ data }) => setCurrentPlanKey(data.isSubscribed ? data.plan.key : 'FREE'))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const planKey = searchParams.get('plan');
    if (planKey) setSelected(planKey);
  }, [user, searchParams]);

  const openCheckout = (planKey) => {
    if (!user) return navigate('/login');
    setError('');
    setSelected(planKey);
  };

  // Create the payment record, ask the backend to initialize a Paystack
  // transaction, then send the user to the Paystack checkout (MoMo + card).
  const startPayment = async () => {
    setStarting(true);
    setError('');
    try {
      const { data: created } = await api.post('/billing/payments', { planKey: selected });
      const { data: init } = await api.post(`/billing/payments/${created.payment.id}/initialize`, {
        callbackUrl: `${window.location.origin}/billing/callback`,
      });
      window.location.href = init.authorizationUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start payment. Try again.');
      setStarting(false);
    }
  };

  const selectedPlan = plans.find(p => p.key === selected);
  const sellerPlans = plans.filter(p => ['BASIC', 'PLUS'].includes(p.key));
  const dealerPlans = plans.filter(p => ['DEALER_BASIC', 'DEALER_PRO'].includes(p.key));

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg">
        <Loader2 size={36} className="animate-spin text-primary mb-3" />
        <p className="text-textsecondary">Loading pricing…</p>
      </div>
    );
  }

  return (
    <div className="bg-bg min-h-screen pt-24 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display font-bold text-4xl text-textprimary mb-3">Pricing & Upgrades</h1>
          <p className="text-textsecondary max-w-2xl mx-auto">
            Start free, upgrade when you need more. Pay securely with Mobile Money or card via Paystack —
            your plan activates instantly after payment.
          </p>
        </div>

        {/* Current plan banner */}
        {currentPlanKey && (
          <div className="mb-8 flex items-center justify-center gap-2 text-sm bg-primary/5 border border-primary/10 rounded-lg py-3 px-4">
            <Info size={16} className="text-primary" />
            <span className="text-textsecondary">
              You are currently on the{' '}
              <strong className="text-textprimary capitalize">{currentPlanKey === 'FREE' ? 'Free' : currentPlanKey.replace(/_/g, ' ').toLowerCase()} plan</strong>.
              {currentPlanKey !== 'FREE' && ' — thanks for your support!'}
            </span>
          </div>
        )}

        {/* Seller Plans */}
        <h2 className="font-display font-semibold text-xl text-textprimary mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-accent" /> Seller Plans
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {sellerPlans.map(plan => (
            <div key={plan.key} className={`bg-surface border rounded-xl p-6 shadow-sm transition-shadow hover:shadow-md relative ${plan.key === 'PLUS' ? 'border-primary' : 'border-bordercol'} ${currentPlanKey === plan.key ? 'ring-2 ring-primary' : ''}`}>
              {currentPlanKey === plan.key && (
                <span className="absolute -top-3 right-4 inline-flex items-center gap-1 text-xs font-bold text-white bg-primary px-2.5 py-1 rounded-full">
                  <Check size={12} /> Current plan
                </span>
              )}
              {plan.key === 'PLUS' && currentPlanKey !== plan.key && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                  <Crown size={12} /> Best for active sellers
                </span>
              )}
              <h3 className="font-display font-bold text-xl text-textprimary">{plan.label}</h3>
              <p className="font-display font-bold text-3xl text-primary my-2">
                GH₵{plan.price}
                <span className="text-sm font-medium text-textmuted"> / {plan.durationDays} days</span>
              </p>
              <ul className="text-textsecondary text-sm mb-5 space-y-2">
                <li className="flex gap-2"><Check size={16} className="text-success flex-shrink-0 mt-0.5" />
                  {plan.listings} active listings
                </li>
                <li className="flex gap-2"><Check size={16} className="text-success flex-shrink-0 mt-0.5" /> Valid for 30 days</li>
              </ul>
              {currentPlanKey === plan.key ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-md font-medium bg-primary/10 text-primary cursor-default"
                >
                  ✓ Your current plan
                </button>
              ) : (
                <button
                  onClick={() => openCheckout(plan.key)}
                  className={`w-full py-2.5 rounded-md font-medium transition-colors ${
                    plan.key === 'PLUS'
                      ? 'bg-primary text-white hover:bg-primarylight'
                      : 'border border-primary text-primary hover:bg-primary hover:text-white'
                  }`}
                >
                  {currentPlanKey && currentPlanKey !== 'FREE' ? 'Switch to' : 'Get'} {plan.label}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Dealer Subscriptions */}
        <h2 className="font-display font-semibold text-xl text-textprimary mb-4 flex items-center gap-2">
          <Building2 size={20} className="text-accent" /> Dealer Subscriptions
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {dealerPlans.map(plan => (
            <div key={plan.key} className={`bg-surface border rounded-xl p-6 shadow-sm transition-shadow hover:shadow-md relative ${plan.key === 'DEALER_PRO' ? 'border-primary' : 'border-bordercol'} ${currentPlanKey === plan.key ? 'ring-2 ring-primary' : ''}`}>
              {currentPlanKey === plan.key && (
                <span className="absolute -top-3 right-4 inline-flex items-center gap-1 text-xs font-bold text-white bg-primary px-2.5 py-1 rounded-full">
                  <Check size={12} /> Current plan
                </span>
              )}
              {plan.key === 'DEALER_PRO' && currentPlanKey !== plan.key && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                  <Crown size={12} /> Best value
                </span>
              )}
              <h3 className="font-display font-bold text-xl text-textprimary">{plan.label}</h3>
              <p className="font-display font-bold text-3xl text-primary my-2">
                GH₵{plan.price}
                <span className="text-sm font-medium text-textmuted"> / month</span>
              </p>
              <ul className="text-textsecondary text-sm mb-5 space-y-2">
                <li className="flex gap-2"><Check size={16} className="text-success flex-shrink-0 mt-0.5" />
                  {plan.listings ? `${plan.listings} active listings` : 'Unlimited active listings'}
                </li>
                <li className="flex gap-2"><Check size={16} className="text-success flex-shrink-0 mt-0.5" /> 30-day duration, renews by payment</li>
              </ul>
              {currentPlanKey === plan.key ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-md font-medium bg-primary/10 text-primary cursor-default"
                >
                  ✓ Your current plan
                </button>
              ) : (
                <button
                  onClick={() => openCheckout(plan.key)}
                  className={`w-full py-2.5 rounded-md font-medium transition-colors ${
                    plan.key === 'DEALER_PRO'
                      ? 'bg-primary text-white hover:bg-primarylight'
                      : 'border border-primary text-primary hover:bg-primary hover:text-white'
                  }`}
                >
                  Subscribe
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Free tier note */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 text-center">
          <p className="text-textsecondary text-sm">
            <strong className="text-textprimary">Just getting started?</strong> Every seller can list 1 car
            free of charge. Boosts are optional.
          </p>
        </div>
      </div>

      {/* Checkout Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-textprimary/60 backdrop-blur-sm" onClick={() => !starting && setSelected(null)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl text-textprimary mb-1">
              {selectedPlan?.label}
            </h3>
            <p className="text-sm text-textsecondary mb-4">
              {selectedPlan?.listings
                ? `${selectedPlan.listings} active listings`
                : 'Unlimited active listings'}{' '}
              — GH₵{selectedPlan?.price} for {selectedPlan?.durationDays} days.
            </p>

            {error && <p className="text-sm text-err mb-4">{error}</p>}

            <button
              onClick={startPayment}
              disabled={starting}
              className="w-full py-3 bg-primary text-white rounded-md font-bold hover:bg-primarylight transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
              {starting ? 'Opening secure checkout…' : `Pay GH₵${selectedPlan?.price} with MoMo or Card`}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-textmuted mt-3">
              <Lock size={12} /> Secured by Paystack — Mobile Money & cards accepted
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;
