// Derive the seller's active plan key from a vehicle row's nested subscription
export const getActiveSellerPlan = (vehicle) => {
  const sub = vehicle?.seller?.user?.subscription;
  if (!sub || sub.status !== 'ACTIVE' || !sub.periodEnd) return null;
  if (new Date(sub.periodEnd) <= new Date()) return null;
  return sub.plan;
};

// Badge label for dealer-tier sellers shown on listing cards
export const getSellerPlanBadge = (vehicle) => {
  const plan = getActiveSellerPlan(vehicle);
  if (plan === 'DEALER_PRO') return 'Top Dealer';
  if (plan === 'DEALER_BASIC') return 'Dealer';
  return null;
};
