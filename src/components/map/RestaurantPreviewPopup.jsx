import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, Store, UtensilsCrossed, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * RestaurantPreviewPopup — Ventana flotante glassmorphism con info del restaurante.
 *
 * @param {object} restaurant - Datos del restaurante seleccionado
 * @param {function} onClose - Callback para cerrar el popup
 */
const RestaurantPreviewPopup = ({ restaurant, onClose }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    if (!restaurant?.id) return;

    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, image_url')
          .eq('tenant_id', restaurant.id)
          .limit(3)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Error cargando productos:', err.message);
        setProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [restaurant?.id]);

  if (!restaurant) return null;

  const placeholderBanner = `https://ui-avatars.com/api/?name=${encodeURIComponent(restaurant.name)}&background=f97316&color=fff&size=400&font-size=0.33&bold=true&format=svg`;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card flotante */}
      <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-scale-up overflow-hidden z-10">
        {/* Botón X */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Banner */}
        <div className="relative h-36 overflow-hidden">
          <img
            src={restaurant.banner_url || placeholderBanner}
            alt={`Banner de ${restaurant.name}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.src = placeholderBanner; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />

          {/* Logo */}
          <div className="absolute bottom-3 left-4 w-14 h-14 rounded-2xl border-2 border-white/20 overflow-hidden bg-slate-800 shadow-xl">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img src="/assets/jamm-free-icon.png" alt="Jamm Free" className="w-8 h-8 object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-white">{restaurant.name}</h3>
            {restaurant.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{restaurant.description}</p>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-2">
            {restaurant.address && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                <MapPin size={12} className="text-orange-400" />
                <span className="truncate max-w-[180px]">{restaurant.address}</span>
              </span>
            )}
            {restaurant.categories?.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                <Store size={12} className="text-blue-400" />
                {restaurant.categories.slice(0, 2).join(' · ')}
              </span>
            )}
          </div>

          {/* Productos destacados */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Productos destacados
            </h4>
            {isLoadingProducts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-orange-400" />
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover border border-white/10"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <UtensilsCrossed size={16} className="text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{product.name}</p>
                    </div>
                    <span className="text-sm font-bold text-orange-400 font-mono">
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-3">Sin productos disponibles aún.</p>
            )}
          </div>

          {/* Botón principal */}
          <button
            onClick={() => navigate(`/menu/${restaurant.id}`)}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-semibold rounded-xl"
          >
            <ExternalLink size={18} />
            Ver Local
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantPreviewPopup;
