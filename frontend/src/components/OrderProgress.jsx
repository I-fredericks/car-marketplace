import React from 'react';
import { Check, ShoppingBag, ShieldCheck, Handshake, Flag } from 'lucide-react';

/**
 * Order progress tracker (AliExpress-style). Steps map to escrow and cash
 * flows. The Handover lamp lights either from the cash flow's DELIVERED
 * status or the escrow flow's sellerHandoverAt mark. Cancelled/refunded
 * orders show a red banner instead.
 */
const STEPS = [
  { key: 'ordered', label: 'Ordered', icon: ShoppingBag },
  { key: 'paid', label: 'Paid / Held', icon: ShieldCheck },
  { key: 'handover', label: 'Handover', icon: Handshake },
  { key: 'done', label: 'Completed', icon: Flag },
];

const STATUS_INDEX = {
  AWAITING_PAYMENT: 0,
  HANDOVER_PENDING: 1,
  PAID_HELD: 1,
  DELIVERED: 2,
  COMPLETED: 3,
  CANCELLED: -1,
  REFUNDED: -1,
};

const CANCELLED_LABEL = { CANCELLED: 'Order cancelled', REFUNDED: 'Order refunded' };

const OrderProgress = ({ status, handoverMarked }) => {
  const current = STATUS_INDEX[status] ?? 0;

  if (current < 0) {
    return (
      <div className="mb-6 rounded-lg border border-err/25 bg-err/5 px-4 py-3 text-sm font-medium text-err">
        {CANCELLED_LABEL[status] || 'Order closed'}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < current || (i === current && status === 'COMPLETED')
            || (step.key === 'handover' && handoverMarked && current >= 1 && current < 3);
          const active = i === current && status !== 'COMPLETED'
            && !(step.key === 'handover' && handoverMarked);
          const Icon = step.icon;
          return (
            <React.Fragment key={step.key}>
              {/* Connector line between steps */}
              {i > 0 && (
                <div className={`flex-1 h-0.5 mt-5 rounded ${i <= current ? 'bg-success' : 'bg-bordercol'}`} />
              )}
              <div className="flex flex-col items-center w-14 sm:w-16 shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    done
                      ? 'bg-success border-success text-white'
                      : active
                        ? 'bg-primary border-primary text-white shadow-[0_0_0_4px_rgba(27,42,74,0.15)]'
                        : 'bg-bg border-bordercol text-textmuted'
                  }`}
                >
                  {done && i !== current ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <span className={`mt-1.5 text-[10px] sm:text-[11px] text-center font-medium leading-tight ${
                  active ? 'text-primary font-bold' : done ? 'text-success' : 'text-textmuted'
                }`}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default OrderProgress;
