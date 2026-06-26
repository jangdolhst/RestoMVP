import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';

const ResetPasswordPage = () => {
  const { session, isLoading: isAuthLoading, updatePassword, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorDescription = params.get('error_description');

    if (errorDescription) {
      setMessageType('error');
      setMessage(errorDescription);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setMessageType('error');

    if (password.length < 6) {
      setMessage(t('auth.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      await logout();
      setMessageType('success');
      setMessage(t('auth.passwordUpdated'));
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setMessageType('error');
      setMessage(err.message || t('auth.resetError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canUpdatePassword = Boolean(session);

  return (
    <div className="min-h-screen bg-[#0B0F19] relative flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[200px] -right-[200px] w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] -left-[100px] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md p-8 relative z-10 border-t-2 border-t-orange-500/50">
        <div className="flex flex-col items-center mb-8">
          <Logo size="xl" showText={true} className="justify-center" />
          <p className="text-slate-500 text-xs tracking-widest uppercase font-medium mt-2">Easy Collection</p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="mb-5 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound size={16} className="text-orange-400" />
            {t('auth.newPasswordTitle')}
          </p>
          <p className="text-xs text-slate-400 mt-1">{t('auth.newPasswordDescription')}</p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm flex items-start gap-2 ${messageType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {messageType === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <p>{message}</p>
          </div>
        )}

        {!isAuthLoading && !canUpdatePassword ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {t('auth.resetSessionMissing')}
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-semibold"
            >
              {t('auth.backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium ml-1">{t('auth.newPassword')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-10 pr-12 py-3"
                  placeholder="********"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-white transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium ml-1">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-500" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="glass-input w-full pl-10 pr-12 py-3"
                  placeholder="********"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-white transition-colors"
                  aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isAuthLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-semibold mt-6"
            >
              <KeyRound size={18} />
              {isSubmitting || isAuthLoading ? t('common.actions.processing') : t('auth.updatePassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
