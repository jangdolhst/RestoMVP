import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import POSGrid from '../components/pos/POSGrid';
import TicketSidebar from '../components/pos/TicketSidebar';
import { usePOS } from '../context/POSContext';
import { ShoppingBag } from 'lucide-react';

const POSPage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems, cartTotal } = usePOS();
  const { t } = useTranslation();

  return (
    <div className="flex w-full h-full relative">
      {/* Panel Izquierdo/Central: Menú */}
      <div className="flex-1 pb-20 lg:pb-0">
        <POSGrid />
      </div>
      
      {/* Panel Derecho: Ticket / Orden actual */}
      <TicketSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Barra flotante para móviles (lg:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-md border-t border-white/10 lg:hidden z-30">
        <button 
          onClick={() => setIsCartOpen(true)}
          className="btn-primary w-full py-4 flex justify-between items-center px-6 shadow-lg shadow-orange-500/20"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-medium">{t('pos.viewTicket', { count: cartItems.length })}</span>
          </div>
          <span className="font-bold text-lg">${cartTotal}</span>
        </button>
      </div>
    </div>
  );
};

export default POSPage;
