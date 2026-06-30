const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export const getElapsedOrderAge = (createdAt, now = new Date()) => {
  const createdDate = new Date(createdAt);
  const nowDate = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(createdDate.getTime()) || Number.isNaN(nowDate.getTime())) {
    return { unit: 'minutes', count: 0, totalMinutes: 0 };
  }

  const totalMinutes = Math.max(0, Math.floor((nowDate - createdDate) / 60000));

  if (totalMinutes >= MINUTES_PER_DAY) {
    return {
      unit: 'days',
      count: Math.floor(totalMinutes / MINUTES_PER_DAY),
      totalMinutes,
    };
  }

  if (totalMinutes >= MINUTES_PER_HOUR) {
    return {
      unit: 'hours',
      count: Math.floor(totalMinutes / MINUTES_PER_HOUR),
      totalMinutes,
    };
  }

  return { unit: 'minutes', count: totalMinutes, totalMinutes };
};
