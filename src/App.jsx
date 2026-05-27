import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { POSProvider } from './context/POSContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

import MainLayout from './layouts/MainLayout'
import MobileBottomNav from './components/ui/MobileBottomNav'
import MarketplacePage from './pages/MarketplacePage'
import LandingPage from './pages/LandingPage'
import ClientePage from './pages/ClientePage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import MapPage from './pages/MapPage'
import UserProfilePage from './pages/UserProfilePage'
import POSPage from './pages/POSPage'
import PagosPage from './pages/PagosPage'
import CocinaPage from './pages/CocinaPage'
import LoginPage from './pages/LoginPage'
import BillingPage from './pages/BillingPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <POSProvider>
          <Routes>
            {/* Marketplace — Inicio para clientes/comensales */}
            <Route path="/" element={<MarketplacePage />} />
            
            {/* Landing Page del SaaS — Para venderle el sistema a los dueños */}
            <Route path="/partners" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* Ruta para clientes (Menú por Restaurante) */}
            <Route path="/menu/:tenantId" element={<ClientePage />} />
            
            {/* Seguimiento de pedidos */}
            <Route path="/pedidos" element={<OrderTrackingPage />} />
            
            {/* Mapa interactivo de restaurantes */}
            <Route path="/mapa" element={<MapPage />} />

            {/* Perfil de usuario (localStorage) */}
            <Route path="/perfil" element={<UserProfilePage />} />
            
            {/* Ruta de Facturación (Requiere login, pero no suscripción) */}
            <Route path="/billing" element={<BillingPage />} />
            
            {/* Rutas Protegidas (Dueño/Admin) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/pos" element={<POSPage />} />
                <Route path="/pagos" element={<PagosPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              
              {/* Ruta para Cocina (KDS) - Aislada sin Header pero protegida */}
              <Route path="/cocina" element={<CocinaPage />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Bottom Navigation para mobile — se auto-oculta en rutas admin y /menu */}
          <MobileBottomNav />
        </POSProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
