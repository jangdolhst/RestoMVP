import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, ArrowLeft, Clock } from 'lucide-react';
import POSGrid from '../components/pos/POSGrid';
import TicketSidebar from '../components/pos/TicketSidebar';
import { usePOS } from '../context/POSContext';
import { publicSupabase } from '../lib/supabase';
import { isRestaurantOpen } from '../utils/businessHours';

const ClientePage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems, cartTotal } = usePOS();
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!tenantId) return;

    const fetchRestaurantInfo = async () => {
      try {
        const { data } = await publicSupabase
          .from('restaurant_profiles')
          .select('name, logo_url, business_hours, latitude, longitude, delivery_service_mode, delivery_fee_mode, delivery_fixed_fee_mxn, delivery_base_fee_mxn, delivery_fee_per_km_mxn, delivery_max_distance_km, delivery_min_order_mxn, delivery_eta_min_minutes, delivery_eta_max_minutes')
          .eq('id', tenantId)
          .maybeSingle();

        if (data) {
          setRestaurantInfo(data);
        }
      } catch (err) {
        console.error('Error cargando info del restaurante:', err.message);
      }
    };

    fetchRestaurantInfo();
  }, [tenantId]);

  const isOpen = isRestaurantOpen(restaurantInfo?.business_hours);

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden relative">
      <div className="ambient-background" />
      {/* Client Header — muestra info real del restaurante */}
      <header className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center px-4 sm:px-6 justify-between shadow-md relative z-10 shrink-0">
        {/* Botón volver al directorio */}
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label={t('client.backToDirectory')}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Logo + Nombre */}
        <div className="flex items-center gap-2">
          {restaurantInfo?.logo_url ? (
            <img
              src={restaurantInfo.logo_url}
              alt={restaurantInfo.name || t('client.restaurantAlt')}
              className="w-9 h-9 rounded-lg object-cover border border-white/10"
            />
          ) : (
            <img src="/assets/jamm-free-icon.png" alt="Jamm Free" className="h-9 w-auto object-contain" />
          )}
          {restaurantInfo?.name ? (
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight truncate max-w-[200px]">
              {restaurantInfo.name}
            </span>
          ) : (
            <img src="/assets/jamm-free-text.png" alt="JAMM FREE" className="h-4 w-auto object-contain" />
          )}
        </div>

        {/* Spacer para centrar el nombre */}
        <div className="w-10" />
      </header>

      {/* Banner Cerrado */}
      {!isOpen && restaurantInfo && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center justify-center gap-2 relative z-10 shrink-0">
          <Clock size={16} className="text-red-400" />
          <span className="text-sm font-medium text-red-400">{t('client.closedBanner')}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden lg:pr-4 lg:pb-4 lg:pt-4">
        {/* Left Side: Menu Grid */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative lg:rounded-xl pb-20 lg:pb-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/20 backdrop-blur-3xl -z-10"></div>
          <POSGrid isClientMode={true} isOpen={isOpen} />
        </div>

        {/* Right Side: Ticket/Cart */}
        <TicketSidebar 
          isClientMode={true} 
          isOpen={isCartOpen} 
          isStoreOpen={isOpen}
          restaurantInfo={restaurantInfo}
          onClose={() => setIsCartOpen(false)} 
        />
      </div>

      {/* Barra flotante para móviles (lg:hidden) */}
      {isOpen && (
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 lg:hidden z-30">
        <button 
          onClick={() => setIsCartOpen(true)}
          className="btn-primary w-full py-4 flex justify-between items-center px-6 shadow-xl shadow-orange-500/20 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-medium text-lg">{t('client.viewOrder', { count: cartItems.length })}</span>
          </div>
          <span className="font-bold text-xl">${cartTotal}</span>
        </button>
      </div>
      )}
    </div>
  );
};

export default ClientePage;
