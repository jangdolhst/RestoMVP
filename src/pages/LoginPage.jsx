import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import Logo from '../components/ui/Logo';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        navigate('/pos'); // Redirigir al dashboard/POS tras el login exitoso
      } else {
        await register(email, password);
        // Si el registro es exitoso y requiere confirmación, Supabase maneja eso. 
        // Si autologuea, entrará igual. Si requiere confirmación de email:
        setError('Registro exitoso. Revisa tu correo (si está configurado) o inicia sesión.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] relative flex items-center justify-center p-4">
      {/* Background Decorators */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none"></div>
      <div className="absolute -top-[200px] -right-[200px] w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[20%] -left-[100px] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="glass-panel w-full max-w-md p-8 relative z-10 border-t-2 border-t-orange-500/50">
        
        <div className="flex flex-col items-center mb-8">
          <Logo size="xl" showText={true} className="justify-center" />
          <p className="text-slate-500 text-xs tracking-widest uppercase font-medium mt-2">Easy Collection</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-white/5">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Iniciar Sesión
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Registrarse
          </button>
        </div>

        {error && (
          <div className={`p-3 rounded-lg mb-4 text-sm flex items-start gap-2 ${error.includes('exitoso') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-slate-300 font-medium ml-1">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-slate-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full pl-10 py-3"
                placeholder="tu@negocio.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300 font-medium ml-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full pl-10 py-3"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-semibold mt-6"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            ) : isLogin ? (
              <><LogIn size={18} /> Entrar a mi Negocio</>
            ) : (
              <><UserPlus size={18} /> Crear Restaurante</>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default LoginPage;
