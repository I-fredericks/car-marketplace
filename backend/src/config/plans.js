// Starter billing strategy (pre-payment-gateway):
// Sellers pay via Mobile Money to the platform number, then an admin
// verifies the payment in the dashboard. Verification applies the plan.

const PLANS = {
  BASIC: {
    key: 'BASIC',
    label: 'Starter',
    description: 'Up to 5 active listings for 30 days. Perfect for individual sellers.',
    price: 50,
    durationDays: 30,
    listings: 5,
    type: 'subscription',
  },
  PLUS: {
    key: 'PLUS',
    label: 'Plus',
    description: 'Up to 10 active listings for 30 days. For active private sellers.',
    price: 100,
    durationDays: 30,
    listings: 10,
    type: 'subscription',
  },
  DEALER_BASIC: {
    key: 'DEALER_BASIC',
    label: 'Dealer Basic',
    description: 'Up to 50 active listings per month. Ideal for small dealerships.',
    price: 300,
    durationDays: 30,
    listings: 50,
    type: 'subscription',
  },
  DEALER_PRO: {
    key: 'DEALER_PRO',
    label: 'Dealer Pro',
    description: 'Unlimited active listings plus priority support. For established dealerships.',
    price: 500,
    durationDays: 30,
    listings: null, // unlimited
    type: 'subscription',
  },
};

const FREE_TIER = {
  key: 'FREE',
  label: 'Free',
  description: 'Up to 1 active listing at no cost.',
  price: 0,
  listings: 1,
};

// Higher tier = higher search ranking for that seller's listings
const PLAN_RANK = {
  BASIC: 1,
  PLUS: 2,
  DEALER_BASIC: 3,
  DEALER_PRO: 4,
};

// Listing allowance for a given plan key (null = unlimited, 0 = not a subscription)
function getListingLimit(planKey) {
  if (!planKey) return FREE_TIER.listings;
  const plan = PLANS[planKey];
  if (!plan) return FREE_TIER.listings;
  return plan.listings ?? null;
}

// Ranking weight for a given plan key (free/unknown = 0)
function getPlanRank(planKey) {
  return PLAN_RANK[planKey] || 0;
}

// Where sellers send Mobile Money payments
const MOMO = {
  number: '0536385829',
  network: 'MTN Mobile Money',
  name: 'CarMarket Ghana',
};

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CM-${code}`;
}

module.exports = { PLANS, FREE_TIER, MOMO, generateReference, getListingLimit, getPlanRank };
