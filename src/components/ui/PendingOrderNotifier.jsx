import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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
  const [pendingCount, setPendingCount] = useState(0);
  const soundIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Generar sonido con Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

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
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', user.id)
        .eq('status', 'pendiente_confirmacion');

      if (error) throw error;
      setPendingCount(count || 0);
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

  return (
    <button
      onClick={() => navigate('/pagos')}
      className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-105 active:scale-95 animate-bounce"
      style={{ animationDuration: '1.5s' }}
    >
      <Bell size={20} className="animate-pulse" />
      <span>{pendingCount} pedido{pendingCount > 1 ? 's' : ''} por confirmar</span>
    </button>
  );
};

export default PendingOrderNotifier;
