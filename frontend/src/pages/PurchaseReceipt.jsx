import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Loader2, Printer, ArrowLeft, ShieldCheck } from 'lucide-react';

const STATUS_LABEL = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PAID_HELD: 'Paid — held in escrow',
  HANDOVER_PENDING: 'Reserved — handover pending',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/**
 * Printable order receipt. The buyer's receipt email links here; Ctrl/P or
 * the button yields a clean one-pager (screen chrome hides under `print`).
 */
const PurchaseReceipt = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Wait for AuthContext bootstrap before redirecting (refresh has user=null).
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/purchases/${id}`);
        setPurchase(data.purchase);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this receipt.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, id, navigate]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex items-center justify-center bg-bg">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg px-4 text-center">
        <h2 className="font-display font-bold text-2xl text-textprimary mb-2">{error || 'Receipt not found'}</h2>
        <Link to="/purchases" className="text-primary font-medium hover:underline mt-2">My purchases</Link>
      </div>
    );
  }

  const car = purchase.vehicle || {};
  const commission = Math.round((purchase.amount * (purchase.commissionBps || 0)) / 10000);
  const payout = purchase.amount - commission;
  const isSeller = purchase.seller?.user?.id === user.id;
  const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');
  const ghs = (pesewas) => `GH₵${(pesewas / 100).toLocaleString()}`;

  const Row = ({ label, value, strong, subtle }) => (
    <tr>
      <td className="py-2.5 pr-4 text-sm text-textsecondary align-top whitespace-nowrap">{label}</td>
      <td className={`py-2.5 text-sm ${strong ? 'font-bold text-textprimary' : 'text-textprimary'} ${subtle || ''}`}>{value}</td>
    </tr>
  );

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 px-4 print:pt-0 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link to={`/purchases/${purchase.id}`} className="text-primary font-medium hover:underline flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back to order
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center gap-2 text-sm"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto bg-surface border border-bordercol rounded-xl p-8 shadow-sm print:border-0 print:shadow-none print:rounded-none">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-primary pb-5 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-primary">CarMarket Ghana</h1>
            <p className="text-sm text-textsecondary mt-1">Purchase receipt — order {purchase.reference}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary print:border print:border-primary">
              {STATUS_LABEL[purchase.status] || purchase.status}
            </span>
          </div>
        </div>

        {/* Parties + vehicle */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-bold text-textmuted uppercase tracking-wider mb-2">Buyer</h3>
            <p className="font-medium text-textprimary">{purchase.buyer?.name}</p>
            <p className="text-sm text-textsecondary">{purchase.buyer?.email}</p>
            {purchase.phone && <p className="text-sm text-textsecondary">{purchase.phone}</p>}
          </div>
          <div>
            <h3 className="text-xs font-bold text-textmuted uppercase tracking-wider mb-2">Seller</h3>
            <p className="font-medium text-textprimary">{purchase.seller?.user?.name}</p>
            <p className="text-sm text-textsecondary">{purchase.seller?.user?.email}</p>
          </div>
        </div>

        <h3 className="text-xs font-bold text-textmuted uppercase tracking-wider mb-2">Order details</h3>
        <table className="w-full mb-6">
          <tbody>
            <Row label="Vehicle" value={`${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.trim()} strong />
            <Row label="Handover" value={purchase.deliveryMode === 'PICKUP' ? `Buyer pickup${car.location ? ` — ${car.location}` : ''}` : `Delivery${purchase.address ? ` to ${purchase.address}` : ''}`} />
            {purchase.notes && <Row label="Note" value={purchase.notes} subtle="text-textsecondary italic" />}
            <Row label="Order placed" value={fmt(purchase.createdAt)} />
            <Row label="Payment" value={purchase.method === 'PAYSTACK' ? `Online (Paystack)${purchase.channel ? ` — ${purchase.channel.replace(/_/g, ' ')}` : ''}` : 'Cash at handover'} />
            <Row label="Paid at" value={purchase.paidAt ? fmt(purchase.paidAt) : 'Not paid yet'} />
          </tbody>
        </table>

        {/* Money */}
        <div className="border-t border-bordercol pt-4 mb-6">
          <div className="flex justify-between py-1.5">
            <span className="text-textsecondary">Vehicle price</span>
            <span className="font-bold text-textprimary">{ghs(purchase.amount)}</span>
          </div>
          {purchase.method === 'PAYSTACK' && (
            <>
              <div className="flex justify-between py-1.5">
                <span className="text-textsecondary">CarMarket service fee ({(purchase.commissionBps || 0) / 100}%)</span>
                <span className="text-textprimary">{ghs(commission)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-bordercol mt-1.5 pt-3">
                <span className="text-textsecondary">{isSeller ? 'You will receive' : 'Seller receives'}</span>
                <span className="font-bold text-success">{ghs(payout)}</span>
              </div>
            </>
          )}
        </div>

        {/* Escrow note */}
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/10 rounded-lg p-4 print:border print:border-bordercol">
          <ShieldCheck size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-textsecondary leading-relaxed">
            {purchase.method === 'PAYSTACK'
              ? 'Escrow protected by CarMarket Ghana: the buyer’s payment is held until receipt is confirmed, then released to the seller minus the service fee.'
              : 'Cash order: payment happens directly between buyer and seller at handover. CarMarket Ghana reserved this vehicle for the order.'}
          </p>
        </div>

        <p className="text-center text-xs text-textmuted mt-6">
          car-marketplace-five-ruby.vercel.app · Generated {fmt(new Date())}
        </p>
      </div>
    </div>
  );
};

export default PurchaseReceipt;
