import React from 'react';
import { Link } from 'react-router-dom';
import useSEO from '../hooks/useSEO';
import {
  ShieldCheck, Lock, Handshake, Scale, TrendingDown, AlertTriangle,
  CheckCircle, Search, CreditCard,
} from 'lucide-react';

/**
 * Public Buyer Protection Guarantee page: the trust pitch that separates
 * CarMarket from classifieds. Every claim below is backed by shipped
 * mechanics — escrow hold, 1% fee, dispute mediation, condition facts.
 */
const BuyerProtection = () => {
  useSEO({
    title: 'Buyer Protection Guarantee',
    description: 'Your money is held in escrow until you confirm you have the car. If anything goes wrong, CarMarket Ghana mediates and refunds.',
  });

  const steps = [
    {
      icon: Lock,
      title: '1 · You pay into escrow',
      body: 'Your money goes to CarMarket Ghana\'s account — never directly to the seller. Bank transfer and MoMo keep it flat-fee; we take just 1% when the sale completes.',
    },
    {
      icon: Search,
      title: '2 · You inspect the car',
      body: 'Sellers declare structured condition facts (no known faults, first owner, registered, trade-in). Meet, inspect, test-drive — your money is still locked.',
    },
    {
      icon: Handshake,
      title: '3 · Handover, then you confirm',
      body: 'The seller marks the handover in the system. Only when YOU slide to confirm receipt does the money move — minus our 1% — to the seller.',
    },
    {
      icon: Scale,
      title: '4 · Problem? Open a dispute',
      body: 'Car not as described? Deal went sideways? Open a dispute right on the order — the funds freeze instantly and our team mediates: refund to you, or release to the seller. Every decision is logged.',
    },
  ];

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <ShieldCheck size={16} /> The CarMarket Guarantee
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-textprimary leading-tight mb-3">
            Buying a car shouldn't mean handing <span className="text-primary">GH₵100,000 to a stranger</span>
          </h1>
          <p className="text-textsecondary text-lg max-w-2xl mx-auto leading-relaxed">
            On every other site you meet a seller, pay cash, and pray. On CarMarket Ghana your money is held
            in escrow until the car is in your hands — and if anything goes wrong, we step in.
          </p>
        </div>

        {/* How protection works */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-surface border border-bordercol rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon size={20} className="text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg text-textprimary mb-2">{title}</h3>
              <p className="text-sm text-textsecondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Covered / not covered */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <div className="bg-surface border border-success/25 rounded-xl p-6">
            <h3 className="font-display font-semibold text-lg text-success mb-4 flex items-center gap-2">
              <CheckCircle size={18} /> Covered by the guarantee
            </h3>
            <ul className="space-y-2.5 text-sm text-textsecondary">
              <li className="flex gap-2"><CheckCircle size={15} className="text-success flex-shrink-0 mt-0.5" /> Car not matching the listing or declared condition facts</li>
              <li className="flex gap-2"><CheckCircle size={15} className="text-success flex-shrink-0 mt-0.5" /> Seller never hands over the car after payment</li>
              <li className="flex gap-2"><CheckCircle size={15} className="text-success flex-shrink-0 mt-0.5" /> Funds frozen the moment a dispute opens — seller can't get paid past it</li>
              <li className="flex gap-2"><CheckCircle size={15} className="text-success flex-shrink-0 mt-0.5" /> Full refund resolved by CarMarket when the claim holds</li>
            </ul>
          </div>
          <div className="bg-surface border border-warn/30 rounded-xl p-6">
            <h3 className="font-display font-semibold text-lg text-warn mb-4 flex items-center gap-2">
              <AlertTriangle size={18} /> Not covered
            </h3>
            <ul className="space-y-2.5 text-sm text-textsecondary">
              <li className="flex gap-2"><TrendingDown size={15} className="text-warn flex-shrink-0 mt-0.5" /> Mechanical faults that appear AFTER you confirmed receipt — inspect before you slide</li>
              <li className="flex gap-2"><TrendingDown size={15} className="text-warn flex-shrink-0 mt-0.5" /> Cash-at-handover deals: they happen outside the platform, no funds to freeze</li>
              <li className="flex gap-2"><TrendingDown size={15} className="text-warn flex-shrink-0 mt-0.5" /> False condition claims YOU make as a seller — that voids your side of the guarantee</li>
            </ul>
          </div>
        </div>

        {/* Cost strip */}
        <div className="bg-primary rounded-xl p-6 sm:p-8 mb-12 text-center">
          <CreditCard size={28} className="text-accent mx-auto mb-3" />
          <h3 className="font-display font-bold text-2xl text-white mb-2">All of this costs the buyer nothing at checkout</h3>
          <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed">
            Escrow, mediation and refunds are part of every order. Sellers pay a flat
            <span className="text-accent font-bold"> 1% </span>
            platform fee only when the sale completes — no card-gateway percentages, no hidden charges.
          </p>
        </div>

        <div className="text-center">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-textprimary font-bold rounded-md hover:bg-accentdark transition-colors"
          >
            Browse protected cars
          </Link>
          <p className="text-xs text-textmuted mt-4">
            Guarantee applies to orders paid through CarMarket escrow (bank transfer / Mobile Money).
          </p>
        </div>
      </div>
    </div>
  );
};

export default BuyerProtection;
