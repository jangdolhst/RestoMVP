import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, UtensilsCrossed, CheckCircle2, Package, RefreshCw, Trash2, History, MessageCircle, XCircle, Navigation2, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  pendiente_confirmacion: {
    labelKey: 'orders.statuses.pendingConfirmation',
    icon: MessageCircle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    pulse: true,
  },
  pendiente_cocina: {
    labelKey: 'orders.statuses.kitchen',
    icon: UtensilsCrossed,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    pulse: true,
  },
  listo: {
    labelKey: 'orders.statuses.ready',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    pulse: false,
  },
  en_entrega: {
    labelKey: 'orders.statuses.inDelivery',
    icon: Truck,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    pulse: true,
  },
  entregado: {
    labelKey: 'orders.statuses.delivered',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    pulse: false,
  },
  pagado: {
    labelKey: 'orders.statuses.paid',
    icon: Package,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    pulse: false,
  },
  cancelado: {
    labelKey: 'orders.statuses.canceled',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    pulse: false,
  },
};

const REFRESH_INTERVAL = 15000; // 15 segundos
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_TRACKING_TOKENS = 20;

const OrderTrackingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const getStoredTokens = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('resto_order_tokens') || '[]');
      const now = Date.now();

      // Compatibilidad con formato viejo (string) y nuevo (objeto con token+timestamp)
      const validEntries = stored
        .filter((entry) => {
          if (typeof entry === 'string') return true; // legado sin timestamp
          if (!entry?.token) return false;
          if (!entry?.timestamp) return true; // legado parcial: mantener por compatibilidad
          return now - entry.timestamp <= TOKEN_TTL_MS;
        })
        .slice(-MAX_TRACKING_TOKENS);

      // Limpieza en background del localStorage
      localStorage.setItem('resto_order_tokens', JSON.stringify(validEntries));

      // Deduplicar tokens conservando orden
      const tokens = validEntries.map((entry) => entry.token || entry);
      return [...new Set(tokens)].slice(-MAX_TRACKING_TOKENS);
    } catch {
      return [];
    }
  }, []);

  const fetchOrders = useCallback(async (showLoading = false) => {
    const tokens = getStoredTokens();
    if (tokens.length === 0) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    if (showLoading) setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .rpc('get_orders_by_tokens', { tokens });

      if (error) {
        console.error('Error cargando pedidos:', error.message);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      console.error('Error en fetchOrders:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLastRefresh(new Date());
    }
  }, [getStoredTokens]);

  // Carga inicial
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh cada 15s
  useEffect(() => {
    const interval = setInterval(() => fetchOrders(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const clearAllOrders = () => {
    localStorage.removeItem('resto_order_tokens');
    setOrders([]);
  };

  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      if (isToday) return t('orders.today');
      return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-orange-500 mx-auto mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-slate-400">{t('orders.loading')}</p>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.status !== 'pagado' && o.status !== 'cancelado');
  const historyOrders = orders.filter(o => o.status === 'pagado' || o.status === 'cancelado');
  const displayOrders = showHistory ? historyOrders : activeOrders;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden">
      {/* Ambient Background (Campfire/Ember Effect) */}
      <div className="ambient-background" />
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => showHistory ? setShowHistory(false) : navigate('/')}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={showHistory ? t('orders.backActive') : t('orders.backDirectory')}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {showHistory ? <History size={22} className="text-blue-400" /> : <Package size={22} className="text-orange-400" />}
                {showHistory ? t('orders.history') : t('orders.title')}
              </h1>
              {lastRefresh && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('orders.updated', { time: formatTime(lastRefresh.toISOString()) })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label={t('orders.refresh')}
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            {orders.length > 0 && (
              <button
                onClick={clearAllOrders}
                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label={t('orders.clearHistory')}
                title={t('orders.clearHistory')}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-6 space-y-4">
        {displayOrders.length === 0 ? (
          /* Estado vacío */
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
              {showHistory ? <History size={36} className="text-slate-600" /> : <Package size={36} className="text-slate-600" />}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {showHistory ? t('orders.emptyHistory') : t('orders.emptyActive')}
            </h2>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">
              {showHistory 
                ? t('orders.emptyHistoryDescription')
                : t('orders.emptyActiveDescription')}
            </p>
            {!showHistory && (
              <button
                onClick={() => navigate('/')}
                className="btn-primary px-6 py-3 inline-flex items-center gap-2"
              >
                {t('orders.explore')}
              </button>
            )}
          </div>
        ) : (
          /* Lista de pedidos */
          displayOrders.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendiente_cocina;
            const StatusIcon = status.icon;
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);

            return (
              <div
                key={order.order_token}
                className={`glass-panel overflow-hidden border ${status.bg} animate-fade-in`}
              >
                {/* Status Banner */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  order.status === 'listo' ? 'bg-emerald-500/10' : 'bg-white/[0.02]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${status.bg}`}>
                      <StatusIcon size={18} className={`${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <span className={`text-sm font-bold ${status.color}`}>
                        {t(status.labelKey)}
                      </span>
                      {order.restaurant_name && (
                        <p className="text-xs text-slate-500">{order.restaurant_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">
                      {formatDate(order.created_at)} · {formatTime(order.created_at)}
                    </span>
                    <span className="text-xs text-slate-600">
                      {t('orders.orderNumber', { number: order.order_number })}
                    </span>
                  </div>
                </div>

                {/* Order Details */}
                <div className="px-4 py-3 border-t border-white/5">
                  {/* Items */}
                  <div className="space-y-1.5 mb-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">
                          <span className="text-orange-400 font-medium mr-1.5">x{item.quantity}</span>
                          {item.product_name}
                        </span>
                        <span className="text-sm text-slate-400 font-mono">
                          ${Number(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-sm font-medium text-slate-300">Total</span>
                    <span className="text-lg font-bold text-orange-400">
                      ${Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Ready notification */}
                {order.status === 'listo' && (
                  <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20">
                    <p className="text-sm text-emerald-400 font-medium text-center">
                      {order.fulfillment_type === 'delivery' ? t('orders.delivery.readyForDelivery') : t('orders.ready')}
                    </p>
                  </div>
                )}

                {order.status === 'en_entrega' && (
                  <div className="px-4 py-2.5 bg-sky-500/10 border-t border-sky-500/20">
                    <p className="text-sm text-sky-300 font-medium text-center">
                      {t('orders.delivery.driverOnTheWay')}
                    </p>
                  </div>
                )}

                {order.status === 'entregado' && (
                  <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20">
                    <p className="text-sm text-emerald-300 font-medium text-center">
                      {t('orders.delivery.delivered')}
                    </p>
                  </div>
                )}

                {/* Esperando confirmación */}
                {order.status === 'pendiente_confirmacion' && (
                  <div className="px-4 py-2.5 bg-yellow-500/10 border-t border-yellow-500/20">
                    <p className="text-sm text-yellow-400 font-medium text-center">
                      {t('orders.confirmWhatsApp')}
                    </p>
                  </div>
                )}

                {/* Botón Ir por pedido — abre Google Maps con ruta */}
                {order.fulfillment_type !== 'delivery' && order.restaurant_latitude && order.restaurant_longitude && order.status !== 'pagado' && order.status !== 'cancelado' && (
                  <div className="px-4 py-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${order.restaurant_latitude},${order.restaurant_longitude}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-400 hover:text-blue-300 font-medium text-sm transition-all hover:scale-[1.01] active:scale-95"
                    >
                      <Navigation2 size={16} />
                      {t('orders.getDirections')}
                    </button>
                    {order.restaurant_address && (
                      <p className="text-[11px] text-slate-600 text-center mt-1.5">
                        📍 {order.restaurant_address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Botón para ir al Historial */}
        {!showHistory && historyOrders.length > 0 && (
          <div className="pt-4 mt-8 border-t border-white/10 text-center animate-fade-in">
            <button
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors border border-white/5 font-medium"
            >
              <History size={18} className="text-blue-400" />
              {t('orders.viewHistory', { count: historyOrders.length })}
            </button>
          </div>
        )}

        {/* Auto-refresh indicator */}
        {!showHistory && activeOrders.length > 0 && (
          <p className="text-center text-xs text-slate-600 pt-6 pb-2">
            <Clock size={12} className="inline mr-1 -mt-0.5" />
            {t('orders.autoRefresh')}
          </p>
        )}
      </main>
    </div>
  );
};

export default OrderTrackingPage;
