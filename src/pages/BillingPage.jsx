import { useAuth } from '../context/AuthContext';
import { CreditCard, LogOut, CheckCircle2 } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';

const BillingPage = () => {
  const { user, subscriptionData, logout } = useAuth();
  const navigate = useNavigate();

  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Aquí pondrás el Payment Link de Stripe
  // IMPORTANTE: Se añade ?client_reference_id={user.id} para que Stripe sepa de quién es el pago y lo envíe al Webhook
  const STRIPE_PAYMENT_LINK = `https://buy.stripe.com/14AbJ10EH5EZ3Ib7cR7bW00?client_reference_id=${user?.id}`;

  const isTrialExpired = subscriptionData?.status === 'past_due' || subscriptionData?.status === 'canceled';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30">
              <CreditCard className="text-orange-500" size={32} />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center mb-2">
            {isTrialExpired ? 'Prueba Finalizada' : 'Suscripción Inactiva'}
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Para continuar utilizando Resto-MVP y acceder a tu panel de control, por favor activa tu suscripción.
          </p>

          <div className="bg-black/20 rounded-2xl p-6 border border-white/5 mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center justify-between">
              <span>Plan Pro</span>
              <span className="text-orange-500">$250 MXN<span className="text-sm text-gray-400 font-normal">/mes</span></span>
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="text-orange-500 mr-2" size={18} /> Acceso completo al POS
              </li>
              <li className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="text-orange-500 mr-2" size={18} /> Pantalla de Cocina en tiempo real
              </li>
              <li className="flex items-center text-sm text-gray-300">
                <CheckCircle2 className="text-orange-500 mr-2" size={18} /> Menú QR digital para tus clientes
              </li>
            </ul>
          </div>

          <a 
            href={STRIPE_PAYMENT_LINK}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
          >
            Suscribirse Ahora
          </a>

          <button 
            onClick={handleLogout}
            className="w-full mt-4 bg-transparent hover:bg-white/5 text-gray-400 font-medium py-3 rounded-xl flex justify-center items-center gap-2 transition-all"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
