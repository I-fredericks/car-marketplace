import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { Loader2, PackageSearch, CreditCard, Banknote } from 'lucide-react';

const STATUS_STYLE = {
  AWAITING_PAYMENT: 'bg-warn/10 text-warn',
  PAID_HELD: 'bg-primary/10 text-primary',
  HANDOVER_PENDING: 'bg-primary/10 text-primary',
  DELIVERED: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-success/10 text-success',
  CANCELLED: 'bg-textmuted/10 text-textmuted',
  REFUNDED: 'bg-textmuted/10 text-textmuted',
};
const STATUS_LABEL = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PAID_HELD: 'Paid (escrow)',
  HANDOVER_PENDING: 'Handover pending',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/**
 * My purchases: orders placed as a buyer, plus (for sellers) sales made.
 */
const Purchases = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState({ purchases: [], sales: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('buying');

  useEffect(() => {
    // Wait for AuthContext to rehydrate session before redirecting:
    // a refresh has user=null during /auth/me — don't bounce to /login.
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const { data } = await api.get('/purchases');
        setData(data);
      } catch (err) {
        console.error('Failed to load purchases:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, navigate]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex items-center justify-center bg-bg">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  const isSeller = data.sales.length > 0 || user.role === 'SELLER';
  const rows = tab === 'buying' ? data.purchases : data.sales;

  const Row = ({ p }) => {
    const car = p.vehicle || {};
    const img = car.images?.find((i) => i.isPrimary) || car.images?.[0];
    return (
      <Link
        to={`/purchases/${p.id}`}
        className="flex items-center gap-4 bg-surface border border-bordercol rounded-lg p-4 hover:border-primary/50 transition-colors"
      >
        {img ? (
          <img src={getImageUrl(img)} alt={`${car.make} ${car.model}`} className="w-20 h-16 object-cover rounded-md flex-shrink-0" />
        ) : (
          <div className="w-20 h-16 bg-bg rounded-md flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-textprimary truncate">{car.year} {car.make} {car.model}</div>
          <div className="text-xs text-textmuted mt-0.5">Order {p.reference}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-textprimary">GH₵{(p.amount / 100).toLocaleString()}</div>
          <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${STATUS_STYLE[p.status] || STATUS_STYLE.CANCELLED}`}>
            {p.method === 'PAYSTACK' ? <CreditCard size={11} /> : <Banknote size={11} />}
            {STATUS_LABEL[p.status] || p.status}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display font-bold text-3xl text-textprimary mb-6">My purchases</h1>

        {isSeller && (
          <div className="flex gap-2 mb-6">
            {[
              { key: 'buying', label: `Buying (${data.purchases.length})` },
              { key: 'selling', label: `Selling (${data.sales.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  tab === key ? 'bg-primary text-white' : 'bg-surface border border-bordercol text-textsecondary hover:text-textprimary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-surface border border-bordercol rounded-xl p-12 text-center">
            <PackageSearch size={44} className="text-bordercol mb-4" />
            <p className="text-textsecondary">
              {tab === 'buying' ? 'No purchases yet — find a car and tap Buy Now in the listing.' : 'No sales yet.'}
            </p>
            {tab === 'buying' && (
              <Link to="/search" className="mt-4 text-primary font-medium hover:underline">Browse cars</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((p) => <Row key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Purchases;
