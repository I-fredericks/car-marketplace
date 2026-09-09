import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, MapPin, Truck, CreditCard, Banknote, Handshake, Receipt, Landmark, Smartphone, Scale } from 'lucide-react';
import OrderProgress from '../components/OrderProgress';
import SlideToConfirm from '../components/SlideToConfirm';
import ReviewForm from '../components/ReviewForm';

const ghs = (pesewas) => `GH₵${(pesewas / 100).toLocaleString()}`;

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
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [purchase, setPurchase] = useState(null);
  const [verifyState, setVerifyState] = useState(null); // verifying | failed (null = no verify running)
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState(null);
  const [claimRef, setClaimRef] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);

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
    // Wait for AuthContext bootstrap before redirecting (refresh has user=null).
    if (authLoading) return;
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
  }, [user, authLoading, id, load]);

  // Transfer orders awaiting payment: load the platform account details
  useEffect(() => {
    if (!user || !purchase) return;
    const transfer = purchase.method === 'BANK_TRANSFER' || purchase.method === 'MOMO';
    if (!transfer || purchase.status !== 'AWAITING_PAYMENT') {
      setInstructions(null);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/purchases/${id}/instructions`);
        setInstructions(data.instructions);
      } catch {
        // detail still renders; instructions card just hides
      }
    })();
  }, [user, purchase?.status, purchase?.method, id, purchase]);

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

  const submitClaim = async () => {
    setClaimBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/purchases/${id}/claim-payment`, {
        paymentRef: claimRef,
        payerName: claimName || undefined,
      });
      setPurchase((prev) => ({ ...prev, ...data.purchase }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your payment reference.');
    } finally {
      setClaimBusy(false);
    }
  };

  // Freeze the escrow: dispute blocks confirm/cancel until admin mediates
  const openDisputePrompt = async () => {
    const reason = window.prompt(
      'Describe the problem in detail (at least 10 characters).\n\nThis freezes the funds on this order until CarMarket mediates.',
      ''
    );
    if (reason === null) return; // cancelled
    if (reason.trim().length < 10) {
      setError('Describe the problem in at least 10 characters so CarMarket can mediate.');
      return;
    }
    setActing(true);
    setError('');
    try {
      const { data } = await api.post(`/purchases/${id}/open-dispute`, { reason: reason.trim() });
      setPurchase((prev) => ({ ...prev, ...data.purchase }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open the dispute.');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface border border-bordercol rounded-xl p-5 sm:p-7 shadow-sm">

          {/* AliExpress-style order progress tracker */}
          <OrderProgress status={purchase.status} handoverMarked={Boolean(purchase.sellerHandoverAt)} />

          {/* Transfer payment instructions + claim (before escrow confirms) */}
          {instructions && purchase.status === 'AWAITING_PAYMENT' && isBuyer && (
            <div className="mb-6 border-2 border-primary/20 bg-primary/[0.04] rounded-lg p-5">
              <h3 className="font-display font-bold text-textprimary mb-1 flex items-center gap-2">
                <Landmark size={18} className="text-primary" /> Pay {ghs(instructions.amountPesewas)} to escrow
              </h3>
              <p className="text-xs text-textsecondary mb-4">
                Send exactly this amount to the CarMarket account below — the money is held in escrow until you confirm you have the car.
              </p>

              <div className="bg-surface border border-bordercol rounded-md p-4 space-y-2 text-sm mb-4">
                {purchase.method === 'BANK_TRANSFER' ? (
                  <>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">Bank</span><span className="font-medium text-textprimary text-right">{instructions.bank.name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">Account number</span><span className="font-bold text-textprimary tracking-wide text-right">{instructions.bank.accountNumber}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">Account name</span><span className="font-medium text-textprimary text-right">{instructions.bank.accountName}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">MoMo number</span><span className="font-bold text-textprimary tracking-wide text-right">{instructions.momo.number}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">Network</span><span className="font-medium text-textprimary text-right">{instructions.momo.network}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-textsecondary">Name</span><span className="font-medium text-textprimary text-right">{instructions.momo.name}</span></div>
                  </>
                )}
                <div className="border-t border-bordercol pt-2 flex justify-between gap-4">
                  <span className="text-textsecondary">Amount</span>
                  <span className="font-bold text-primary">{ghs(instructions.amountPesewas)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-textsecondary">Reference</span>
                  <span className="font-bold text-accentdark tracking-wide text-right">{instructions.reference}</span>
                </div>
              </div>
              <p className="text-xs text-warn font-medium mb-4">
                Use <span className="font-bold">{instructions.reference}</span> as the transfer reason — it's how we match your payment.
              </p>

              {!purchase.claimedAt ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-textsecondary">Transfer / transaction reference</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={claimRef}
                      onChange={(e) => setClaimRef(e.target.value)}
                      placeholder="e.g. the confirmation code from your bank"
                      className="flex-1 h-10 px-3 border border-bordercol rounded-md bg-surface text-base sm:text-sm focus:outline-none focus:border-primary"
                    />
                    <input
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      placeholder="Name on your account"
                      className="flex-1 h-10 px-3 border border-bordercol rounded-md bg-surface text-base sm:text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={submitClaim}
                      disabled={claimBusy || claimRef.trim().length < 4}
                      className="px-5 h-10 bg-accent text-textprimary font-bold rounded-md text-sm hover:bg-accentdark disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                      {claimBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} I have paid
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-surface border border-success/25 rounded-md p-3">
                  <Loader2 size={16} className="animate-spin text-success" />
                  <p className="text-sm text-textprimary">
                    Payment reported (ref <span className="font-medium">{purchase.paymentRef}</span>) — CarMarket is confirming it against the account. You'll be notified shortly.
                  </p>
                </div>
              )}
            </div>
          )}

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
                {purchase.method === 'CASH' ? <Banknote size={13} /> : purchase.method === 'MOMO' ? <Smartphone size={13} /> : <CreditCard size={13} />}
                {purchase.method === 'CASH'
                  ? 'Cash at handover'
                  : purchase.method === 'MOMO'
                    ? 'MoMo to CarMarket (escrow)'
                    : purchase.method === 'PAYSTACK'
                      ? 'Online (escrow)'
                      : 'Bank transfer (escrow)'}
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
          {purchase.status === 'PAID_HELD' && purchase.disputeStatus !== 'OPEN' && (
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

          {/* Dispute states */}
          {purchase.disputeStatus === 'OPEN' && (
            <div className="mb-6 border-2 border-err/40 bg-err/5 rounded-lg p-4">
              <h4 className="font-bold text-err text-sm mb-1 flex items-center gap-2">
                <Scale size={16} /> Dispute open — funds frozen
              </h4>
              <p className="text-sm text-textprimary leading-relaxed">
                {purchase.disputeReason}
              </p>
              <p className="text-xs text-textsecondary mt-2">
                CarMarket is mediating. Nothing moves on this order until the dispute is resolved. Opened {new Date(purchase.disputeOpenedAt).toLocaleString()}.
              </p>
            </div>
          )}
          {purchase.disputeStatus === 'RESOLVED_BUYER' && (
            <div className="mb-6 flex items-center gap-3 bg-success/10 border border-success/25 rounded-lg p-4">
              <Scale size={20} className="text-success flex-shrink-0" />
              <p className="text-sm text-textprimary">
                <span className="font-medium">Dispute resolved — buyer refunded.</span> The payment was returned and the car returned to sale.
              </p>
            </div>
          )}
          {purchase.disputeStatus === 'RESOLVED_SELLER' && (
            <div className="mb-6 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg p-4">
              <Scale size={20} className="text-primary flex-shrink-0" />
              <p className="text-sm text-textprimary">
                <span className="font-medium">Dispute resolved — funds released to the seller.</span> The escrow was paid out after mediation.
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

          {/* Actions by role + state. Irreversible money moves use
              slide-to-confirm so a stray tap can't release escrowed cash.
              An open dispute freezes all of them (backend enforces too). */}
          {purchase.disputeStatus !== 'OPEN' && (
          <div className="space-y-3">
            {/* Escrow orders: seller marks the physical handover first… */}
            {isSeller && purchase.method !== 'CASH' && purchase.status === 'PAID_HELD' && !purchase.sellerHandoverAt && (
              <div>
                <SlideToConfirm
                  label="Slide to mark — I handed the car over"
                  confirmLabel="Handover marked"
                  busy={acting}
                  onConfirm={() => act('seller-handover')}
                />
                <p className="mt-2 text-xs text-textmuted leading-relaxed">
                  Slide once the buyer has physically taken the car. They'll be asked to confirm receipt, which releases your payout.
                </p>
              </div>
            )}
            {isSeller && purchase.method !== 'CASH' && purchase.status === 'PAID_HELD' && purchase.sellerHandoverAt && (
              <div className="flex items-center gap-3 bg-success/10 border border-success/25 rounded-lg p-4">
                <Handshake size={20} className="text-success flex-shrink-0" />
                <p className="text-sm text-textprimary">
                  <span className="font-medium">Handover marked.</span> Waiting for the buyer to confirm receipt and release your payout.
                </p>
              </div>
            )}

            {/* …and the buyer confirms receipt to release the escrow.
                Applies to every escrow rail (transfer/MoMo/legacy card). */}
            {isBuyer && purchase.method !== 'CASH' && purchase.status === 'PAID_HELD' && (
              <div>
                {purchase.sellerHandoverAt && (
                  <div className="mb-3 flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-lg p-3">
                    <Handshake size={18} className="text-primary flex-shrink-0" />
                    <p className="text-sm text-textprimary">
                      The seller marked the car as handed over — confirm receipt below when you have it.
                    </p>
                  </div>
                )}
                <SlideToConfirm
                  label="Slide to confirm — I received the car"
                  confirmLabel="Receipt confirmed"
                  busy={acting}
                  onConfirm={() => act('confirm-received')}
                />
                <p className="mt-2 text-xs text-textmuted leading-relaxed">
                  Only slide after you have physically inspected the car and taken it. This releases your payment to the seller and cannot be undone.
                </p>
              </div>
            )}
            {isBuyer && purchase.method === 'CASH' && purchase.status === 'HANDOVER_PENDING' && (
              <div>
                <SlideToConfirm
                  label="Slide to confirm — I collected the car"
                  confirmLabel="Handover confirmed"
                  busy={acting}
                  onConfirm={() => act('confirm-handover')}
                />
                <p className="mt-2 text-xs text-textmuted leading-relaxed">
                  Only slide after you have inspected and taken the car. The seller will confirm they received your cash.
                </p>
              </div>
            )}
            {isSeller && purchase.method === 'CASH' && purchase.status === 'DELIVERED' && (
              <div>
                <SlideToConfirm
                  label="Slide to confirm — cash received"
                  confirmLabel="Sale closed"
                  busy={acting}
                  onConfirm={() => act('seller-collected')}
                />
                <p className="mt-2 text-xs text-textmuted leading-relaxed">
                  Only slide after the cash is physically counted and in your hands. This closes the sale permanently.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {['PAID_HELD', 'DELIVERED', 'COMPLETED'].includes(purchase.status) && (
                <Link
                  to={`/purchases/${id}/receipt`}
                  className="flex-1 py-3 rounded-md font-bold flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                >
                  <Receipt size={18} /> Receipt
                </Link>
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
              {(isBuyer || isSeller) && purchase.method !== 'CASH' && purchase.status === 'PAID_HELD' && purchase.disputeStatus === 'NONE' && (
                <button
                  onClick={openDisputePrompt}
                  className="flex-1 py-3 rounded-md font-medium border border-err/40 text-err hover:bg-err/5 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Scale size={16} /> Report a problem
                </button>
              )}
            </div>
          </div>
          )}

          {purchase.status === 'CANCELLED' && (
            <p className="mt-4 text-sm text-textmuted">This order was cancelled and the vehicle went back on sale.</p>
          )}

          {/* Post-sale: buyer rates the seller on a completed order */}
          {purchase.status === 'COMPLETED' && isBuyer && (
            <div className="mt-6">
              <ReviewForm
                purchaseId={purchase.id}
                sellerName={purchase.seller?.user?.name || 'the seller'}
              />
            </div>
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
