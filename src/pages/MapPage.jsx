import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Navigation, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RestaurantPreviewPopup from '../components/map/RestaurantPreviewPopup';

// ─── Helpers para íconos personalizados ────────────────────────────

/**
 * Crea un ícono de marcador circular con logo del restaurante.
 */
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

/**
 * Crea el punto azul GPS del usuario.
 */
const userLocationIcon = L.divIcon({
  html: '<div class="user-location-dot"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ─── Componente para mover el mapa al usuario ─────────────────────

const FlyToUser = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.5 });
    }
  }, [position, map]);

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
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading' | 'granted' | 'denied'

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

  // Detectar GPS del usuario
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        setGpsStatus('granted');
      },
      () => {
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Centro del mapa: GPS del usuario > primer restaurante > CDMX
  const mapCenter = useMemo(() => {
    if (userPosition) return userPosition;
    if (restaurants.length > 0) {
      return [restaurants[0].latitude, restaurants[0].longitude];
    }
    return [19.4326, -99.1332]; // CDMX default
  }, [userPosition, restaurants]);

  const handleMarkerClick = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
  }, []);

  const handleCenterOnUser = useCallback(() => {
    if (userPosition) {
      // Force re-center via state refresh
      setUserPosition([...userPosition]);
    }
  }, [userPosition]);

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
        center={mapCenter}
        zoom={userPosition ? 14 : 12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className="dark-tiles"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        />

        {/* Zoom control en posición custom */}
        {/* Se deja el built-in disabled, usamos controles propios abajo */}

        {/* Marcador GPS del usuario */}
        {userPosition && (
          <>
            <Marker position={userPosition} icon={userLocationIcon} />
            <FlyToUser position={userPosition} />
          </>
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
              <Navigation size={14} />
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

      {/* Info GPS denegado */}
      {gpsStatus === 'denied' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 rounded-xl px-4 py-2.5 text-center">
          <p className="text-xs text-amber-400">
            📍 Activa tu GPS para ver los restaurantes más cercanos a ti.
          </p>
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
