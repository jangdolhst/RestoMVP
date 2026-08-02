import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { Trash2, Send, X, AlertCircle, MapPin, Truck } from 'lucide-react';
import PhoneInput from '../ui/PhoneInput';
import WhatsAppConfirmationModal from '../ui/WhatsAppConfirmationModal';
import {
  calculateDeliveryFee,
  calculateDistanceKm,
  canUseFulfillment,
  normalizeDeliverySettings,
} from '../../lib/delivery';

const TicketSidebar = ({ isClientMode = false, isOpen = false, isStoreOpen = true, onClose, restaurantInfo = null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { 
    cartItems, 
    cartTotal, 
    clientName, 
    setClientName, 
    tableName, 
    setTableName, 
    phone,
    setPhone,
    isOnline,
    setIsOnline,
    fulfillmentType,
    setFulfillmentType,
    deliveryAddress,
    setDeliveryAddress,
    deliveryReference,
    setDeliveryReference,
    deliveryLatitude,
    setDeliveryLatitude,
    deliveryLongitude,
    setDeliveryLongitude,
    removeFromCart, 
    placeOrder,
    tableCount,
    orders,
    waiters,
    waiterName,
    setWaiterName,
    restaurantProfile
  } = usePOS();

  const activeRestaurantProfile = useMemo(
    () => restaurantProfile || restaurantInfo || {},
    [restaurantInfo, restaurantProfile]
  );
  const deliverySettings = useMemo(
    () => normalizeDeliverySettings(activeRestaurantProfile),
    [activeRestaurantProfile]
  );
  const canPickup = canUseFulfillment(deliverySettings, 'pickup');
  const canDelivery = canUseFulfillment(deliverySettings, 'delivery');
  const deliveryDistanceKm = useMemo(() => calculateDistanceKm(
    { latitude: activeRestaurantProfile?.latitude, longitude: activeRestaurantProfile?.longitude },
    { latitude: deliveryLatitude, longitude: deliveryLongitude }
  ), [activeRestaurantProfile?.latitude, activeRestaurantProfile?.longitude, deliveryLatitude, deliveryLongitude]);
  const deliveryQuote = useMemo(
    () => calculateDeliveryFee(deliverySettings, deliveryDistanceKm),
    [deliverySettings, deliveryDistanceKm]
  );
  const confirmedDeliveryFee = fulfillmentType === 'delivery' && deliveryQuote.status === 'confirmed'
    ? Number(deliveryQuote.fee) || 0
    : 0;
  const displayTotal = cartTotal + confirmedDeliveryFee;

  useEffect(() => {
    if (!isClientMode) return;
    if (!canPickup && canDelivery && fulfillmentType !== 'delivery') {
      setFulfillmentType('delivery');
    }
    if (canPickup && !canDelivery && fulfillmentType !== 'pickup') {
      setFulfillmentType('pickup');
    }
  }, [canDelivery, canPickup, fulfillmentType, isClientMode, setFulfillmentType]);

  // Calcular mesas ocupadas (órdenes activas que tienen mesa asignada)
  const occupiedTables = (orders || []).filter(o => 
    o.tableName && ['pendiente_cocina', 'pendiente_confirmacion'].includes(o.status)
  ).map(o => o.tableName);

  const [toastMsg, setToastMsg] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const requestDeliveryLocation = () => {
    if (!navigator.geolocation) {
      showToast(t('map.unsupported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLatitude(position.coords.latitude);
        setDeliveryLongitude(position.coords.longitude);
      },
      () => showToast(t('map.error')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleEnviar = async () => {
    if (cartItems.length === 0) return showToast(t('pos.errors.emptyOrder'));
    
    if (isClientMode) {
      if (!clientName.trim()) return showToast(t('pos.errors.clientName'));
      if (!phone.trim()) return showToast(t('pos.errors.phone'));
      if (!isPhoneValid) return showToast(t('pos.errors.invalidPhone'));
      if (!canUseFulfillment(deliverySettings, fulfillmentType)) return showToast(t('pos.errors.fulfillmentUnavailable'));
      if (fulfillmentType === 'delivery') {
        if (!deliveryAddress.trim()) return showToast(t('pos.errors.deliveryAddress'));
        if ((deliverySettings.delivery_fee_mode === 'per_km' || deliverySettings.delivery_max_distance_km != null) && deliveryDistanceKm == null) {
          return showToast(t('pos.errors.deliveryLocation'));
        }
        if (deliveryQuote.reason === 'outside_delivery_radius') return showToast(t('pos.errors.deliveryOutsideRadius'));
        if (cartTotal < (deliverySettings.delivery_min_order_mxn || 0)) return showToast(t('pos.errors.deliveryMinOrder', { amount: deliverySettings.delivery_min_order_mxn }));
      }
    } else {
      if (!clientName.trim()) return showToast(t('pos.errors.ownerName'));
      if (isOnline && !phone.trim()) return showToast(t('pos.errors.onlinePhone'));
      if (isOnline && phone.trim() && !isPhoneValid) return showToast(t('pos.errors.invalidPhone'));
    }

    setIsSending(true);
    const result = await placeOrder(isClientMode ? true : isOnline);
    setIsSending(false);

    if (result && result.success) {
      if (isClientMode) {
        if (result.confirmationCode) {
          // Mostrar modal de confirmación WhatsApp
          setConfirmationData({
            confirmationCode: result.confirmationCode,
            orderNumber: result.orderNumber,
            clientName,
            items: result.items,
            total: result.total,
            restaurantPhone: result.restaurantPhone,
          });
        } else {
          navigate('/pedidos');
        }
      } else {
        showToast(t('pos.orderSent'));
        if (onClose) onClose();
      }
    } else {
      const errorMsg = result?.error || t('pos.errors.sendOrder');
      showToast(errorMsg);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4">
          <div className="bg-slate-900 border border-orange-500/30 shadow-xl shadow-orange-500/20 text-white px-6 py-3 rounded-full flex items-center gap-3 font-medium">
            <AlertCircle className="text-orange-400" size={20} />
            {toastMsg}
          </div>
        </div>
      )}

      {/* Overlay for mobile when drawer is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 flex flex-col glass-panel lg:static lg:ml-4 lg:h-[calc(100vh-100px)] h-full overflow-hidden transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Cabecera del Ticket */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isClientMode ? t('pos.yourOrder') : t('pos.ticket')}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full border border-orange-500/30">
              {cartItems.length} items
            </span>
            {onClose && (
              <button onClick={onClose} className="lg:hidden p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 transition-colors">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

      {/* Lista de Productos (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <p>{t('pos.emptyOrder')}</p>
            <p className="text-sm">{t('pos.selectProducts')}</p>
          </div>
        ) : (
          cartItems.map((item) => {
            const extraCost = item.modifications?.reduce((sum, mod) => sum + (Number(mod.price) || 0), 0) || 0;
            const itemTotal = (item.price + extraCost) * item.quantity;

            return (
              <div key={item.cartId} className="bg-black/20 rounded-lg p-3 border border-white/5 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 font-bold text-sm">x{item.quantity}</span>
                      <h3 className="text-white font-medium">{item.name}</h3>
                    </div>
                    {/* Modificaciones Extras/Quitar */}
                    {item.modifications?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {item.modifications.map((mod, idx) => (
                          <p key={idx} className={`text-xs ${mod.type === 'extra' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {mod.type === 'extra' ? '+ ' : '- '}
                            {mod.name}
                            {mod.type === 'extra' && mod.price > 0 && <span className="opacity-70 ml-1">(${Number(mod.price).toFixed(2)})</span>}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-orange-400 font-bold">${itemTotal.toFixed(2)}</span>
                    <button 
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title={t('pos.removeProduct')}
                    >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Pie del Ticket (Total, Cliente, Enviar) */}
      <div className="p-4 border-t border-white/10 bg-black/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg text-slate-300">{t('common.labels.total')}:</span>
          <span className="text-2xl font-bold text-orange-400">${displayTotal.toFixed(2)}</span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300 w-16">{t('common.labels.name')}:</label>
            <input 
              type="text" 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="glass-input flex-1 py-1.5" 
              placeholder={t('pos.placeholders.clientName')}
            />
          </div>

          {isClientMode ? (
            <>
              {(canPickup || canDelivery) && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1 border border-white/10">
                  {canPickup && (
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('pickup')}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                        fulfillmentType === 'pickup' ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {t('pos.fulfillment.pickup')}
                    </button>
                  )}
                  {canDelivery && (
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('delivery')}
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                        fulfillmentType === 'delivery' ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {t('pos.fulfillment.delivery')}
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-slate-300 mb-1 block">{t('common.labels.phone')}:</label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  onValidityChange={setIsPhoneValid}
                  placeholder={t('pos.placeholders.clientPhone')}
                />
              </div>

              {fulfillmentType === 'delivery' && (
                <div className="space-y-2 rounded-xl bg-sky-500/10 border border-sky-500/20 p-3 animate-fade-in">
                  <div>
                    <label className="text-sm text-slate-300 mb-1 block">{t('pos.delivery.address')}</label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="glass-input w-full py-2"
                      placeholder={t('pos.delivery.addressPlaceholder')}
                      maxLength={300}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 mb-1 block">{t('pos.delivery.reference')}</label>
                    <input
                      type="text"
                      value={deliveryReference}
                      onChange={(e) => setDeliveryReference(e.target.value)}
                      className="glass-input w-full py-2"
                      placeholder={t('pos.delivery.referencePlaceholder')}
                      maxLength={300}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={requestDeliveryLocation}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
                  >
                    <MapPin size={16} />
                    {deliveryLatitude && deliveryLongitude ? t('pos.delivery.updateLocation') : t('pos.delivery.useLocation')}
                  </button>
                  <div className="rounded-lg bg-black/20 p-2 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-sky-200">
                      <Truck size={14} />
                      {t('pos.delivery.summary')}
                    </div>
                    {deliveryDistanceKm != null && (
                      <p>{t('pos.delivery.distance', { distance: deliveryDistanceKm })}</p>
                    )}
                    {deliveryQuote.status === 'confirmed' && (
                      <p>{t('pos.delivery.fee', { amount: Number(deliveryQuote.fee).toFixed(2) })}</p>
                    )}
                    {deliveryQuote.status === 'pending_manual' && (
                      <p className="text-amber-300">{t('pos.delivery.manualFee')}</p>
                    )}
                    {deliveryQuote.reason === 'distance_required' && (
                      <p className="text-amber-300">{t('pos.delivery.locationRequired')}</p>
                    )}
                    {deliveryQuote.reason === 'outside_delivery_radius' && (
                      <p className="text-red-300">{t('pos.delivery.outsideRadius')}</p>
                    )}
                    {deliverySettings.delivery_min_order_mxn != null && (
                      <p>{t('pos.delivery.minOrder', { amount: deliverySettings.delivery_min_order_mxn })}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Mesero dropdown */}
              {!isOnline && waiters.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300 w-16">{t('common.labels.waiter')}:</label>
                  <select
                    value={waiterName}
                    onChange={(e) => setWaiterName(e.target.value)}
                    className="glass-input flex-1 py-1.5 cursor-pointer"
                  >
                    <option value="">{t('common.labels.unassigned')}</option>
                    {waiters.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mesa dropdown */}
              {!isOnline && tableCount > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300 w-16">{t('common.labels.table')}:</label>
                  <select
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="glass-input flex-1 py-1.5 cursor-pointer"
                  >
                    <option value="">{t('common.labels.takeout')}</option>
                    {Array.from({ length: tableCount }, (_, i) => {
                      const mesa = `Mesa ${i + 1}`;
                      const isOccupied = occupiedTables.includes(mesa);
                      return (
                        <option key={i} value={mesa} disabled={isOccupied}>
                          {mesa}{isOccupied ? ` (${t('common.labels.occupied')})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="isOnline" 
                  checked={isOnline}
                  onChange={(e) => setIsOnline(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-orange-500 focus:ring-orange-500 bg-slate-800"
                />
                <label htmlFor="isOnline" className="text-sm text-slate-300 cursor-pointer">
                  {t('pos.onlineOrder')}
                </label>
              </div>

              {isOnline && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm text-slate-300 mb-1 block">{t('common.labels.phone')}:</label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    onValidityChange={setIsPhoneValid}
                    placeholder={t('pos.placeholders.ownerPhone')}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <button 
          onClick={handleEnviar}
          disabled={isSending || cartItems.length === 0 || (isClientMode && !isStoreOpen)}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClientMode && !isStoreOpen ? (
            <>
              <AlertCircle size={20} />
              {t('common.states.closed')}
            </>
          ) : isSending ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              {t('common.actions.sending')}
            </>
          ) : (
            <>
              <Send size={20} />
              {t('pos.sendOrder')}
            </>
          )}
        </button>
      </div>
    </aside>

      {/* Modal de Confirmación WhatsApp */}
      {confirmationData && (
        <WhatsAppConfirmationModal
          {...confirmationData}
          onClose={() => {
            setConfirmationData(null);
            navigate('/pedidos');
          }}
          onGoToTracking={() => {
            setConfirmationData(null);
            navigate('/pedidos');
          }}
        />
      )}
    </>
  );
};

export default TicketSidebar;
