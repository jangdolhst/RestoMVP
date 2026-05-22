import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'resto_user_location';
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
 * useCityDetection — Hook que detecta la ciudad del usuario via GPS + Nominatim.
 * Cachea el resultado en localStorage por 1 hora.
 *
 * Retorna: { city, state, lat, lng, isLoading, error, retry }
 */
const useCityDetection = () => {
  const [location, setLocation] = useState({
    city: null,
    state: null,
    lat: null,
    lng: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const detectCity = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Verificar cache
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (cached.city && cached.timestamp && Date.now() - cached.timestamp < CACHE_DURATION) {
        setLocation({ city: cached.city, state: cached.state, lat: cached.lat, lng: cached.lng });
        setIsLoading(false);
        return;
      }
    } catch {
      // Cache corrupto, continuar
    }

    // Pedir GPS
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      setIsLoading(false);
      return;
    }

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
          { headers: { 'User-Agent': 'RestoMVP/1.0' } }
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

        const locationData = { city, state, lat: latitude, lng: longitude, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(locationData));
        setLocation({ city, state, lat: latitude, lng: longitude });
      } catch {
        // Nominatim falló, pero tenemos GPS
        const locationData = { city: 'Tu ubicación', state: '', lat: latitude, lng: longitude, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(locationData));
        setLocation({ city: 'Tu ubicación', state: '', lat: latitude, lng: longitude });
      }
    } catch (geoError) {
      if (geoError.code === 1) {
        setError('GPS denegado');
      } else {
        setError('No se pudo obtener tu ubicación');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    detectCity();
  }, [detectCity]);

  return { ...location, isLoading, error, retry: detectCity };
};

export default useCityDetection;
