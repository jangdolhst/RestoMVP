import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'jf_user_location';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

/**
 * Calcula distancia entre dos puntos GPS usando fórmula de Haversine.
 * @returns Distancia en kilómetros
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

/**
 * Obtiene la ubicación aproximada via Vercel Geo Headers (IP-based).
 * Solo funciona en producción. En local devuelve null.
 */
const fetchIpGeo = async () => {
  try {
    const res = await fetch('/api/geo');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.latitude || !data.longitude) return null;
    return data;
  } catch {
    return null;
  }
};

/**
 * useCityDetection — Hook que detecta la ciudad del usuario.
 * 
 * Estrategia de detección (waterfall):
 *   1. Cache local (localStorage, 1 hora)
 *   2. GPS del navegador + Nominatim reverse geocoding
 *   3. Fallback: Vercel Geo Headers (IP-based, via /api/geo)
 *
 * Retorna: { city, state, country, lat, lng, isLoading, error, source, retry }
 *   - source: 'cache' | 'gps' | 'ip' | null
 */
const useCityDetection = () => {
  const [location, setLocation] = useState({
    city: null,
    state: null,
    country: null,
    lat: null,
    lng: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const detectCity = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // --- PASO 1: Verificar cache ---
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (cached.city && cached.timestamp && Date.now() - cached.timestamp < CACHE_DURATION) {
        setLocation({
          city: cached.city,
          state: cached.state,
          country: cached.country || null,
          lat: cached.lat,
          lng: cached.lng,
        });
        setSource(cached.source || 'cache');
        setIsLoading(false);
        return;
      }
    } catch {
      // Cache corrupto, continuar
    }

    // --- PASO 2: Intentar GPS ---
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000, // Cache GPS por 5 min
          });
        });

        const { latitude, longitude } = position.coords;

        // Reverse geocoding con Nominatim
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`,
            { headers: { 'User-Agent': 'JammFree/1.0' } }
          );
          const data = await response.json();

          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            data.address?.county ||
            'Tu ubicación';
          const state = data.address?.state || '';
          const country = data.address?.country_code?.toUpperCase() || null;

          const locationData = { city, state, country, lat: latitude, lng: longitude, source: 'gps', timestamp: Date.now() };
          localStorage.setItem(CACHE_KEY, JSON.stringify(locationData));
          setLocation({ city, state, country, lat: latitude, lng: longitude });
          setSource('gps');
        } catch {
          // Nominatim falló, pero tenemos GPS
          const locationData = { city: 'Tu ubicación', state: '', country: null, lat: latitude, lng: longitude, source: 'gps', timestamp: Date.now() };
          localStorage.setItem(CACHE_KEY, JSON.stringify(locationData));
          setLocation({ city: 'Tu ubicación', state: '', country: null, lat: latitude, lng: longitude });
          setSource('gps');
        }

        setIsLoading(false);
        return; // GPS exitoso, no necesitamos fallback
      } catch (geoError) {
        // GPS denegado o falló — continuamos al fallback
        if (geoError.code === 1) {
          setError('GPS denegado — usando ubicación aproximada');
        }
      }
    }

    // --- PASO 3: Fallback con IP Geolocation (Vercel Geo Headers) ---
    const ipGeo = await fetchIpGeo();
    if (ipGeo) {
      const locationData = {
        city: ipGeo.city || 'Tu zona',
        state: ipGeo.countryRegion || '',
        country: ipGeo.country || null,
        lat: ipGeo.latitude,
        lng: ipGeo.longitude,
        source: 'ip',
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(locationData));
      setLocation({
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        lat: locationData.lat,
        lng: locationData.lng,
      });
      setSource('ip');
      setError(null); // Limpiar error de GPS ya que tenemos ubicación por IP
    } else {
      // Ni GPS ni IP funcionaron
      if (!error) {
        setError('No se pudo determinar tu ubicación');
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    detectCity();
  }, [detectCity]);

  return { ...location, isLoading, error, source, retry: detectCity };
};

export default useCityDetection;
