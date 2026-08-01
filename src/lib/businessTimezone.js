export const DEFAULT_BUSINESS_TIMEZONE = 'America/Tijuana';

export const SUPPORTED_BUSINESS_TIMEZONES = [
  'America/Tijuana',
  'America/Mexico_City',
  'America/Cancun',
  'America/Hermosillo',
  'America/Mazatlan',
];

const SUPPORTED_TIMEZONE_SET = new Set(SUPPORTED_BUSINESS_TIMEZONES);

const isFiniteCoordinate = (value) => (
  typeof value === 'number' && Number.isFinite(value)
);

export const normalizeBusinessTimeZone = (value, fallback = DEFAULT_BUSINESS_TIMEZONE) => {
  if (typeof value === 'string' && SUPPORTED_TIMEZONE_SET.has(value)) {
    return value;
  }

  if (typeof fallback === 'string' && SUPPORTED_TIMEZONE_SET.has(fallback)) {
    return fallback;
  }

  return DEFAULT_BUSINESS_TIMEZONE;
};

export const deriveBusinessTimeZone = (latitude, longitude, fallback = DEFAULT_BUSINESS_TIMEZONE) => {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
    return normalizeBusinessTimeZone(fallback);
  }

  if (longitude >= -88.8 && longitude <= -86.5 && latitude >= 17.5 && latitude <= 22.8) {
    return 'America/Cancun';
  }

  if (longitude >= -118 && longitude <= -112 && latitude >= 28 && latitude <= 33.5) {
    return 'America/Tijuana';
  }

  if (longitude > -112 && longitude <= -108 && latitude >= 26 && latitude <= 33.5) {
    return 'America/Hermosillo';
  }

  if (longitude >= -116 && longitude <= -104 && latitude >= 20 && latitude < 28) {
    return 'America/Mazatlan';
  }

  if (longitude >= -118 && longitude <= -86 && latitude >= 14 && latitude <= 33.5) {
    return 'America/Mexico_City';
  }

  return normalizeBusinessTimeZone(fallback);
};
