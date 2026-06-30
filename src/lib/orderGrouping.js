const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const toLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const startOfLocalDay = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getLocalDayDiff = (value, now = new Date()) => {
  const orderDay = startOfLocalDay(value);
  const today = startOfLocalDay(now);
  if (!orderDay || !today) return null;
  return Math.floor((today - orderDay) / MS_PER_DAY);
};

export const getOrderAgeMeta = (value, now = new Date()) => {
  const dayDiff = getLocalDayDiff(value, now);

  if (dayDiff == null) {
    return { key: 'unknown', dayDiff: null, tone: 'slate' };
  }

  if (dayDiff <= 0) {
    return { key: 'today', dayDiff, tone: 'emerald' };
  }

  if (dayDiff === 1) {
    return { key: 'yesterday', dayDiff, tone: 'amber' };
  }

  if (dayDiff >= 7) {
    return { key: 'veryOld', dayDiff, tone: 'red' };
  }

  return { key: 'old', dayDiff, tone: 'orange' };
};

export const groupOrdersByBusinessDate = (orders, now = new Date()) => {
  const groups = new Map();

  for (const order of orders) {
    const createdAt = order.createdAt || order.created_at;
    const key = toLocalDateKey(createdAt);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        createdAt,
        age: getOrderAgeMeta(createdAt, now),
        orders: [],
      });
    }
    groups.get(key).orders.push(order);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      orders: [...group.orders].sort((a, b) => (
        new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
      )),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getStaleOrders = (orders, now = new Date()) =>
  orders.filter((order) => getOrderAgeMeta(order.createdAt || order.created_at, now).key === 'veryOld');
