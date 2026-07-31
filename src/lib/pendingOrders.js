export const PENDING_CONFIRMATION_TIMEOUT_MINUTES = 15;

export const getPendingConfirmationAgeMinutes = (createdAt, now = new Date()) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 0;
  return Math.floor((now - createdDate) / 60000);
};

export const isPendingConfirmationExpired = (createdAt, now = new Date()) =>
  (() => {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return false;
    return (now - createdDate) > PENDING_CONFIRMATION_TIMEOUT_MINUTES * 60000;
  })();

export const splitPendingConfirmationOrders = (orders, now = new Date()) => {
  const fresh = [];
  const expired = [];

  for (const order of orders || []) {
    const minutesElapsed = getPendingConfirmationAgeMinutes(order.created_at || order.createdAt, now);
    const orderWithAge = { ...order, minutesElapsed };

    if (isPendingConfirmationExpired(order.created_at || order.createdAt, now)) {
      expired.push(orderWithAge);
    } else {
      fresh.push(orderWithAge);
    }
  }

  return { fresh, expired };
};
