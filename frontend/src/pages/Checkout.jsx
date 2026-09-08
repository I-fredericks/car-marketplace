import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { ShieldCheck, MapPin, Truck, CreditCard, Banknote, Loader2 } from 'lucide-react';

/**
 * Checkout for a vehicle purchase (escrow).
 * Online payment escrows with the platform until the buyer confirms receipt;
 * cash orders lock the car and settle at handover. The vehicle is RESERVED
 * the moment the order is created so nobody else can buy it mid-checkout.
 */
const Checkout = () => {
  const { vehicleId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [deliveryMode, setDeliveryMode] = useState('PICKUP');
  const [method, setMethod] = useState('PAYSTACK');
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

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user || isLoading) {
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
        method,
        deliveryMode,
        phone: phone || undefined,
        address: deliveryMode === 'DELIVERY' ? address : undefined,
        notes: notes || undefined,
      });
      const purchase = data.purchase;

      if (method === 'CASH') {
        navigate(`/purchases/${purchase.id}?new=1`);
        return;
      }

      // Online: send the buyer to Paystack, callback lands on the purchase page
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

          {/* Payment method */}
          <h3 className="font-semibold text-textprimary mb-3">Payment method</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              {
                key: 'PAYSTACK', icon: CreditCard, label: 'Pay online (escrow)',
                hint: 'Card or MoMo. We hold the money until you confirm you have the car.',
              },
              {
                key: 'CASH', icon: Banknote, label: 'Cash at handover',
                hint: 'We reserve the car for you; you pay the seller directly when you get it.',
              },
            ].map(({ key, icon: Icon, label, hint }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={`text-left p-4 rounded-lg border-2 transition-colors ${
                  method === key ? 'border-primary bg-primary/5' : 'border-bordercol hover:border-textmuted'
                }`}
              >
                <Icon size={20} className={method === key ? 'text-primary' : 'text-textmuted'} />
                <div className="font-medium text-textprimary mt-2">{label}</div>
                <div className="text-xs text-textsecondary mt-1">{hint}</div>
              </button>
            ))}
          </div>

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
            disabled={placing}
            className="w-full py-3.5 bg-accent text-textprimary font-bold rounded-md hover:bg-accentdark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {placing && <Loader2 size={18} className="animate-spin" />}
            {method === 'PAYSTACK' ? `Pay GH₵${Number(car.price).toLocaleString()} securely` : 'Reserve this car'}
          </button>

          <p className="mt-4 text-xs text-textsecondary flex items-start gap-2">
            <ShieldCheck size={14} className="text-success flex-shrink-0 mt-0.5" />
            {method === 'PAYSTACK'
              ? 'Escrow protected: CarMarket holds your payment and only releases it to the seller after you confirm you have received the car.'
              : 'Cash orders are a reservation — you can cancel anytime before handover and the car goes back on sale instantly.'}
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
            <span className="font-display font-bold text-xl text-textprimary">
              GH₵{Number(car.price).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
