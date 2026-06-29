export const FREE_FEATURES = {
  receiveOrders: 'receiveOrders',
  manualOrders: 'manualOrders',
  kitchen: 'kitchen',
  menuManagement: 'menuManagement',
  basicSettings: 'basicSettings',
  paymentStatus: 'paymentStatus',
};

export const PREMIUM_FEATURES = {
  printTickets: 'printTickets',
  fiscalData: 'fiscalData',
  taxBreakdown: 'taxBreakdown',
  financialCalendar: 'financialCalendar',
  paymentHistory: 'paymentHistory',
  cashClosure: 'cashClosure',
};

const FREE_FEATURE_SET = new Set(Object.values(FREE_FEATURES));
const PREMIUM_FEATURE_SET = new Set(Object.values(PREMIUM_FEATURES));

export const isSubscriptionActive = (subscriptionData, now = new Date()) => {
  if (!subscriptionData) return false;

  if (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') {
    return true;
  }

  if (!subscriptionData.current_period_end) return false;

  const periodEnd = new Date(subscriptionData.current_period_end);
  return Number.isFinite(periodEnd.getTime()) && periodEnd > now;
};

export const hasFeature = (subscriptionData, feature) => {
  if (FREE_FEATURE_SET.has(feature)) return true;
  if (!PREMIUM_FEATURE_SET.has(feature)) return false;
  return isSubscriptionActive(subscriptionData);
};
