import { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { UtensilsCrossed, Check } from 'lucide-react';

const OrderCard = ({ order, updateOrderStatus }) => {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calcTime = () => {
      const diffMs = new Date() - new Date(order.createdAt);
      setMinutes(Math.floor(diffMs / 60000));
    };
    calcTime();
    const interval = setInterval(calcTime, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isUrgent = minutes >= 10;

  return (
    <div 
      className={`glass-card w-[85vw] max-w-[350px] flex-shrink-0 flex flex-col h-[600px] snap-center transition-all duration-300 ${
        isUrgent ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse' : ''
      }`}
    >
      {/* Ticket Header */}
      <div className={`p-4 border-b flex justify-between items-center ${isUrgent ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-slate-400 font-normal">#{order.orderNumber}</span>
            {order.type === 'online' ? (
              <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-sm border border-blue-500/30">
                EN LÍNEA
              </span>
            ) : (
              order.tableName
            )}
          </h3>
          <p className="text-sm text-slate-300">{order.clientName}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Hace {minutes} min</span>
          {isUrgent && (
            <span className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded mt-1 inline-block">
              URGENTE
            </span>
          )}
        </div>
      </div>

      {/* Ticket Items */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {order.items?.map(item => (
          <div key={item.id || item.cartId} className="border-b border-white/5 pb-3">
            <div className="flex gap-3 text-lg font-bold text-white">
              <span className="text-orange-400">x{item.quantity}</span>
              <span>{item.product_name || item.name}</span>
            </div>
            
            {/* Ingredientes debajo del nombre */}
            {item.ingredients && (
              <p className="text-sm text-slate-400 pl-8 mt-1 italic">
                Ing: {item.ingredients}
              </p>
            )}

            {/* Modificaciones para Cocina */}
            {item.modifications?.length > 0 && (
              <div className="mt-2 pl-8 space-y-1">
                {item.modifications.map((mod, idx) => (
                  <div 
                    key={idx} 
                    className={`px-3 py-1.5 rounded text-sm font-bold border ${
                      mod.type === 'extra' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}
                  >
                    {mod.type === 'extra' ? '+ AÑADIR ' : '- SIN '}
                    {mod.name.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ticket Footer Action */}
      <div className="p-4 mt-auto border-t border-white/10">
        <button 
          onClick={() => updateOrderStatus(order.id, 'listo')}
          className="btn-primary w-full py-4 text-lg font-bold flex justify-center items-center gap-2"
        >
          <Check size={24} />
          MARCAR LISTO
        </button>
      </div>
    </div>
  );
};

const CocinaPage = () => {
  const { orders, updateOrderStatus } = usePOS();
  
  const pendingOrders = orders.filter(o => o.status === 'pendiente_cocina');

  return (
    <div className="flex-1 p-6 overflow-y-auto h-[calc(100vh-100px)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-500/20 rounded-xl">
          <UtensilsCrossed className="text-orange-400" size={28} />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">KDS (Cocina)</h1>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="glass-panel p-10 text-center flex flex-col items-center justify-center h-64">
          <h2 className="text-xl text-slate-300 font-medium">No hay órdenes pendientes</h2>
          <p className="text-slate-500 mt-2">La cocina está libre por el momento.</p>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
          {pendingOrders.map(order => (
            <OrderCard key={order.id} order={order} updateOrderStatus={updateOrderStatus} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CocinaPage;
