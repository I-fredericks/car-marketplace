import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, MapPin, Truck, CreditCard, Banknote, Handshake, Receipt } from 'lucide-react';

const STATUS_COPY = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'text-warn' },
  PAID_HELD: { label: 'Paid — money in escrow', tone: 'text-primary' },
  HANDOVER_PENDING: { label: 'Reserved — handover pending', tone: 'text-primary' },
  DELIVERED: { label: 'Delivered', tone: 'text-primary' },
  COMPLETED: { label: 'Completed', tone: 'text-success' },
  CANCELLED: { label: 'Cancelled', tone: 'text-textmuted' },
  REFUNDED: { label: 'Refunded', tone: 'text-textmuted' },
};

/**
 * Purchase order page. Doubles as the Paystack callback landing
 * (?paid=1&reference=...) — verifies server-side as a webhook fallback.
 * Buyers confirm receipt / handover / cancel here; sellers confirm cash
 * collection and cancel too.
 */
const PurchaseDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [purchase, setPurchase] = useState(null);
  const [verifyState, setVerifyState] = useState(null); // verifying | failed (null = no verify running)
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/purchases/${id}`);
      setPurchase(data.purchase);
      return data.purchase;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load this order.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    let retryTimer;
    const init = async () => {
      const p = await load();

      // Paystack callback landing: paid=1 => verify server-side (webhook
      // may already have escrowed it; verify is idempotent).
      const returnedPaid = searchParams.get('paid') === '1';
      if (p && returnedPaid && p.method === 'PAYSTACK' && p.status === 'AWAITING_PAYMENT') {
        const verify = async (attempt = 0) => {
          setVerifyState('verifying');
          try {
            const { data } = await api.get(`/purchases/${id}/verify`);
            if (data.status === 'success') {
              setPurchase(data.purchase);
              setVerifyState(null);
              searchParams.delete('paid');
              setSearchParams(searchParams, { replace: true });
              return;
            }
            if (attempt < 2) {
              retryTimer = setTimeout(() => verify(attempt + 1), 2500);
            } else {
              setVerifyState('failed');
            }
          } catch (err) {
            setVerifyState('failed');
            setError(err.response?.data?.message || 'Could not verify the payment right now.');
          }
        };
        verify();
      } else if (returnedPaid) {
        // Already settled (webhook beat us) — just clear the flag
        searchParams.delete('paid');
        setSearchParams(searchParams, { replace: true });
      }
    };
    init();
    return () => clearTimeout(retryTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, load]);

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
        <XCircle size={48} className="text-err mb-4" />
        <h2 className="font-display font-bold text-2xl text-textprimary mb-2">{error || 'Order not found'}</h2>
        <Link to="/purchases" className="text-primary font-medium hover:underline mt-2">My purchases</Link>
      </div>
    );
  }

  const car = purchase.vehicle || {};
  const isBuyer = purchase.buyerId === user.id;
  const isSeller = purchase.seller?.user?.id === user.id;
  const sellerName = purchase.seller?.user?.name || 'Seller';
  const buyerName = purchase.buyer?.name || 'Buyer';
  const status = STATUS_COPY[purchase.status] || { label: purchase.status, tone: 'text-textsecondary' };
  const newOrder = searchParams.get('new') === '1';

  const act = async (endpoint) => {
    setActing(true);
    setError('');
    try {
      const { data } = await api.post(`/purchases/${id}/${endpoint}`);
      setPurchase((prev) => ({ ...prev, ...data.purchase }));
      await load(); // re-fetch with relations for a fully current view
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${endpoint.replace(/-/g, ' ')}.`);
    } finally {
      setActing(false);
    }
  };

  const ActionButton = ({ label, endpoint, onClick, primary = false, danger = false, icon: Icon }) => (
    <button
      onClick={onClick ?? (() => act(endpoint))}
      disabled={acting}
      className={`flex-1 py-3 rounded-md font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
        danger
          ? 'border border-bordercol text-err hover:bg-err/5'
          : primary
            ? 'bg-accent text-textprimary hover:bg-accentdark'
            : 'bg-primary text-white hover:bg-primarylight'
      }`}
    >
      {acting ? <Loader2 size={18} className="animate-spin" /> : Icon && <Icon size={18} />}
      {label}
    </button>
  );

  const retryPayment = async () => {
    setActing(true);
    try {
      const { data: init } = await api.post(`/purchases/${id}/initialize`, {
        callbackUrl: `${window.location.origin}/purchases/${id}?paid=1`,
      });
      window.location.href = init.authorizationUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not restart payment.');
      setActing(false);
    }
  };

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface border border-bordercol rounded-xl p-7 shadow-sm">

          {/* Verifying overlay note */}
          {verifyState === 'verifying' && (
            <div className="mb-6 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg p-4">
              <Loader2 size={20} className="animate-spin text-primary flex-shrink-0" />
              <p className="text-sm text-textprimary font-medium">Confirming your payment — don't close this page…</p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display font-bold text-2xl text-textprimary">Order {purchase.reference}</h1>
              <p className={`mt-1 font-medium ${status.tone}`}>{status.label}</p>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-xl text-textprimary">
                GH₵{(purchase.amount / 100).toLocaleString()}
              </div>
              <div className="text-xs text-textsecondary flex items-center gap-1 justify-end mt-1">
                {purchase.method === 'PAYSTACK' ? <CreditCard size={13} /> : <Banknote size={13} />}
                {purchase.method === 'PAYSTACK' ? 'Online (escrow)' : 'Cash at handover'}
              </div>
            </div>
          </div>

          {/* Completion banner */}
          {purchase.status === 'COMPLETED' && (
            <div className="mb-6 flex items-center gap-3 bg-success/10 border border-success/20 rounded-lg p-4">
              <CheckCircle2 size={22} className="text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-textprimary">
                  {isBuyer ? 'Enjoy the car!' : 'Sale complete!'}
                </p>
                {purchase.payoutStatus === 'PENDING' && (
                  <p className="text-sm text-textsecondary mt-0.5">
                    Escrow release is queued — an admin marks it paid once the transfer leaves.
                  </p>
                )}
              </div>
            </div>
          )}

          {newOrder && purchase.status === 'HANDOVER_PENDING' && (
            <div className="mb-6 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg p-4">
              <Handshake size={22} className="text-primary flex-shrink-0" />
              <p className="text-sm text-textprimary">
                <span className="font-medium">Car reserved for you.</span> {sellerName} has been notified. Arrange the
                handover and pay cash when you collect the car.
              </p>
            </div>
          )}

          {/* Escrow reassurance while held */}
          {purchase.status === 'PAID_HELD' && (
            <div className="mb-6 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg p-4">
              <ShieldCheck size={22} className="text-success flex-shrink-0" />
              <p className="text-sm text-textprimary">
                <span className="font-medium">Your money is held safely in escrow.</span>
                {isBuyer
                  ? ' Collect the car, then confirm receipt below to release the payment to the seller.'
                  : ` ${buyerName} paid online. Hand the car over — funds release once they confirm receipt.`}
              </p>
            </div>
          )}

          {/* Vehicle */}
          <div className="flex gap-4 border border-bordercol rounded-lg p-4 mb-6">
            {car.images?.[0] && (
              <img
                src={getImageUrl(car.images.find((i) => i.isPrimary) || car.images[0])}
                alt={`${car.make} ${car.model}`}
                className="w-24 h-20 object-cover rounded-md flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <Link to={`/car/${car.id}`} className="font-medium text-textprimary hover:text-primary">
                {car.year} {car.make} {car.model}
              </Link>
              <div className="text-sm text-textsecondary flex items-center gap-1 mt-1">
                {purchase.deliveryMode === 'PICKUP'
                  ? <><MapPin size={13} /> Pickup — {car.location}</>
                  : <><Truck size={13} /> Delivery{purchase.address ? ` to ${purchase.address}` : ''}</>}
              </div>
              <div className="text-xs text-textmuted mt-1">
                {isBuyer ? `Seller: ${sellerName}` : `Buyer: ${buyerName}`}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="text-sm text-textsecondary space-y-1.5 mb-6">
            {purchase.phone && <p>Contact phone: <span className="text-textprimary">{purchase.phone}</span></p>}
            {purchase.notes && <p>Note: <span className="text-textprimary">{purchase.notes}</span></p>}
            {purchase.channel && <p>Paid via: <span className="text-textprimary capitalize">{purchase.channel.replace(/_/g, ' ')}</span></p>}
            {purchase.paidAt && <p>Paid: <span className="text-textprimary">{new Date(purchase.paidAt).toLocaleString()}</span></p>}
          </div>

          {/* Fee breakdown (seller view) */}
          {isSeller && purchase.method === 'PAYSTACK' && (
            <div className="border border-bordercol rounded-lg p-4 mb-6 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-textsecondary">Sale price</span>
                <span className="font-medium text-textprimary">GH₵{(purchase.amount / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-textsecondary">CarMarket service fee ({(purchase.commissionBps || 0) / 100}%)</span>
                <span className="text-textsecondary">− GH₵{(Math.round(purchase.amount * (purchase.commissionBps || 0) / 10000) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-bordercol mt-1 pt-2">
                <span className="font-medium text-textprimary">You receive</span>
                <span className="font-bold text-success">GH₵{((purchase.amount - Math.round(purchase.amount * (purchase.commissionBps || 0) / 10000)) / 100).toLocaleString()}</span>
              </div>
            </div>
          )}

          {error && <p className="mb-4 text-sm text-err font-medium" role="alert">{error}</p>}

          {/* Actions by role + state */}
          <div className="flex gap-3 flex-wrap">
            {['PAID_HELD', 'DELIVERED', 'COMPLETED'].includes(purchase.status) && (
              <Link
                to={`/purchases/${id}/receipt`}
                className="flex-1 min-w-36 py-3 rounded-md font-bold flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
              >
                <Receipt size={18} /> Receipt
              </Link>
            )}
            {isBuyer && purchase.method === 'PAYSTACK' && purchase.status === 'PAID_HELD' && (
              <ActionButton label="I received the car" endpoint="confirm-received" primary icon={CheckCircle2} />
            )}
            {isBuyer && purchase.method === 'CASH' && purchase.status === 'HANDOVER_PENDING' && (
              <ActionButton label="I collected the car" endpoint="confirm-handover" primary icon={Handshake} />
            )}
            {isSeller && purchase.method === 'CASH' && purchase.status === 'DELIVERED' && (
              <ActionButton label="Cash received" endpoint="seller-collected" primary icon={CheckCircle2} />
            )}
            {(isBuyer || isSeller) && ['AWAITING_PAYMENT', 'HANDOVER_PENDING', 'PAID_HELD', 'DELIVERED'].includes(purchase.status) && (
              <ActionButton
                label={purchase.status === 'AWAITING_PAYMENT' ? 'Cancel reservation' : 'Cancel order'}
                endpoint="cancel"
                danger
              />
            )}
            {isBuyer && purchase.method === 'PAYSTACK' && purchase.status === 'AWAITING_PAYMENT' && verifyState !== 'verifying' && (
              <ActionButton label="Continue to payment" onClick={retryPayment} primary icon={CreditCard} />
            )}
          </div>

          {purchase.status === 'CANCELLED' && (
            <p className="mt-4 text-sm text-textmuted">This order was cancelled and the vehicle went back on sale.</p>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/purchases" className="text-primary font-medium hover:underline">All my purchases</Link>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDetail;
