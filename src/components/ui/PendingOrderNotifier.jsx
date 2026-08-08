import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { splitPendingConfirmationOrders } from '../../lib/pendingOrders';

/**
 * PendingOrderNotifier — Componente global que:
 * 1. Hace polling cada 10s de órdenes pendiente_confirmacion
 * 2. Reproduce sonido cada 2s mientras haya pendientes
 * 3. Muestra badge flotante con cuenta de pendientes
 * 4. Escucha evento 'orders-updated' para reaccionar inmediatamente
 */
const PendingOrderNotifier = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
  const soundIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Generar sonido con Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();

      const notes = [880, 1100, 1320];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startTime = ctx.currentTime + i * 0.35;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });

      setTimeout(() => ctx.close(), 2000);
    } catch {
      // Silenciar si Web Audio no está disponible
    }
  }, []);

  // Detener sonido inmediatamente
  const stopSound = useCallback(() => {
    clearInterval(soundIntervalRef.current);
    soundIntervalRef.current = null;
  }, []);

  // Polling de pendientes
  const fetchPendingCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, fulfillment_type, delivery_address, delivery_fee_status')
        .eq('tenant_id', user.id)
        .eq('status', 'pendiente_confirmacion');

      if (error) throw error;

      const { fresh, expired } = splitPendingConfirmationOrders(data || []);
      const deliveryCount = fresh.filter((order) => order.fulfillment_type === 'delivery').length;

      await Promise.all(expired.map((order) => (
        supabase
          .from('orders')
          .update({ status: 'cancelado' })
          .eq('id', order.id)
          .eq('tenant_id', user.id)
      )));

      setPendingCount(fresh.length);
      setPendingDeliveryCount(deliveryCount);
    } catch {
      // Silenciar errores de polling
    }
  }, [user?.id]);

  // Polling cada 10 segundos
  useEffect(() => {
    fetchPendingCount();
    pollIntervalRef.current = setInterval(fetchPendingCount, 10000);
    return () => clearInterval(pollIntervalRef.current);
  }, [fetchPendingCount]);

  // Escuchar evento custom 'orders-updated' para refrescar inmediatamente
  useEffect(() => {
    const handleOrdersUpdated = () => {
      // Parar sonido inmediatamente y refrescar
      stopSound();
      setPendingCount(0);
      setPendingDeliveryCount(0);
      // Re-fetch para obtener el count real
      setTimeout(fetchPendingCount, 300);
    };

    window.addEventListener('orders-updated', handleOrdersUpdated);
    return () => window.removeEventListener('orders-updated', handleOrdersUpdated);
  }, [fetchPendingCount, stopSound]);

  // Sonido continuo cada 2s mientras haya pendientes
  useEffect(() => {
    if (pendingCount > 0) {
      playNotificationSound();
      soundIntervalRef.current = setInterval(playNotificationSound, 2000);
    } else {
      stopSound();
    }
    return () => stopSound();
  }, [pendingCount, playNotificationSound, stopSound]);

  // No mostrar badge si ya estamos en /pagos (ahí se ve la sección completa)
  const isOnOrdersPage = location.pathname === '/pagos';

  if (pendingCount === 0 || isOnOrdersPage) return null;

  const hasDelivery = pendingDeliveryCount > 0;
  const Icon = hasDelivery ? Truck : Bell;
  const label = hasDelivery ? t('payments.pendingDeliveryConfirm') : t('payments.pendingConfirm');

  return (
    <button
      onClick={() => navigate('/pagos')}
      className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-105 active:scale-95 animate-bounce"
      style={{ animationDuration: '1.5s' }}
    >
      <Icon size={20} className="animate-pulse" />
      <span>{label} ({pendingCount})</span>
    </button>
  );
};

export default PendingOrderNotifier;
