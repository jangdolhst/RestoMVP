import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Calendario visual de órdenes para PagosPage.
 * Muestra un dropdown con calendario mensual donde:
 * - Los días con órdenes tienen un punto naranja (dot indicator)
 * - El día de hoy tiene un anillo azul pulsante
 * - El día seleccionado tiene fondo naranja sólido
 * 
 * @param {string} value - Fecha seleccionada en formato YYYY-MM-DD
 * @param {function} onChange - Callback al seleccionar una fecha
 * @param {string} tenantId - ID del tenant/restaurante
 */
const OrderCalendar = ({ value, onChange, tenantId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [activeDays, setActiveDays] = useState(new Set());
  const [isLoadingDays, setIsLoadingDays] = useState(false);
  const calendarRef = useRef(null);
  const { t, i18n } = useTranslation();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const locale = i18n.language === 'en' ? 'en-US' : 'es-MX';
  const WEEKDAY_NAMES = i18n.language === 'en'
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
    new Date(2026, index, 1).toLocaleDateString(locale, { month: 'long' })
  );

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch de los días que tuvieron órdenes en el mes visualizado
  const fetchActiveDays = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingDays(true);

    try {
      const startOfMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01T00:00:00`;
      const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
      const endOfMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

      const daysSet = new Set();
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('orders')
          .select('created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)
          .not('status', 'eq', 'cancelado')
          .order('created_at', { ascending: true })
          .range(from, to);

        if (error) throw error;

        (data || []).forEach(order => {
          const d = new Date(order.created_at);
          const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          daysSet.add(dayStr);
        });

        hasMore = (data || []).length === pageSize;
        page += 1;

        // Prevent infinite loops if the backend misreports pagination boundaries.
        if (page > 50) hasMore = false;
      }

      setActiveDays(daysSet);
    } catch (err) {
      console.error('Error cargando días activos:', err.message);
    } finally {
      setIsLoadingDays(false);
    }
  }, [tenantId, viewYear, viewMonth]);

  useEffect(() => {
    fetchActiveDays();
  }, [fetchActiveDays]);

  // Sincronizar el mes visible con la fecha seleccionada al abrir
  useEffect(() => {
    if (isOpen && value) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generar la cuadrícula de días del mes
  const generateDays = () => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Día de la semana del primer día (0=Domingo → ajustar para Lunes=0)
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const cells = [];

    // Celdas vacías antes del primer día
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, key: `empty-${i}` });
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        key: dateStr,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
        hasOrders: activeDays.has(dateStr),
      });
    }

    return cells;
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (dateStr) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  // Formatear la fecha seleccionada para mostrar en el botón
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return t('payments.calendar.selectDate');
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayNum = d;
    const monthName = MONTH_NAMES[m - 1]?.slice(0, 3) || '';
    return `${dayNum} ${monthName} ${y}`;
  };

  const cells = generateDays();

  return (
    <div className="relative" ref={calendarRef}>
      {/* Botón trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-input flex items-center gap-2 pl-3 pr-4 py-2 cursor-pointer hover:border-orange-500/40 transition-colors min-w-[170px]"
      >
        <Calendar size={16} className="text-orange-400 flex-shrink-0" />
        <span className="text-sm text-white font-medium">{formatDisplayDate(value)}</span>
        {activeDays.has(value) && (
          <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 ml-auto" />
        )}
      </button>

      {/* Dropdown del Calendario */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-[300px] rounded-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(15,15,25,0.98) 0%, rgba(25,25,40,0.98) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Encabezado del mes + navegación */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-white tracking-wide">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 px-3 pt-2 pb-1">
            {WEEKDAY_NAMES.map(name => (
              <div key={name} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1">
                {name}
              </div>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
            {cells.map(cell => {
              if (cell.day === null) {
                return <div key={cell.key} className="w-full aspect-square" />;
              }

              const { day, dateStr, isToday, isSelected, hasOrders } = cell;

              // Estilos dinámicos
              let dayClasses = 'relative w-full aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 text-sm ';

              if (isSelected) {
                dayClasses += 'bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/30 scale-105 ';
              } else if (isToday) {
                dayClasses += 'bg-blue-500/20 text-blue-400 font-bold ring-2 ring-blue-500/50 ';
              } else if (hasOrders) {
                dayClasses += 'text-white font-medium hover:bg-white/10 ';
              } else {
                dayClasses += 'text-slate-500 hover:bg-white/5 hover:text-slate-300 ';
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleSelectDay(dateStr)}
                  className={dayClasses}
                  title={hasOrders ? t('payments.calendar.hasOrders', { date: dateStr }) : dateStr}
                >
                  <span>{day}</span>
                  {/* Punto indicador de órdenes */}
                  {hasOrders && !isSelected && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                  )}
                  {/* Punto indicador dentro del día seleccionado (blanco) */}
                  {hasOrders && isSelected && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-white/80" />
                  )}
                  {/* Animación pulsante para hoy (solo si no está seleccionado) */}
                  {isToday && !isSelected && (
                    <span className="absolute inset-0 rounded-lg ring-2 ring-blue-400/40 animate-pulse pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-center gap-4 px-3 py-2 border-t border-white/5 text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              {t('payments.calendar.withOrders')}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded ring-2 ring-blue-500/50 bg-blue-500/20" />
              {t('payments.calendar.today')}
            </div>
            {isLoadingDays && (
              <span className="text-orange-400 animate-pulse">{t('common.actions.loading')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCalendar;
