import { NavLink, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Map, User, Store } from 'lucide-react';

/**
 * MobileBottomNav — Barra de navegación inferior estilo app nativa.
 * Solo visible en mobile (lg:hidden).
 * Se oculta automáticamente en /menu/:tenantId (ClientePage tiene su propia barra).
 */
const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Inicio', exact: true },
  { path: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
  { path: '/mapa', icon: Map, label: 'Mapa' },
  { path: '/perfil', icon: User, label: 'Perfil' },
  { path: '/partners', icon: Store, label: 'Negocios' },
];

const MobileBottomNav = () => {
  const location = useLocation();

  // Ocultar en rutas de menú de restaurante (tiene su propia barra de carrito)
  // y en rutas admin
  const hiddenPaths = ['/menu/', '/pos', '/pagos', '/settings', '/cocina', '/billing', '/login'];
  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));

  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Glassmorphism bar */}
      <div className="bg-black/85 backdrop-blur-2xl border-t border-white/10 px-2 pt-2 pb-safe">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {NAV_ITEMS.map(({ path, icon: Icon, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px] ${
                  isActive
                    ? 'text-orange-400'
                    : 'text-slate-500 active:text-slate-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={`transition-all duration-200 ${isActive ? 'scale-110' : ''}`}
                    />
                    {/* Dot indicator para tab activo */}
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-400 rounded-full" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-orange-400' : ''}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
