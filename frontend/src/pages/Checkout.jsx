import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { ShieldCheck, MapPin, Truck, CreditCard, Loader2, Banknote, AlertTriangle } from 'lucide-react';

/**
 * Checkout for a vehicle purchase (escrow).
 * Online payment escrows with the platform until the buyer confirms receipt;
 * cash orders lock the car and settle at handover. The vehicle is RESERVED
 * the moment the order is created so nobody else can buy it mid-checkout.
 */
const Checkout = () => {
  const { vehicleId } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  const [deliveryMode, setDeliveryMode] = useState('PICKUP');
  // PAYSTACK first: money is escrowed by the platform (AliExpress-style).
  // CASH stays available but OUTSIDE the site — buyer acknowledges there's
  // no refund or protection if the deal goes wrong (backend guards, not us).
  const [payMode, setPayMode] = useState('PAYSTACK');
  const [cashAck, setCashAck] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const { data: car, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data } = await api.get(`/vehicles/${vehicleId}`);
      return data;
    },
    retry: false,
    enabled: Boolean(user),
  });

  // A negotiated price (accepted offer) overrides the asking price
  // for this buyer only — checkout shows it and orders at it.
  const { data: agreed } = useQuery({
    queryKey: ['payable-price', vehicleId],
    queryFn: async () => {
      const { data } = await api.get(`/offers/price/${vehicleId}`);
      return data;
    },
    retry: false,
    enabled: Boolean(user),
  });
  const payableGhs = agreed?.agreedPesewas != null
    ? agreed.agreedPesewas / 100
    : car ? Number(car.price) : null;

  // Wait for the auth bootstrap (/auth/me) before redirecting — a plain
  // refresh starts with user=null, and bouncing to /login here flashes it.
  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  if (authLoading || !user || isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex items-center justify-center bg-bg">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg">
        <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Vehicle unavailable</h2>
        <Link to="/search" className="text-primary font-medium hover:underline">Back to search</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    setPlacing(true);
    setError('');
    try {
      const { data } = await api.post('/purchases', {
        vehicleId: car.id,
        method: payMode === 'CASH' ? 'CASH' : 'PAYSTACK',
        deliveryMode,
        phone: phone || undefined,
        address: deliveryMode === 'DELIVERY' ? address : undefined,
        notes: notes || undefined,
      });
      const purchase = data.purchase;

      if (payMode === 'CASH') {
        navigate(`/purchases/${purchase.id}?new=1`);
        return;
      }

      // Send the buyer to Paystack; callback lands back on the order page
      const { data: init } = await api.post(`/purchases/${purchase.id}/initialize`, {
        callbackUrl: `${window.location.origin}/purchases/${purchase.id}?paid=1`,
      });
      window.location.href = init.authorizationUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the purchase. Try again.');
      setPlacing(false);
    }
  };

  const primaryImg = car.images?.find((i) => i.isPrimary) || car.images?.[0];

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto grid md:grid-cols-[1fr,380px] gap-6">

        {/* Order form */}
        <div className="bg-surface border border-bordercol rounded-xl p-6 shadow-sm">
          <h1 className="font-display font-bold text-2xl text-textprimary mb-6">Complete your purchase</h1>

          {/* Delivery mode */}
          <h3 className="font-semibold text-textprimary mb-3">How will you get the car?</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { key: 'PICKUP', icon: MapPin, label: 'Pick it up', hint: 'Meet the seller at an agreed spot' },
              { key: 'DELIVERY', icon: Truck, label: 'Delivered to me', hint: 'The seller arranges delivery' },
            ].map(({ key, icon: Icon, label, hint }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDeliveryMode(key)}
                className={`text-left p-4 rounded-lg border-2 transition-colors ${
                  deliveryMode === key ? 'border-primary bg-primary/5' : 'border-bordercol hover:border-textmuted'
                }`}
              >
                <Icon size={20} className={deliveryMode === key ? 'text-primary' : 'text-textmuted'} />
                <div className="font-medium text-textprimary mt-2">{label}</div>
                <div className="text-xs text-textsecondary mt-1">{hint}</div>
              </button>
            ))}
          </div>

          {deliveryMode === 'DELIVERY' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-textprimary mb-1">Delivery address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area, city"
                className="w-full border border-bordercol rounded-md px-3 py-2.5 text-textprimary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Contact */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-textprimary mb-1">Phone number (seller contacts you on this)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="024 000 0000"
              className="w-full border border-bordercol rounded-md px-3 py-2.5 text-textprimary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Payment — escrow first, cash (outside platform) with a hard disclaimer */}
          <h3 className="font-semibold text-textprimary mb-3">Payment</h3>
          <div className="grid grid-cols-1 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setPayMode('PAYSTACK')}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                payMode === 'PAYSTACK' ? 'border-primary bg-primary/5' : 'border-bordercol hover:border-textmuted'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={20} className={payMode === 'PAYSTACK' ? 'text-primary' : 'text-textmuted'} />
                <span className="font-medium text-textprimary">Pay online — card or Mobile Money</span>
                <span className="ml-auto px-2 py-0.5 bg-success/10 text-success rounded-full text-[10px] font-bold">Recommended</span>
              </div>
              <p className="text-xs text-textsecondary leading-relaxed">
                Your payment is held by CarMarket Ghana in escrow and only released to the seller after you confirm you have the car.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPayMode('CASH')}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                payMode === 'CASH' ? 'border-warn bg-warn/5' : 'border-bordercol hover:border-textmuted'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Banknote size={20} className={payMode === 'CASH' ? 'text-warn' : 'text-textmuted'} />
                <span className="font-medium text-textprimary">Pay cash at handover</span>
              </div>
              <p className="text-xs text-textsecondary leading-relaxed">
                We reserve the car for you; you pay the seller in person.
              </p>
            </button>
          </div>

          {payMode === 'CASH' && (
            <div className="mb-6 border-2 border-warn/40 bg-warn/5 rounded-lg p-4">
              <h4 className="font-bold text-textprimary text-sm mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-warn" /> No platform protection for cash deals
              </h4>
              <ul className="text-xs text-textsecondary leading-relaxed space-y-1.5 list-disc list-inside">
                <li>Cash payments happen <span className="font-semibold">outside</span> CarMarket Ghana.</li>
                <li>If anything goes wrong — fraud, a bad car, a fake seller — <span className="font-semibold">we cannot refund or recover your money.</span> You take full responsibility for the deal.</li>
                <li>Meet in a public place, inspect the car and its documents thoroughly, and count the cash yourself.</li>
              </ul>
              <label className="mt-3 flex items-start gap-2 text-xs font-medium text-textprimary cursor-pointer">
                <input
                  type="checkbox"
                  checked={cashAck}
                  onChange={(e) => setCashAck(e.target.checked)}
                  className="mt-0.5 accent-warn"
                />
                I understand cash deals carry no platform refund or protection.
              </label>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-textprimary mb-1">Note to seller (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the seller should know — preferred time, questions…"
              className="w-full border border-bordercol rounded-md px-3 py-2.5 text-textprimary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {error && (
            <p className="mb-4 text-sm text-err font-medium" role="alert">{error}</p>
          )}

          <button
            onClick={placeOrder}
            disabled={placing || (payMode === 'CASH' && !cashAck)}
            className="w-full py-3.5 bg-accent text-textprimary font-bold rounded-md hover:bg-accentdark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {placing && <Loader2 size={18} className="animate-spin" />}
            {payMode === 'PAYSTACK'
              ? `Pay GH₵${Number(payableGhs ?? car.price).toLocaleString()} securely`
              : 'Reserve this car (cash)'}
          </button>

          <p className="mt-4 text-xs text-textsecondary flex items-start gap-2">
            <ShieldCheck size={14} className="text-success flex-shrink-0 mt-0.5" />
            {payMode === 'PAYSTACK'
              ? 'Escrow protected — like AliExpress: your money stays with CarMarket until you confirm receipt. If anything goes wrong before that, you get a refund.'
              : 'Cash reservation: the car is held for you, but the handover deal is between you and the seller — no platform protection.'}
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-surface border border-bordercol rounded-xl p-6 shadow-sm h-fit md:sticky md:top-24">
          <h3 className="font-display font-semibold text-lg text-textprimary mb-4">Order summary</h3>
          {primaryImg && (
            <img
              src={getImageUrl(primaryImg)}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="w-full h-40 object-cover rounded-md mb-4"
            />
          )}
          <div className="font-medium text-textprimary">{car.year} {car.make} {car.model}</div>
          <div className="text-sm text-textsecondary flex items-center gap-1 mt-1">
            <MapPin size={13} /> {car.location}
          </div>
          <div className="border-t border-bordercol mt-4 pt-4 flex items-center justify-between">
            <span className="text-textsecondary">Total</span>
            <div className="text-right">
              {agreed?.agreedPesewas != null && (
                <span className="block text-xs text-success font-semibold">Your negotiated price</span>
              )}
              <span className="font-display font-bold text-xl text-textprimary">
                GH₵{Number(payableGhs ?? car.price).toLocaleString()}
              </span>
              {agreed?.agreedPesewas != null && (
                <span className="block text-xs text-textmuted line-through">
                  GH₵{Number(car.price).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
