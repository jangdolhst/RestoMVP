import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Store, Sparkles, X, Package, Map, Navigation, Loader2 } from 'lucide-react';
import Logo from '../components/ui/Logo';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import { supabase } from '../lib/supabase';
import useCityDetection, { haversineDistance } from '../hooks/useCityDetection';
import { isRestaurantOpen } from '../utils/businessHours';

const MAX_DISTANCE_GPS_KM = 15;  // Radio para GPS (preciso)
const MAX_DISTANCE_IP_KM = 50;   // Radio para IP geo (menos preciso)

const FOOD_CATEGORIES = [
  { key: 'all', value: 'Todos' },
  { key: 'pizza', value: 'Pizza' },
  { key: 'burgers', value: 'Hamburguesas' },
  { key: 'sushi', value: 'Sushi' },
  { key: 'tacos', value: 'Tacos' },
  { key: 'seafood', value: 'Mariscos' },
  { key: 'italian', value: 'Italiana' },
  { key: 'chinese', value: 'China' },
  { key: 'desserts', value: 'Postres' },
  { key: 'coffee', value: 'Café' },
  { key: 'healthy', value: 'Saludable' },
  { key: 'bbq', value: 'BBQ' },
  { key: 'chicken', value: 'Pollo' },
];

const RestaurantCard = ({ restaurant, onClick, distance, isOpen, t }) => {
  const placeholderBanner = `https://ui-avatars.com/api/?name=${encodeURIComponent(restaurant.name)}&background=f97316&color=fff&size=400&font-size=0.33&bold=true&format=svg`;

  return (
    <button
      onClick={isOpen ? onClick : undefined}
      disabled={!isOpen}
      className={`group relative overflow-hidden text-left w-full rounded-3xl transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${isOpen ? 'hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/20 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
    >
      {/* Premium Glass Background */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-500" />
      
      {/* Banner con clip-path / borde curvo interior */}
      <div className="relative h-48 sm:h-52 overflow-hidden rounded-t-3xl border-b border-white/5">
        <img
          src={restaurant.banner_url || placeholderBanner}
          alt={t('marketplace.card.bannerAlt', { name: restaurant.name })}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          onError={(e) => { e.target.src = placeholderBanner; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />

        {/* Logo overlay flotante premium */}
        {restaurant.logo_url && (
          <div className="absolute bottom-4 left-4 w-14 h-14 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl bg-slate-900/80 backdrop-blur-md group-hover:border-orange-500/50 transition-colors duration-500">
            <img
              src={restaurant.logo_url}
              alt={t('marketplace.card.logoAlt', { name: restaurant.name })}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        
        {/* Status indicator flotante */}
        <div className={`absolute top-4 right-4 px-3 py-1 backdrop-blur-md border rounded-full flex items-center gap-1.5 ${isOpen ? 'bg-black/50 border-white/10' : 'bg-red-950/60 border-red-500/20'}`}>
          <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs font-medium text-white">{isOpen ? t('common.states.open') : t('common.states.closed')}</span>
        </div>

        {/* Distance badge */}
        {distance !== null && distance !== undefined && (
          <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-orange-500/30 rounded-full flex items-center gap-1.5">
            <Navigation size={11} className="text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">
              {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
            </span>
          </div>
        )}
      </div>

      {/* Info content */}
      <div className="relative p-5 z-10">
        <h3 className="text-xl font-bold text-white mb-2 truncate group-hover:text-orange-400 transition-colors duration-300">
          {restaurant.name || t('common.empty.noName')}
        </h3>

        {restaurant.description && (
          <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {restaurant.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs font-medium text-slate-400 flex-wrap">
          {restaurant.address && (
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <MapPin size={14} className="text-orange-400" />
              <span className="truncate max-w-[120px]">{restaurant.address}</span>
            </span>
          )}
          {restaurant.categories?.length > 0 && (
            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Store size={14} className="text-blue-400" />
              {restaurant.categories.slice(0, 2).join(' · ')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const MarketplacePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [hasOrders, setHasOrders] = useState(false);

  // Ref + useEffect para scroll horizontal con rueda del mouse en categorías
  const categoryScrollRef = useRef(null);
  useEffect(() => {
    const container = categoryScrollRef.current;
    if (!container) return;
    const onWheel = (e) => {
      if (container.scrollWidth <= container.clientWidth) return;
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Deteccion de ubicacion: IP aproximada primero, GPS solo si el usuario lo pide.
  const {
    city,
    state,
    lat: userLat,
    lng: userLng,
    isLoading: locationLoading,
    error: locationError,
    source: geoSource,
    requestPreciseLocation,
  } = useCityDetection();
  const hasLocation = userLat !== null && userLng !== null;
  const maxDistanceKm = geoSource === 'ip' ? MAX_DISTANCE_IP_KM : MAX_DISTANCE_GPS_KM;
  const isApproximateLocation = geoSource === 'ip';
  const locationTitle = geoSource === 'gps'
    ? t('marketplace.actions.updatePreciseLocation')
    : t('marketplace.actions.usePreciseLocation');

  // Verificar si hay pedidos en localStorage
  useEffect(() => {
    try {
      const tokens = JSON.parse(localStorage.getItem('resto_order_tokens') || '[]');
      setHasOrders(tokens.length > 0);
    } catch {
      setHasOrders(false);
    }
  }, []);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurant_profiles')
          .select('id, name, description, logo_url, banner_url, address, phone, categories, is_active, latitude, longitude, business_hours')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setRestaurants(data || []);
      } catch (err) {
        console.error('Error cargando restaurantes:', err.message);
        setRestaurants([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants;

    // Calcular distancia para cada restaurante
    if (hasLocation) {
      filtered = filtered.map(r => {
        if (r.latitude && r.longitude) {
          const dist = haversineDistance(userLat, userLng, r.latitude, r.longitude);
          return { ...r, distance: dist };
        }
        return { ...r, distance: null };
      });

      // Filtrar por radio máximo (GPS=15km, IP=50km)
      filtered = filtered.filter(r => r.distance === null || r.distance <= maxDistanceKm);

      // Ordenar por distancia (más cercanos primero, sin coords al final)
      filtered.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    // Filtro por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.address?.toLowerCase().includes(query)
      );
    }

    // Filtro por categoría
    if (activeCategory !== 'Todos') {
      filtered = filtered.filter(r =>
        r.categories?.some(cat => cat.toLowerCase() === activeCategory.toLowerCase())
      );
    }

    return filtered;
  }, [restaurants, searchQuery, activeCategory, hasLocation, userLat, userLng, maxDistanceKm]);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden">
      {/* Ambient Background (Campfire/Ember Effect - Zero Lag GPU Optimized) */}
      <div className="ambient-background" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <Logo size="md" showText={true} onClick={() => navigate('/')} />

          {/* City indicator — mobile */}
          <div className="flex items-center gap-1.5 lg:hidden">
            {locationLoading ? (
              <Loader2 size={14} className="animate-spin text-slate-500" />
            ) : city ? (
              <button onClick={requestPreciseLocation} className="flex items-center gap-1 text-xs text-slate-400 hover:text-orange-400 transition-colors px-2 py-1 rounded-lg bg-white/5 border border-white/5" title={locationTitle}>
                <MapPin size={12} className="text-orange-400" />
                <span className="max-w-[120px] truncate">{city}</span>
                {isApproximateLocation && <span className="text-[10px] text-amber-300">{t('marketplace.actions.approxShort')}</span>}
              </button>
            ) : locationError ? (
              <button onClick={requestPreciseLocation} className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-400 transition-colors px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                <MapPin size={12} />
                <span>{t('marketplace.actions.usePreciseLocation')}</span>
              </button>
            ) : null}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {/* City indicator — PC */}
            {locationLoading ? (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                <span>{t('common.actions.loading')}</span>
              </div>
            ) : city ? (
              <div className="flex items-center gap-2">
                <button onClick={requestPreciseLocation} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-orange-400 transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/20" title={locationTitle}>
                  <MapPin size={14} className="text-orange-400" />
                  {city}{state ? `, ${state}` : ''}
                  {isApproximateLocation && (
                    <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                      {t('marketplace.actions.approximateLocation')}
                    </span>
                  )}
                </button>
                {isApproximateLocation && (
                  <button
                    onClick={requestPreciseLocation}
                    className="text-xs text-orange-300 hover:text-orange-200 transition-colors px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20"
                  >
                    {t('marketplace.actions.usePreciseLocation')}
                  </button>
                )}
              </div>
            ) : locationError ? (
              <button onClick={requestPreciseLocation} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-400 transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <MapPin size={14} />
                {t('marketplace.actions.usePreciseLocation')}
              </button>
            ) : null}
            {hasOrders && (
              <button
                onClick={() => navigate('/pedidos')}
                className="text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15"
              >
                <Package size={14} />
                {t('navigation.myOrders')}
              </button>
            )}
            <button
              onClick={() => navigate('/partners')}
              className="text-sm text-slate-400 hover:text-orange-400 transition-colors hidden sm:block"
            >
              {t('navigation.hasBusiness')}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary text-sm py-1.5 px-4"
            >
              {t('navigation.businessAccess')}
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Hero / Search Section */}
      <section className="relative z-10 pt-12 pb-6 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-4">
            <Sparkles size={12} />
            <span>{t('marketplace.hero.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            {t('marketplace.hero.titlePrefix')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">{t('marketplace.hero.titleAccent')}</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
            {t('marketplace.hero.subtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="marketplace-search"
            name="marketplace-search"
            type="text"
            placeholder={t('marketplace.hero.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/50 focus:bg-white/15 transition-all text-sm sm:text-base shadow-xl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={t('marketplace.actions.clearFilters')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Botón Ver en Mapa */}
        <div className="max-w-xl mx-auto mt-4 hidden lg:flex justify-center">
          <button
            onClick={() => navigate('/mapa')}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Map size={18} className="group-hover:animate-pulse" />
            {t('marketplace.actions.viewMap')}
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">GPS</span>
          </button>
        </div>
      </section>

      {/* Category Chips */}
      <section className="relative z-10 px-4 sm:px-6 pb-6">
        <div className="max-w-5xl mx-auto">
          <div
            ref={categoryScrollRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          >
            {FOOD_CATEGORIES.map(({ key, value }) => (
              <button
                key={value}
                onClick={() => setActiveCategory(value)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  activeCategory === value
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t(`marketplace.categories.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurant Grid */}
      <section className="relative z-10 px-4 sm:px-6 pb-28 lg:pb-20">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card overflow-hidden animate-pulse">
                  <div className="h-44 bg-white/5" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRestaurants.length > 0 ? (
            <>
              <p className="text-sm text-slate-500 mb-4">
                {t('marketplace.restaurantCount', { count: filteredRestaurants.length })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRestaurants.map(restaurant => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    distance={restaurant.distance}
                    isOpen={isRestaurantOpen(restaurant.business_hours)}
                    onClick={() => navigate(`/menu/${restaurant.id}`)}
                    t={t}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Store className="mx-auto text-slate-600 mb-4" size={48} />
              <h3 className="text-xl font-bold text-slate-400 mb-2">
                {searchQuery || activeCategory !== 'Todos'
                  ? t('marketplace.emptyFilteredTitle')
                  : t('marketplace.emptyTitle')}
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {searchQuery || activeCategory !== 'Todos'
                  ? t('marketplace.emptyFilteredDescription')
                  : t('marketplace.emptyDescription')}
              </p>
              {(searchQuery || activeCategory !== 'Todos') && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('Todos'); }}
                  className="btn-secondary mt-4 text-sm"
                >
                  {t('marketplace.actions.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer — oculto en mobile (bottom nav lo reemplaza) */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-4 text-center hidden lg:block">
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} Jamm Free — {t('marketplace.footer')}
        </p>
      </footer>
    </div>
  );
};

export default MarketplacePage;
