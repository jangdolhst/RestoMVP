import { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n/index.js';

export const LOCATION_CACHE_KEY = 'jf_user_location_v2';
const GPS_CACHE_DURATION = 60 * 60 * 1000; // 1 hora
const IP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const EMPTY_LOCATION = {
  city: null,
  state: null,
  country: null,
  lat: null,
  lng: null,
};

/**
 * Calcula distancia entre dos puntos GPS usando formula de Haversine.
 * @returns Distancia en kilometros
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const toLocationState = (locationData) => ({
  city: locationData.city,
  state: locationData.state || '',
  country: locationData.country || null,
  lat: locationData.lat,
  lng: locationData.lng,
});

export const getUsableCachedLocation = (rawCache, now = Date.now()) => {
  if (!rawCache) return null;

  try {
    const cached = JSON.parse(rawCache);
    const isKnownSource = cached.source === 'gps' || cached.source === 'ip';
    const hasRequiredData =
      cached.city &&
      cached.timestamp &&
      isFiniteCoordinate(cached.lat) &&
      isFiniteCoordinate(cached.lng) &&
      isKnownSource;

    if (!hasRequiredData) return null;

    const cacheTtl = cached.source === 'ip' ? IP_CACHE_DURATION : GPS_CACHE_DURATION;
    if (now - cached.timestamp >= cacheTtl) return null;

    return {
      city: cached.city,
      state: cached.state || '',
      country: cached.country || null,
      lat: Number(cached.lat),
      lng: Number(cached.lng),
      source: cached.source,
      timestamp: cached.timestamp,
    };
  } catch {
    return null;
  }
};

const readCachedLocation = () => {
  try {
    return getUsableCachedLocation(localStorage.getItem(LOCATION_CACHE_KEY));
  } catch {
    return null;
  }
};

const saveCachedLocation = (locationData) => {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
  } catch {
    // Storage puede fallar en modo privado o por cuota; la ubicacion actual sigue siendo usable.
  }
};

/**
 * Obtiene la ubicacion aproximada via Vercel Geo Headers (IP-based).
 * Solo funciona en produccion/preview. En local devuelve null.
 */
const fetchIpGeo = async () => {
  try {
    const res = await fetch('/api/geo');
    if (!res.ok) return null;
    const data = await res.json();
    if (!isFiniteCoordinate(data.latitude) || !isFiniteCoordinate(data.longitude)) return null;
    return data;
  } catch {
    return null;
  }
};

const reverseGeocode = async (latitude, longitude) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`,
    { headers: { 'User-Agent': 'JammFree/1.0' } }
  );
  const data = await response.json();

  return {
    city:
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.address?.county ||
      i18n.t('location.fallbackPrecise'),
    state: data.address?.state || '',
    country: data.address?.country_code?.toUpperCase() || null,
  };
};

const getBrowserPosition = () =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

/**
 * useCityDetection - Hook que detecta la ubicacion del usuario.
 *
 * Estrategia:
 *   1. Carga cache fresca (GPS o IP) si existe.
 *   2. Si no hay cache, consulta /api/geo sin pedir permisos.
 *   3. Solo pide GPS cuando el usuario ejecuta requestPreciseLocation().
 *
 * Retorna: { city, state, country, lat, lng, isLoading, error, source, retry,
 *            requestPreciseLocation, refreshApproximateLocation }
 *   - source: 'gps' | 'ip' | null
 */
const useCityDetection = () => {
  const [location, setLocation] = useState(EMPTY_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const applyLocation = useCallback((locationData) => {
    setLocation(toLocationState(locationData));
    setSource(locationData.source);
  }, []);

  const refreshApproximateLocation = useCallback(async ({ forceRefresh = false } = {}) => {
    setIsLoading(true);
    setError(null);

    if (!forceRefresh) {
      const cached = readCachedLocation();
      if (cached) {
        applyLocation(cached);
        setIsLoading(false);
        return cached;
      }
    }

    const ipGeo = await fetchIpGeo();
    if (ipGeo) {
      const locationData = {
        city: ipGeo.city || i18n.t('location.fallbackApproximate'),
        state: ipGeo.countryRegion || '',
        country: ipGeo.country || null,
        lat: Number(ipGeo.latitude),
        lng: Number(ipGeo.longitude),
        source: 'ip',
        timestamp: Date.now(),
      };
      saveCachedLocation(locationData);
      applyLocation(locationData);
      setIsLoading(false);
      return locationData;
    }

    setLocation(EMPTY_LOCATION);
    setSource(null);
    setError(i18n.t('location.errors.approximateUnavailable'));
    setIsLoading(false);
    return null;
  }, [applyLocation]);

  const requestPreciseLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError(i18n.t('location.errors.gpsUnsupported'));
      setIsLoading(false);
      return null;
    }

    try {
      const position = await getBrowserPosition();
      const { latitude, longitude } = position.coords;
      let place = { city: i18n.t('location.fallbackPrecise'), state: '', country: null };

      try {
        place = await reverseGeocode(latitude, longitude);
      } catch {
        // Si Nominatim falla, las coordenadas GPS siguen siendo precisas y utiles.
      }

      const locationData = {
        ...place,
        lat: latitude,
        lng: longitude,
        source: 'gps',
        timestamp: Date.now(),
      };
      saveCachedLocation(locationData);
      applyLocation(locationData);
      setIsLoading(false);
      return locationData;
    } catch (geoError) {
      setError(
        geoError?.code === 1
          ? i18n.t('location.errors.gpsDenied')
          : i18n.t('location.errors.preciseUnavailable')
      );
      setIsLoading(false);
      return null;
    }
  }, [applyLocation]);

  useEffect(() => {
    refreshApproximateLocation();
  }, [refreshApproximateLocation]);

  const retry = useCallback(
    () => refreshApproximateLocation({ forceRefresh: true }),
    [refreshApproximateLocation]
  );

  return {
    ...location,
    isLoading,
    error,
    source,
    retry,
    requestPreciseLocation,
    refreshApproximateLocation: retry,
  };
};

export default useCityDetection;
