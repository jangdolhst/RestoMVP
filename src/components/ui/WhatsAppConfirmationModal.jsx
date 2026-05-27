import { X, MessageCircle, ExternalLink, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * WhatsAppConfirmationModal — Modal de confirmación de pedido vía WhatsApp.
 * Muestra el código único, resumen del pedido, y botón para enviar WhatsApp.
 *
 * Props:
 *  - confirmationCode: string (ej: "A7K9")
 *  - orderNumber: number
 *  - clientName: string
 *  - items: array de items del carrito
 *  - total: number
 *  - restaurantPhone: string (número del restaurante)
 *  - onClose: () => void
 *  - onGoToTracking: () => void
 */
const WhatsAppConfirmationModal = ({
  confirmationCode,
  orderNumber,
  clientName,
  items,
  total,
  restaurantPhone,
  onClose,
  onGoToTracking,
}) => {
  const { t } = useTranslation();

  // Construir mensaje de WhatsApp
  const buildWhatsAppMessage = () => {
    const itemLines = items
      .map((item) => {
        const extraCost = item.modifications?.reduce((sum, mod) => sum + (Number(mod.price) || 0), 0) || 0;
        const itemTotal = (item.price + extraCost) * item.quantity;
        let line = `• x${item.quantity} ${item.name} - $${itemTotal.toFixed(2)}`;
        if (item.modifications?.length > 0) {
          const mods = item.modifications.map((m) => `  ${m.type === 'extra' ? '+' : '-'} ${m.name}`).join('\n');
          line += `\n${mods}`;
        }
        return line;
      })
      .join('\n');

    return `${t('whatsapp.messageHeader', { orderNumber })}
${t('whatsapp.messageCode', { code: confirmationCode })}
👤 ${clientName}

${t('whatsapp.messageProducts')}
${itemLines}

${t('whatsapp.messageTotal', { total: total.toFixed(2) })}

${t('whatsapp.messageConfirm')}`;
  };

  const handleWhatsAppClick = () => {
    const message = buildWhatsAppMessage();
    const cleanPhone = restaurantPhone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md relative animate-scale-up border-t-2 border-t-emerald-500 overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{t('whatsapp.created')}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {t('whatsapp.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Código de Confirmación */}
        <div className="mx-5 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-emerald-400/80 uppercase tracking-wider font-medium mb-1">
            {t('whatsapp.codeLabel')}
          </p>
          <p className="text-4xl font-black text-emerald-400 tracking-[0.3em] font-mono">
            {confirmationCode}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Pedido #{orderNumber} · {clientName}
          </p>
        </div>

        {/* Resumen del pedido */}
        <div className="mx-5 mt-3 p-3 rounded-xl bg-black/20 border border-white/5 max-h-32 overflow-y-auto">
          {items.map((item, idx) => {
            const extraCost = item.modifications?.reduce((sum, mod) => sum + (Number(mod.price) || 0), 0) || 0;
            const itemTotal = (item.price + extraCost) * item.quantity;
            return (
              <div key={idx} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
                <span className="text-slate-300">
                  <span className="text-orange-400 font-medium">x{item.quantity}</span> {item.name}
                </span>
                <span className="text-slate-400">${itemTotal.toFixed(2)}</span>
              </div>
            );
          })}
          <div className="flex justify-between text-sm pt-2 mt-1 border-t border-white/10">
            <span className="text-white font-bold">Total</span>
            <span className="text-orange-400 font-bold">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Botones */}
        <div className="p-5 space-y-3">
          {restaurantPhone ? (
            <button
              onClick={handleWhatsAppClick}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <MessageCircle size={22} />
              {t('whatsapp.confirm')}
              <ExternalLink size={14} className="opacity-60" />
            </button>
          ) : (
            <div className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-xs text-amber-400">
                {t('whatsapp.noPhone')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t('whatsapp.contactDirect')} <strong className="text-emerald-400">{confirmationCode}</strong>
              </p>
            </div>
          )}

          <button
            onClick={onGoToTracking}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            <Clock size={16} />
            {t('whatsapp.tracking')}
          </button>
        </div>

        {/* Info */}
        <div className="px-5 pb-4">
          <p className="text-[11px] text-slate-600 text-center">
            {t('whatsapp.info')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfirmationModal;
