import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, LayoutGrid, LogOut, QrCode, X, Copy, Check, Store, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import PendingOrderNotifier from '../components/ui/PendingOrderNotifier';
import Logo from '../components/ui/Logo';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import BusinessBottomNav from '../components/ui/BusinessBottomNav';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const menuUrl = `${window.location.origin}/menu/${user?.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navegación Superior Glassmorphism */}
      <header className="sticky top-0 z-50 p-3 md:p-4">
        <nav className="glass-panel mx-auto max-w-7xl flex items-center justify-between gap-3 px-3 py-2.5 md:px-6 md:py-3">
          <Logo size="sm" showText={true} />

          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            <NavLink
              to="/pos"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <LayoutGrid size={18} />
              <span className="hidden sm:inline">{t('navigation.menu')}</span>
            </NavLink>
            <NavLink
              to="/pagos"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <ClipboardList size={18} />
              <span className="hidden sm:inline">{t('navigation.payments')}</span>
            </NavLink>
            <NavLink
              to="/finanzas"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <WalletCards size={18} />
              <span className="hidden sm:inline">{t('navigation.finance')}</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Store size={18} />
              <span className="hidden sm:inline">{t('navigation.myBusiness')}</span>
            </NavLink>

            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all duration-200"
              title={t('navigation.share')}
            >
              <QrCode size={18} />
              <span className="hidden sm:inline">{t('navigation.share')}</span>
            </button>

            <div className="md:hidden">
              <LanguageSwitcher compact />
            </div>
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
              title={t('billing.logout')}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{t('navigation.logout')}</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Contenido Principal (donde irá el POS o Pagos) */}
      <main className="flex-1 w-full mx-auto px-4 pb-28 md:pb-4 flex overflow-hidden">
        <Outlet />
      </main>

      <BusinessBottomNav />

      {/* Notificador global de pedidos pendientes */}
      <PendingOrderNotifier />

      {/* Modal QR */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm p-6 relative animate-scale-up border-t-2 border-t-emerald-500">
            <button 
              onClick={() => setIsQrModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold mb-1 text-white text-center">{t('navigation.qrTitle')}</h2>
            <p className="text-slate-400 text-sm mb-6 text-center">{t('navigation.qrDescription')}</p>
            
            <div className="bg-white p-4 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/10 mx-auto w-fit mb-6">
              <QRCodeSVG 
                value={menuUrl} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#020617"} // slate-950
                level={"Q"}
              />
            </div>
            
            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/10">
              <span className="text-sm text-slate-300 truncate mr-2">{menuUrl}</span>
              <button
                onClick={copyToClipboard}
                className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors shrink-0"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
