import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Loader2, MapPin, LocateFixed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RestaurantPreviewPopup from '../components/map/RestaurantPreviewPopup';

// ─── Helpers para íconos personalizados ────────────────────────────

const escapeHtmlAttribute = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const getSafeImageUrl = (url) => {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
};

const createRestaurantIcon = (logoUrl) => {
  const safeLogoUrl = getSafeImageUrl(logoUrl);
  const html = safeLogoUrl
    ? `<div class="restaurant-marker"><img src="${escapeHtmlAttribute(safeLogoUrl)}" alt="logo" /></div>`
    : `<div class="restaurant-marker"><span class="restaurant-marker-fallback">🍽️</span></div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
};

const userLocationIcon = L.divIcon({
  html: '<div class="user-location-dot"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ─── Componente que controla movimientos del mapa ──────────────────

const MapController = ({ userPosition, restaurants, gpsReady, flyTrigger }) => {
  const map = useMap();
  const hasFlownToUser = useRef(false);

  // Volar a la posición del usuario cuando el GPS esté listo
  useEffect(() => {
    if (userPosition && gpsReady && !hasFlownToUser.current) {
      hasFlownToUser.current = true;
      map.flyTo(userPosition, 15, { duration: 1.5 });
    }
  }, [userPosition, gpsReady, map]);

  // Re-centrar cuando el usuario presiona el botón "Mi Ubicación"
  useEffect(() => {
    if (flyTrigger > 0 && userPosition) {
      map.flyTo(userPosition, 15, { duration: 1 });
    }
  }, [flyTrigger, userPosition, map]);

  // Si no hay GPS pero hay restaurantes, ajustar bounds para mostrarlos todos
  useEffect(() => {
    if (!gpsReady && restaurants.length > 0) {
      const bounds = L.latLngBounds(
        restaurants.map((r) => [r.latitude, r.longitude])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [gpsReady, restaurants, map]);

  return null;
};

// ─── Página Principal del Mapa ────────────────────────────────────

const MapPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // GPS del usuario
  const [userPosition, setUserPosition] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading' | 'granted' | 'denied' | 'error'
  const [gpsError, setGpsError] = useState('');
  const [flyTrigger, setFlyTrigger] = useState(0);

  // Cargar restaurantes con coordenadas
  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurant_profiles')
          .select('id, name, description, logo_url, banner_url, address, phone, categories, latitude, longitude')
          .eq('is_active', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) throw error;
        setRestaurants(data || []);
      } catch (err) {
        console.error('Error cargando restaurantes para mapa:', err.message);
        setRestaurants([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, [t]);

  // Solicitar ubicación GPS
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError(t('map.unsupported'));
      return;
    }

    setGpsStatus('loading');
    setGpsError('');

    // Primero intentar sin alta precisión (más rápido y confiable)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        setGpsStatus('granted');
        setGpsError('');
      },
      (err) => {
        if (err.code === 1) {
          setGpsStatus('denied');
          setGpsError(t('map.denied'));
        } else {
          setGpsStatus('error');
          setGpsError(t('map.error'));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 300000,
      }
    );
  }, [t]);

  // Verificar el estado del permiso al montar
  useEffect(() => {
    // Primero checar si la Permissions API está disponible
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setGpsStatus('denied');
          setGpsError(t('map.blocked'));
        } else {
          // 'granted' o 'prompt' - intentar obtener ubicación
          requestGPS();
        }

        // Escuchar cambios de permiso en tiempo real
        result.onchange = () => {
          if (result.state === 'granted') {
            requestGPS();
          } else if (result.state === 'denied') {
            setGpsStatus('denied');
            setGpsError(t('map.blocked'));
          }
        };
      }).catch(() => {
        // Permissions API no disponible, intentar directamente
        requestGPS();
      });
    } else {
      // Navegador sin Permissions API (ej: Safari), intentar directamente
      requestGPS();
    }
  }, [requestGPS, t]);

  const handleMarkerClick = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
  }, []);

  const handleCenterOnUser = useCallback(() => {
    setFlyTrigger((prev) => prev + 1);
  }, []);

  // Centrar inicial: CDMX default (el MapController se encargará de moverlo)
  const defaultCenter = [19.4326, -99.1332];

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="animate-spin text-orange-500 mx-auto mb-3" size={32} />
          <p className="text-slate-400">{t('map.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Mapa fullscreen */}
      <MapContainer
        center={defaultCenter}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className="dark-tiles"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        />

        {/* Controlador inteligente del mapa */}
        <MapController
          userPosition={userPosition}
          restaurants={restaurants}
          gpsReady={gpsStatus === 'granted'}
          flyTrigger={flyTrigger}
        />

        {/* Marcador GPS del usuario */}
        {userPosition && (
          <Marker position={userPosition} icon={userLocationIcon} />
        )}

        {/* Marcadores de restaurantes */}
        {restaurants.map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={createRestaurantIcon(r.logo_url)}
            eventHandlers={{
              click: () => handleMarkerClick(r),
            }}
          />
        ))}
      </MapContainer>

      {/* Header flotante glassmorphism */}
      <header className="absolute top-0 left-0 right-0 z-[500] bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              aria-label={t('client.backToDirectory')}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin size={20} className="text-orange-400" />
                {t('map.title')}
              </h1>
              <p className="text-xs text-slate-400">
                {t('map.localCount', { count: restaurants.length })}
                {gpsStatus === 'loading' && t('map.searchingGps')}
              </p>
            </div>
          </div>

          {/* Botón GPS */}
          {gpsStatus === 'granted' && (
            <button
              onClick={handleCenterOnUser}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 transition-colors text-sm font-medium"
              aria-label={t('map.centerUserLabel')}
            >
              <LocateFixed size={16} />
              <span className="hidden sm:inline">{t('map.centerUser')}</span>
            </button>
          )}
        </div>
      </header>

      {/* Info si no hay restaurantes */}
      {restaurants.length === 0 && (
        <div className="absolute bottom-28 lg:bottom-20 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 text-center max-w-sm">
          <MapPin className="mx-auto text-slate-500 mb-2" size={28} />
          <p className="text-sm text-slate-300 font-medium">{t('map.noRestaurantsTitle')}</p>
          <p className="text-xs text-slate-500 mt-1">
            {t('map.noRestaurantsDescription')}
          </p>
        </div>
      )}

      {/* Loading GPS indicator */}
      {gpsStatus === 'loading' && (
        <div className="absolute bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 rounded-xl px-4 py-2.5 text-center flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <p className="text-xs text-blue-400">{t('map.gettingGps')}</p>
        </div>
      )}

      {/* GPS denegado o error */}
      {(gpsStatus === 'denied' || gpsStatus === 'error') && (
        <div className="absolute bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 rounded-2xl px-5 py-3 text-center max-w-sm w-[90vw]">
          <p className="text-xs text-amber-400 mb-2">
            {gpsError || t('map.activate')}
          </p>
          <button
            onClick={requestGPS}
            className="text-xs font-medium text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-4 py-1.5 rounded-lg transition-colors"
          >
            {t('map.retry')}
          </button>
          {gpsStatus === 'denied' && (
            <p className="text-[10px] text-amber-500/60 mt-2">
              {t('map.chromeHelp')}
            </p>
          )}
        </div>
      )}

      {/* Popup de vista previa del restaurante */}
      {selectedRestaurant && (
        <RestaurantPreviewPopup
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}
    </div>
  );
};

export default MapPage;
