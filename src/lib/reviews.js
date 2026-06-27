const TOKEN_STORAGE_KEY = 'resto_order_tokens';
const MAX_REVIEW_TOKENS = 20;

export const EMPTY_REVIEW_SUMMARY = {
  average_rating: null,
  review_count: 0,
};

export const getStoredOrderTokens = (storage = globalThis.localStorage) => {
  if (!storage?.getItem) return [];

  try {
    const rawValue = storage.getItem(TOKEN_STORAGE_KEY) || '[]';
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) return [];

    const tokens = parsed
      .map((entry) => (typeof entry === 'string' ? entry : entry?.token))
      .filter((token) => typeof token === 'string' && token.trim().length > 0)
      .map((token) => token.trim());

    return [...new Set(tokens)].slice(-MAX_REVIEW_TOKENS);
  } catch {
    return [];
  }
};

export const formatRating = (value) => {
  if (value == null || value === '') return '-';

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';

  return numeric.toFixed(1);
};

const normalizeReviewSummary = (summary) => ({
  average_rating:
    summary?.average_rating == null || summary?.average_rating === ''
      ? null
      : Number(summary.average_rating),
  review_count: Number.isFinite(Number(summary?.review_count))
    ? Number(summary.review_count)
    : 0,
});

export const mergeReviewSummaries = (restaurants, summaries) => {
  const summaryByRestaurant = new Map(
    (summaries || []).map((summary) => [summary.restaurant_id, normalizeReviewSummary(summary)])
  );

  return (restaurants || []).map((restaurant) => ({
    ...restaurant,
    reviewSummary: summaryByRestaurant.get(restaurant.id) || { ...EMPTY_REVIEW_SUMMARY },
  }));
};

export const mapReviewError = (errorMessageOrCode = '') => {
  const normalized = String(errorMessageOrCode).toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized.includes('invalid_order')) return 'invalidOrder';
  if (normalized.includes('order_not_paid')) return 'orderNotPaid';
  if (normalized.includes('phone_mismatch')) return 'phoneMismatch';
  if (normalized.includes('already_reviewed')) return 'alreadyReviewed';
  if (normalized.includes('invalid_rating')) return 'invalidRating';

  return 'genericError';
};
