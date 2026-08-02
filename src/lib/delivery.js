export const DELIVERY_SERVICE_MODES = ['pickup_only', 'delivery_only', 'pickup_and_delivery'];
export const DELIVERY_FEE_MODES = ['free', 'fixed', 'per_km', 'manual'];

const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const nonNegativeNumber = (value, decimals = 2, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? round(Math.max(0, number), decimals) : fallback;
};

const nullableNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? round(number, decimals) : null;
};

export const normalizeDeliverySettings = (profile = {}) => ({
  delivery_service_mode: DELIVERY_SERVICE_MODES.includes(profile.delivery_service_mode)
    ? profile.delivery_service_mode
    : 'pickup_only',
  delivery_fee_mode: DELIVERY_FEE_MODES.includes(profile.delivery_fee_mode)
    ? profile.delivery_fee_mode
    : 'manual',
  delivery_fixed_fee_mxn: nonNegativeNumber(profile.delivery_fixed_fee_mxn),
  delivery_base_fee_mxn: nonNegativeNumber(profile.delivery_base_fee_mxn),
  delivery_fee_per_km_mxn: nonNegativeNumber(profile.delivery_fee_per_km_mxn),
  delivery_max_distance_km: nullableNumber(profile.delivery_max_distance_km, 1),
  delivery_min_order_mxn: nullableNumber(profile.delivery_min_order_mxn),
  delivery_eta_min_minutes: nullableNumber(profile.delivery_eta_min_minutes),
  delivery_eta_max_minutes: nullableNumber(profile.delivery_eta_max_minutes),
});

export const canUseFulfillment = (settings, fulfillmentType) => {
  const mode = normalizeDeliverySettings(settings).delivery_service_mode;
  if (fulfillmentType === 'pickup') return mode !== 'delivery_only';
  if (fulfillmentType === 'delivery') return mode !== 'pickup_only';
  return false;
};

export const calculateDistanceKm = (from, to) => {
  const values = [from?.latitude, from?.longitude, to?.latitude, to?.longitude].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;

  const [fromLatitude, fromLongitude, toLatitude, toLongitude] = values;
  const earthRadiusKm = 6371;
  const latitudeDelta = (toLatitude - fromLatitude) * Math.PI / 180;
  const longitudeDelta = (toLongitude - fromLongitude) * Math.PI / 180;
  const latitude1 = fromLatitude * Math.PI / 180;
  const latitude2 = toLatitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

  return round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)), 1);
};

export const calculateDeliveryFee = (settings, distanceKm) => {
  const normalized = normalizeDeliverySettings(settings);
  const distance = nullableNumber(distanceKm, 1);

  if (normalized.delivery_max_distance_km !== null
    && distance !== null
    && distance > normalized.delivery_max_distance_km) {
    return { fee: null, distanceKm: distance, status: 'not_applicable', reason: 'outside_delivery_radius' };
  }

  if (normalized.delivery_fee_mode === 'per_km' && distance === null) {
    return { fee: null, distanceKm: null, status: 'not_applicable', reason: 'distance_required' };
  }

  if (normalized.delivery_fee_mode === 'manual') {
    return { fee: null, distanceKm: distance, status: 'pending_manual', reason: 'manual_fee_required' };
  }

  const fee = normalized.delivery_fee_mode === 'free'
    ? 0
    : normalized.delivery_fee_mode === 'fixed'
      ? normalized.delivery_fixed_fee_mxn
      : normalized.delivery_base_fee_mxn + (normalized.delivery_fee_per_km_mxn * distance);

  return { fee: round(fee, 2), distanceKm: distance, status: 'confirmed', reason: null };
};
