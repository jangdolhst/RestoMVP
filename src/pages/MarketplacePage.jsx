import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChefHat, MapPin, Clock, Store, Sparkles, X, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

const FOOD_CATEGORIES = [
  'Todos', 'Pizza', 'Hamburguesas', 'Sushi', 'Tacos', 'Mariscos',
  'Italiana', 'China', 'Postres', 'Café', 'Saludable', 'BBQ', 'Pollo'
];

const RestaurantCard = ({ restaurant, onClick }) => {
  const placeholderBanner = `https://ui-avatars.com/api/?name=${encodeURIComponent(restaurant.name)}&background=f97316&color=fff&size=400&font-size=0.33&bold=true&format=svg`;

  return (
    <button
      onClick={onClick}
      className="group glass-card overflow-hidden text-left w-full focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-slate-950"
    >
      {/* Banner */}
      <div className="relative h-40 sm:h-44 overflow-hidden">
        <img
          src={restaurant.banner_url || placeholderBanner}
          alt={`Banner de ${restaurant.name}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => { e.target.src = placeholderBanner; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        {/* Logo overlay */}
        {restaurant.logo_url && (
          <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl border-2 border-white/20 overflow-hidden shadow-lg bg-slate-900">
            <img
              src={restaurant.logo_url}
              alt={`Logo de ${restaurant.name}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-1 truncate group-hover:text-orange-400 transition-colors">
          {restaurant.name || 'Sin nombre'}
        </h3>

        {restaurant.description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {restaurant.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          {restaurant.address && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-orange-400/60" />
              <span className="truncate max-w-[140px]">{restaurant.address}</span>
            </span>
          )}
          {restaurant.categories?.length > 0 && (
            <span className="flex items-center gap-1">
              <Store size={12} className="text-blue-400/60" />
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
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [hasOrders, setHasOrders] = useState(false);

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
          .select('id, name, description, logo_url, banner_url, address, phone, categories, is_active')
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
  }, [restaurants, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
      {/* Background decorative orbs */}
      <div className="fixed top-[-15%] left-[-10%] w-[45%] h-[45%] bg-orange-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-blue-500/8 rounded-full blur-[150px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ChefHat className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Resto<span className="text-orange-400">MVP</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasOrders && (
              <button
                onClick={() => navigate('/pedidos')}
                className="text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15"
              >
                <Package size={14} />
                Mis Pedidos
              </button>
            )}
            <button
              onClick={() => navigate('/partners')}
              className="text-sm text-slate-400 hover:text-orange-400 transition-colors hidden sm:block"
            >
              ¿Tienes un negocio?
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary text-sm py-1.5 px-4"
            >
              Acceso Negocios
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Search Section */}
      <section className="relative z-10 pt-12 pb-6 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-4">
            <Sparkles size={12} />
            <span>Descubre los mejores restaurantes</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            ¿Qué se te antoja <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">hoy?</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
            Explora menús, elige tus platillos favoritos y haz tu pedido directamente al restaurante.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="marketplace-search"
            name="marketplace-search"
            type="text"
            placeholder="Buscar restaurante, comida o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/30 transition-all text-sm sm:text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </section>

      {/* Category Chips */}
      <section className="relative z-10 px-4 sm:px-6 pb-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {FOOD_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  activeCategory === cat
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurant Grid */}
      <section className="relative z-10 px-4 sm:px-6 pb-20">
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
                {filteredRestaurants.length} restaurante{filteredRestaurants.length !== 1 ? 's' : ''} disponible{filteredRestaurants.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRestaurants.map(restaurant => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onClick={() => navigate(`/menu/${restaurant.id}`)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <Store className="mx-auto text-slate-600 mb-4" size={48} />
              <h3 className="text-xl font-bold text-slate-400 mb-2">
                {searchQuery || activeCategory !== 'Todos'
                  ? 'No se encontraron restaurantes'
                  : 'Aún no hay restaurantes'}
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {searchQuery || activeCategory !== 'Todos'
                  ? 'Intenta con otro término de búsqueda o categoría.'
                  : 'Pronto los mejores restaurantes estarán aquí. ¡Vuelve pronto!'}
              </p>
              {(searchQuery || activeCategory !== 'Todos') && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('Todos'); }}
                  className="btn-secondary mt-4 text-sm"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-4 text-center">
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} RestoMVP — Conectando restaurantes con sus clientes.
        </p>
      </footer>
    </div>
  );
};

export default MarketplacePage;
