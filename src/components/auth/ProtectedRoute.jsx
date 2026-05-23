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
  // Si subscriptionData es null (error de red, fila eliminada), denegar acceso
  const subStatus = subscriptionData?.status;
  if (subStatus !== 'active' && subStatus !== 'trialing') {
    return <Navigate to="/billing" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
