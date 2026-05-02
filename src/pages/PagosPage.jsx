import { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { DollarSign, Search, CheckCircle, Receipt, Calendar } from 'lucide-react';

const PagosPage = () => {
  const { orders, updateOrderStatus } = usePOS();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const filteredOrders = orders.filter(o => {
    // 1. Filtrar por Fecha
    const orderDate = new Date(o.createdAt);
    const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
    
    if (filterDate && orderDateStr !== filterDate) return false;

    // 2. Filtrar por Búsqueda (Cliente o Mesa)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchClient = o.clientName.toLowerCase().includes(term);
      const matchTable = o.tableName.toLowerCase().includes(term);
      if (!matchClient && !matchTable) return false;
    }

    return true;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto h-[calc(100vh-100px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Pagos e Historial</h1>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Filtro por Fecha */}
          <div className="relative">
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="glass-input pl-10 cursor-pointer"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente o mesa..." 
              className="glass-input w-full pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-10 text-center flex flex-col items-center justify-center">
          <DollarSign size={48} className="text-slate-500 mb-4" />
          <h2 className="text-xl text-slate-300 font-medium">No hay órdenes para esta fecha/búsqueda</h2>
          <p className="text-slate-500">Prueba cambiando el día o los términos de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOrders.map(order => {
            const isPagado = order.status === 'pagado';
            
            return (
              <div key={order.id} className={`glass-card p-5 flex flex-col h-full border-t-4 transition-all duration-300 ${isPagado ? 'border-t-emerald-500 opacity-80 hover:opacity-100' : 'border-t-orange-500'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-slate-400 font-normal">#{order.orderNumber}</span>
                      {order.clientName}
                      {isPagado && <Receipt size={16} className="text-emerald-400" title="Pagado" />}
                    </h3>
                    {order.phone && (
                      <p className="text-sm text-slate-400 mb-1">{order.phone}</p>
                    )}
                    <span className={`inline-flex text-sm font-medium px-2 py-0.5 rounded ${isPagado ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                      {order.type === 'online' ? (
                        <span className="text-blue-400 flex items-center gap-1">
                          EN LÍNEA
                        </span>
                      ) : (
                        order.tableName
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-400">${order.total}</p>
                    {isPagado && <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider block mt-1">Cobrado</span>}
                  </div>
                </div>

                <div className="flex-1 bg-black/20 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto border border-white/5">
                  <ul className="space-y-2">
                    {order.items?.map(item => (
                      <li key={item.id || item.cartId} className="text-sm flex justify-between">
                        <span className="text-slate-300">
                          <span className="text-orange-400 mr-2">x{item.quantity}</span>
                          {item.product_name || item.name}
                        </span>
                        <span className="text-slate-400">${item.price * item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto">
                  {isPagado ? (
                    <button disabled className="w-full flex justify-center items-center gap-2 py-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed font-medium">
                      <CheckCircle size={20} />
                      Orden Pagada
                    </button>
                  ) : (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'pagado')}
                      className="btn-success w-full flex justify-center items-center gap-2 py-3"
                    >
                      <CheckCircle size={20} />
                      Marcar como Pagado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PagosPage;
