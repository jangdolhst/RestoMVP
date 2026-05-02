import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { user, subscriptionData, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={48} />
      </div>
    );
  }

  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar suscripción activa o en prueba
  if (subscriptionData) {
    const status = subscriptionData.status;
    // Si la suscripción ha expirado, fue cancelada o no pagada, redirigir a /billing
    if (status !== 'active' && status !== 'trialing') {
      return <Navigate to="/billing" replace />;
    }
  }

  // Si hay usuario y su suscripción está activa (o aún no cargó por algún error), renderizar
  return <Outlet />;
};

export default ProtectedRoute;
