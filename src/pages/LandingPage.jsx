import { useNavigate } from 'react-router-dom';
import { Smartphone, Zap, CheckCircle2 } from 'lucide-react';
import Logo from '../components/ui/Logo';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 py-12 relative z-10 flex flex-col min-h-screen">
        
        {/* Navbar */}
        <header className="flex justify-between items-center mb-16">
            <Logo size="lg" showText={true} onClick={() => navigate('/')} />
          <button onClick={() => navigate('/pos')} className="btn-secondary hidden md:block">
            Acceso Negocios
          </button>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto mt-10 md:mt-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-orange-400 text-sm font-medium mb-6">
            <Zap size={16} />
            <span>El futuro de la gestión de restaurantes</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Toma órdenes como un <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">profesional.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl leading-relaxed">
            Dile adiós al papel y lápiz. Jamm Free es un sistema de Punto de Venta (POS) y Cocina (KDS) en tiempo real, diseñado para hacer tu restaurante más rápido y eficiente.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
            <button 
              onClick={() => navigate('/pos')}
              className="btn-primary text-lg px-8 py-4 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
            >
              Iniciar Sesión (Negocio)
            </button>
          </div>
        </main>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 mb-10 max-w-5xl mx-auto">
          <div className="glass-card p-6">
            <CheckCircle2 className="text-orange-400 mb-4" size={32} />
            <h3 className="text-xl font-bold text-white mb-2">Pedidos en Línea</h3>
            <p className="text-slate-400">Tus clientes pueden escanear un QR y pedir directamente desde su celular sin intermediarios.</p>
          </div>
          <div className="glass-card p-6">
            <CheckCircle2 className="text-blue-400 mb-4" size={32} />
            <h3 className="text-xl font-bold text-white mb-2">Cocina en Tiempo Real</h3>
            <p className="text-slate-400">Los pedidos llegan a la cocina al instante, con alertas visuales para órdenes urgentes o demoradas.</p>
          </div>
          <div className="glass-card p-6">
            <CheckCircle2 className="text-emerald-400 mb-4" size={32} />
            <h3 className="text-xl font-bold text-white mb-2">Gestión de Pagos</h3>
            <p className="text-slate-400">Control absoluto sobre las mesas, cobros y un historial de ventas detallado en todo momento.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;
