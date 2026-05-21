import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Navigation, Loader2, MapPin, LocateFixed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RestaurantPreviewPopup from '../components/map/RestaurantPreviewPopup';

// ─── Helpers para íconos personalizados ────────────────────────────

const createRestaurantIcon = (logoUrl) => {
  const html = logoUrl
    ? `<div class="restaurant-marker"><img src="${logoUrl}" alt="logo" /></div>`
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
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // GPS del usuario
  const [userPosition, setUserPosition] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading' | 'granted' | 'denied' | 'error'
  const [gpsError, setGpsError] = useState('');
  const [flyTrigger, setFlyTrigger] = useState(0);
  const watchIdRef = useRef(null);

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
  }, []);

  // Iniciar monitoreo GPS continuo con watchPosition
  const startGPSWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Tu navegador no soporta geolocalización.');
      return;
    }

    // Limpiar watcher anterior si existe
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setGpsStatus('loading');
    setGpsError('');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(newPos);
        setGpsStatus('granted');
        setGpsError('');
      },
      (err) => {
        console.warn('GPS watchPosition error:', err.code, err.message);

        if (err.code === 1) {
          setGpsStatus('denied');
          setGpsError('Permiso de ubicación denegado.');
        } else if (err.code === 2) {
          setGpsStatus('error');
          setGpsError('No se pudo determinar tu ubicación. Verifica que el GPS esté encendido.');
        } else {
          setGpsStatus('error');
          setGpsError('La solicitud de ubicación tardó demasiado.');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  }, []);

  // Iniciar GPS al montar el componente, limpiar al desmontar
  useEffect(() => {
    startGPSWatch();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startGPSWatch]);

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
          <p className="text-slate-400">Cargando mapa...</p>
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
              aria-label="Volver al directorio"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin size={20} className="text-orange-400" />
                Mapa de Restaurantes
              </h1>
              <p className="text-xs text-slate-400">
                {restaurants.length} local{restaurants.length !== 1 ? 'es' : ''} disponible{restaurants.length !== 1 ? 's' : ''}
                {gpsStatus === 'loading' && ' · 📡 Buscando GPS...'}
              </p>
            </div>
          </div>

          {/* Botón GPS */}
          {gpsStatus === 'granted' && (
            <button
              onClick={handleCenterOnUser}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 transition-colors text-sm font-medium"
              aria-label="Centrar en mi ubicación"
            >
              <LocateFixed size={16} />
              <span className="hidden sm:inline">Mi Ubicación</span>
            </button>
          )}
        </div>
      </header>

      {/* Info si no hay restaurantes */}
      {restaurants.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 text-center max-w-sm">
          <MapPin className="mx-auto text-slate-500 mb-2" size={28} />
          <p className="text-sm text-slate-300 font-medium">No hay restaurantes con ubicación</p>
          <p className="text-xs text-slate-500 mt-1">
            Los restaurantes deben configurar su dirección para aparecer en el mapa.
          </p>
        </div>
      )}

      {/* Loading GPS indicator */}
      {gpsStatus === 'loading' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 rounded-xl px-4 py-2.5 text-center flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <p className="text-xs text-blue-400">Obteniendo tu ubicación GPS...</p>
        </div>
      )}

      {/* GPS denegado o error */}
      {(gpsStatus === 'denied' || gpsStatus === 'error') && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 rounded-2xl px-5 py-3 text-center max-w-sm w-[90vw]">
          <p className="text-xs text-amber-400 mb-2">
            {gpsError || '📍 Activa tu GPS para ver los restaurantes más cercanos a ti.'}
          </p>
          <button
            onClick={startGPSWatch}
            className="text-xs font-medium text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-4 py-1.5 rounded-lg transition-colors"
          >
            🔄 Reintentar GPS
          </button>
          {gpsStatus === 'denied' && (
            <p className="text-[10px] text-amber-500/60 mt-2">
              En tu celular: toca el candado 🔒 junto a la URL → Permisos → Ubicación → Permitir
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
