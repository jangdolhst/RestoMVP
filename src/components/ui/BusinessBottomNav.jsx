import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, LayoutGrid, Store, WalletCards } from 'lucide-react';
import { BUSINESS_NAV_ITEMS, shouldShowBusinessBottomNav } from '../../lib/businessNavigation';

const ICONS = {
  ClipboardList,
  LayoutGrid,
  Store,
  WalletCards,
};

const BusinessBottomNav = () => {
  const location = useLocation();
  const { t } = useTranslation();

  if (!shouldShowBusinessBottomNav(location.pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label={t('navigation.businessAccess')}>
      <div className="relative mx-auto max-w-md px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
        <div className="absolute inset-x-8 bottom-3 h-12 rounded-full bg-orange-500/20 blur-2xl" />
        <div className="relative grid grid-cols-4 gap-1 rounded-[1.75rem] border border-white/12 bg-slate-950/92 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          {BUSINESS_NAV_ITEMS.map(({ path, icon, labelKey, exact }) => {
            const Icon = ICONS[icon];

            return (
              <NavLink
                key={path}
                to={path}
                end={exact}
                className={({ isActive }) =>
                  `group flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'text-slate-400 active:bg-white/10 active:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.6 : 2}
                      className={`transition-transform duration-200 ${isActive ? '-translate-y-0.5 scale-110' : 'group-active:scale-95'}`}
                    />
                    <span className="leading-none">{t(labelKey)}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BusinessBottomNav;
