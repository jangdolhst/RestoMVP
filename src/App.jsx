import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { POSProvider } from './context/POSContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MobileBottomNav from './components/ui/MobileBottomNav'
import ChunkErrorBoundary from './components/ui/ChunkErrorBoundary'
import i18n from './i18n/index.js'

const MainLayout = lazy(() => import('./layouts/MainLayout'))
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ClientePage = lazy(() => import('./pages/ClientePage'))
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const POSPage = lazy(() => import('./pages/POSPage'))
const PagosPage = lazy(() => import('./pages/PagosPage'))
const FinancePage = lazy(() => import('./pages/FinancePage'))
const CocinaPage = lazy(() => import('./pages/CocinaPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const RouteFallback = () => (
  <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
    <Loader2 className="animate-spin text-orange-500" size={48} aria-label={i18n.t('common.actions.loading')} />
  </div>
)

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <POSProvider>
          <ChunkErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Marketplace - Inicio para clientes/comensales */}
                <Route path="/" element={<MarketplacePage />} />

                {/* Landing Page del SaaS - Para venderle el sistema a los dueños */}
                <Route path="/partners" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Ruta para clientes (Menú por Restaurante) */}
                <Route path="/menu/:tenantId" element={<ClientePage />} />

                {/* Seguimiento de pedidos */}
                <Route path="/pedidos" element={<OrderTrackingPage />} />

                {/* Mapa interactivo de restaurantes */}
                <Route path="/mapa" element={<MapPage />} />

                {/* Opiniones verificadas por restaurante */}
                <Route path="/opiniones/:restaurantId" element={<ReviewsPage />} />

                {/* Perfil de usuario (localStorage) */}
                <Route path="/perfil" element={<UserProfilePage />} />

                {/* Ruta de Facturación (requiere login, pero no suscripción) */}
                <Route path="/billing" element={<BillingPage />} />

                {/* Rutas protegidas (dueño/admin) */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route path="/pos" element={<POSPage />} />
                    <Route path="/pagos" element={<PagosPage />} />
                    <Route path="/finanzas" element={<FinancePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>

                  {/* Ruta para Cocina (KDS) - aislada sin header pero protegida */}
                  <Route path="/cocina" element={<CocinaPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>

          {/* Bottom Navigation para mobile - se auto-oculta en rutas admin y /menu */}
          <MobileBottomNav />
        </POSProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
