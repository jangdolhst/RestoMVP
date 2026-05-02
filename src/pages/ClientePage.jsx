import { useState } from 'react';
import { ChefHat, ShoppingBag } from 'lucide-react';
import POSGrid from '../components/pos/POSGrid';
import TicketSidebar from '../components/pos/TicketSidebar';
import { usePOS } from '../context/POSContext';

const ClientePage = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems, cartTotal } = usePOS();

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden relative">
      {/* Client Header */}
      <header className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center px-6 justify-center shadow-md relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <ChefHat className="text-white" size={18} />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Resto<span className="text-orange-400">MVP</span></span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden lg:pr-4 lg:pb-4 lg:pt-4">
        {/* Left Side: Menu Grid */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative lg:rounded-xl pb-20 lg:pb-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/20 backdrop-blur-3xl -z-10"></div>
          <POSGrid isClientMode={true} />
        </div>

        {/* Right Side: Ticket/Cart */}
        <TicketSidebar 
          isClientMode={true} 
          isOpen={isCartOpen} 
          onClose={() => setIsCartOpen(false)} 
        />
      </div>

      {/* Barra flotante para móviles (lg:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 lg:hidden z-30">
        <button 
          onClick={() => setIsCartOpen(true)}
          className="btn-primary w-full py-4 flex justify-between items-center px-6 shadow-xl shadow-orange-500/20 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-medium text-lg">Ver Pedido ({cartItems.length})</span>
          </div>
          <span className="font-bold text-xl">${cartTotal}</span>
        </button>
      </div>
    </div>
  );
};

export default ClientePage;
