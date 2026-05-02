import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { POSProvider } from './context/POSContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

import MainLayout from './layouts/MainLayout'
import LandingPage from './pages/LandingPage'
import ClientePage from './pages/ClientePage'
import POSPage from './pages/POSPage'
import PagosPage from './pages/PagosPage'
import CocinaPage from './pages/CocinaPage'
import LoginPage from './pages/LoginPage'
import BillingPage from './pages/BillingPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <POSProvider>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* Ruta para clientes (Menú por Restaurante) */}
            <Route path="/menu/:tenantId" element={<ClientePage />} />
            
            {/* Ruta de Facturación (Requiere login, pero no suscripción) */}
            <Route path="/billing" element={<BillingPage />} />
            
            {/* Rutas Protegidas (Dueño/Admin) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/pos" element={<POSPage />} />
                <Route path="/pagos" element={<PagosPage />} />
              </Route>
              
              {/* Ruta para Cocina (KDS) - Aislada sin Header pero protegida */}
              <Route path="/cocina" element={<CocinaPage />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </POSProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
