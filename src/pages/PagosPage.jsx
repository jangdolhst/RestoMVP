import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '../context/POSContext';
import { DollarSign, Search, CheckCircle, Receipt, Bell, XCircle, Clock, Phone } from 'lucide-react';
import OrderCalendar from '../components/ui/OrderCalendar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PagosPage = () => {
  const { orders, updateOrderStatus } = usePOS();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // ─── Pedidos pendientes de confirmación ──────────────────────────
  const [pendingOrders, setPendingOrders] = useState([]);
  const intervalRef = useRef(null);

  // Fetch pendientes de confirmación cada 10 segundos
  const fetchPendingOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, client_name, phone, total, type, confirmation_code, created_at')
        .eq('tenant_id', user.id)
        .eq('status', 'pendiente_confirmacion')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const validOrders = [];

      for (const order of (data || [])) {
        const createdAt = new Date(order.created_at);
        const minutesElapsed = (now - createdAt) / 60000;

        if (minutesElapsed > 15) {
          // Auto-cancelar órdenes viejas
          await supabase
            .from('orders')
            .update({ status: 'cancelado' })
            .eq('id', order.id);
        } else {
          validOrders.push({
            ...order,
            minutesElapsed: Math.floor(minutesElapsed),
          });
        }
      }

      setPendingOrders(validOrders);
    } catch (err) {
      console.error('Error fetching pending orders:', err.message);
    }
  }, [user?.id]);

  // Polling de datos cada 10s
  useEffect(() => {
    fetchPendingOrders();
    intervalRef.current = setInterval(fetchPendingOrders, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchPendingOrders]);

  const handleConfirmOrder = async (orderId) => {
    // Actualizar UI y sonido inmediatamente
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    window.dispatchEvent(new Event('orders-updated'));
    try {
      await supabase
        .from('orders')
        .update({ status: 'pendiente_cocina' })
        .eq('id', orderId);
      updateOrderStatus(orderId, 'pendiente_cocina');
    } catch (err) {
      console.error('Error confirmando orden:', err.message);
    }
  };

  const handleRejectOrder = async (orderId) => {
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    window.dispatchEvent(new Event('orders-updated'));
    try {
      await supabase
        .from('orders')
        .update({ status: 'cancelado' })
        .eq('id', orderId);
      updateOrderStatus(orderId, 'cancelado');
    } catch (err) {
      console.error('Error rechazando orden:', err.message);
    }
  };

  // ─── Filtro de órdenes normales ──────────────────────────────────
  const filteredOrders = orders.filter(o => {
    // Excluir pendiente_confirmacion y cancelado
    if (o.status === 'pendiente_confirmacion' || o.status === 'cancelado') return false;

    const orderDate = new Date(o.createdAt);
    const orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
    
    if (filterDate && orderDateStr !== filterDate) return false;

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
      {/* ─── Sección: Pedidos por Confirmar ─────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <Bell size={22} className="text-amber-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                {pendingOrders.length}
              </span>
            </div>
            <h2 className="text-xl font-bold text-amber-400">
              Pedidos por Confirmar
            </h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
              Verifica el WhatsApp antes de confirmar
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="glass-card p-4 border-l-4 border-l-amber-500 relative overflow-hidden"
                style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
              >
                {/* Glow de fondo */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                  {/* Header: código + tiempo */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-amber-400 tracking-widest font-mono">
                        {order.confirmation_code}
                      </span>
                      <span className="text-xs text-slate-500">#{order.order_number}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={12} />
                      <span>{order.minutesElapsed}min</span>
                      {order.minutesElapsed >= 10 && (
                        <span className="text-red-400 font-bold ml-1">⚠️</span>
                      )}
                    </div>
                  </div>

                  {/* Info cliente */}
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-white font-medium">{order.client_name}</p>
                    {order.phone && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone size={11} />
                        {order.phone}
                      </p>
                    )}
                    <p className="text-lg font-bold text-emerald-400">${Number(order.total).toFixed(2)}</p>
                  </div>

                  {/* Botones confirmar/rechazar */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmOrder(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle size={16} />
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleRejectOrder(order.id)}
                      className="px-3 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all"
                      title="Rechazar orden"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Sección: Historial de Órdenes ──────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">Órdenes e Historial</h1>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <OrderCalendar
            value={filterDate}
            onChange={setFilterDate}
            tenantId={user?.id}
          />

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

                <div className="mt-auto flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      // Método 1: Guardar en la ventana actual (para window.opener)
                      window.__jfPrintData = order;
                      // Método 2: localStorage fallback
                      try { localStorage.setItem('jf_print_order', JSON.stringify(order)); } catch(e) { /* ignore */ }
                      // Método 3: URL query param como último recurso (datos compactos)
                      const compactOrder = {
                        orderNumber: order.orderNumber, clientName: order.clientName,
                        tableName: order.tableName, type: order.type, total: order.total,
                        createdAt: order.createdAt, waiterName: order.waiterName,
                        items: (order.items || []).map(i => ({
                          product_name: i.product_name || i.name, quantity: i.quantity,
                          price: i.price, modifications: i.modifications
                        }))
                      };
                      const encoded = encodeURIComponent(JSON.stringify(compactOrder));
                      window.open(`/pos_ticket.html?d=${encoded}`, '_blank', 'width=420,height=650');
                    }}
                    className="w-full flex justify-center items-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-colors font-medium text-sm"
                  >
                    🖨️ Imprimir Ticket
                  </button>

                  {isPagado ? (
                    <button disabled className="w-full flex justify-center items-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed font-medium">
                      <CheckCircle size={20} />
                      Orden Pagada
                    </button>
                  ) : (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'pagado')}
                      className="btn-success w-full flex justify-center items-center gap-2 py-2.5"
                    >
                      <CheckCircle size={20} />
                      Marcar Pagado
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
