import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { CheckCircle2, XCircle, Loader2, CreditCard } from 'lucide-react';

/**
 * Paystack redirects here after checkout (?reference=...).
 * The webhook usually applies the plan first; this page verifies
 * server-side as a fallback and shows the outcome.
 */
const BillingCallback = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const [state, setState] = useState('verifying'); // verifying | success | pending | failed
  const [message, setMessage] = useState('');
  const [planLabel, setPlanLabel] = useState('');

  useEffect(() => {
    if (!user) {
      navigate(reference ? `/login` : '/pricing');
      return;
    }
    if (!reference) {
      setState('failed');
      setMessage('No payment reference found in the URL.');
      return;
    }
    let retryTimer;
    const verify = async (attempt = 0) => {
      try {
        const { data } = await api.get(`/billing/verify/${reference}`);
        if (data.status === 'success') {
          setState('success');
          setPlanLabel(data.payment?.plan?.replace(/_/g, ' ') || '');
          return;
        }
        if (data.status === 'failed') {
          setState('failed');
          setMessage('The payment was not completed. You can try again anytime.');
          return;
        }
        // pending / abandoned — retry a couple of times before giving up
        if (attempt < 2) {
          retryTimer = setTimeout(() => verify(attempt + 1), 2500);
        } else {
          setState('pending');
          setMessage('Your payment is still processing. If you were charged, your plan will activate automatically within a few minutes.');
        }
      } catch (err) {
        setState('failed');
        setMessage(err.response?.data?.message || 'Could not verify the payment right now.');
      }
    };
    verify();
    return () => clearTimeout(retryTimer);
  }, [user, reference, navigate]);

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 flex items-start justify-center px-4">
      <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-10 max-w-md w-full text-center mt-10">
        {state === 'verifying' && (
          <>
            <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Confirming your payment…</h2>
            <p className="text-textsecondary text-sm">This only takes a moment. Don't close this page.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 size={56} className="text-success mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Payment successful! 🎉</h2>
            <p className="text-textsecondary mb-6">
              Your {planLabel} plan is now active. You can create listings right away.
            </p>
            <button
              onClick={() => navigate('/seller/dashboard')}
              className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={18} /> Go to Dashboard
            </button>
          </>
        )}

        {state === 'pending' && (
          <>
            <Loader2 size={56} className="text-accent mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Payment processing</h2>
            <p className="text-textsecondary text-sm mb-6">{message}</p>
            <Link to="/seller/dashboard" className="text-primary font-medium hover:underline">Go to Dashboard</Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <XCircle size={56} className="text-err mx-auto mb-4" />
            <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Payment not completed</h2>
            <p className="text-textsecondary text-sm mb-6">{message}</p>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors"
            >
              Back to Pricing
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BillingCallback;
