import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { Trash2, Send, X, AlertCircle } from 'lucide-react';
import PhoneInput from '../ui/PhoneInput';

const TicketSidebar = ({ isClientMode = false, isOpen = false, onClose }) => {
  const navigate = useNavigate();
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
    removeFromCart, 
    placeOrder 
  } = usePOS();

  const [toastMsg, setToastMsg] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleEnviar = async () => {
    if (cartItems.length === 0) return showToast('La orden está vacía');
    
    if (isClientMode) {
      if (!clientName.trim() || !phone.trim()) return showToast('Por favor ingresa tu nombre y celular para enviar la orden.');
    } else {
      if (!clientName.trim() && !tableName.trim()) return showToast('Ingresa un nombre de cliente o mesa.');
      if (isOnline && !phone.trim()) return showToast('Ingresa el celular del cliente para el pedido en línea.');
    }

    setIsSending(true);
    const result = await placeOrder(isClientMode ? true : isOnline);
    setIsSending(false);

    if (result && result.success) {
      if (isClientMode) {
        // Redirigir al cliente a la página de seguimiento
        navigate('/pedidos');
      } else {
        showToast('¡Orden enviada a la cocina!');
        if (onClose) onClose();
      }
    } else {
      showToast('Error al enviar la orden. Intenta de nuevo.');
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
            {isClientMode ? 'Tu Pedido' : 'Ticket Actual'}
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
            <p>La orden está vacía</p>
            <p className="text-sm">Selecciona productos para comenzar</p>
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
                      title="Eliminar producto"
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
          <span className="text-lg text-slate-300">Total:</span>
          <span className="text-2xl font-bold text-orange-400">${cartTotal.toFixed(2)}</span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300 w-16">Nombre:</label>
            <input 
              type="text" 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="glass-input flex-1 py-1.5" 
              placeholder="Ej. Juan Pérez"
            />
          </div>

          {isClientMode ? (
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Celular:</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="Ingresa tu celular"
              />
            </div>
          ) : (
            <>
              {!isOnline && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300 w-16">Mesa:</label>
                  <input 
                    type="text" 
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="glass-input flex-1 py-1.5" 
                    placeholder="Ej. Mesa 4"
                  />
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
                  Pedido en Línea / Llamada
                </label>
              </div>

              {isOnline && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm text-slate-300 mb-1 block">Celular:</label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    placeholder="Celular del cliente"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <button 
          onClick={handleEnviar}
          disabled={isSending || cartItems.length === 0}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Enviando...
            </>
          ) : (
            <>
              <Send size={20} />
              Enviar Orden
            </>
          )}
        </button>
      </div>
    </aside>
    </>
  );
};

export default TicketSidebar;
