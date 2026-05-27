import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Save, Check, Trash2 } from 'lucide-react';
import PhoneInput from '../components/ui/PhoneInput';

const PROFILE_KEY = 'resto_user_profile';

/**
 * UserProfilePage — Perfil local del usuario (sin registro).
 * Guarda nombre y teléfono en localStorage para auto-rellenar al ordenar.
 */
const UserProfilePage = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const { t } = useTranslation();

  // Cargar perfil guardado
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      if (stored.name) {
        setName(stored.name);
        setHasProfile(true);
      }
      if (stored.phone) setPhone(stored.phone);
    } catch {
      // silenciar
    }
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    try {
      const profile = { name: name.trim(), phone: phone.trim() };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setSaved(true);
      setHasProfile(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silenciar
    }
  };

  const handleClear = () => {
    localStorage.removeItem(PROFILE_KEY);
    setName('');
    setPhone('');
    setHasProfile(false);
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="ambient-background" />

      <div className="relative z-10 max-w-md mx-auto px-4 pt-8 pb-28">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-2 border-orange-500/30 flex items-center justify-center mb-4">
            <User size={36} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Formulario */}
        <div className="glass-panel p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {t('common.labels.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
              className="glass-input w-full text-lg"
              maxLength={50}
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {t('profile.phoneLabel')}
            </label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
            />
          </div>

          {/* Botón Guardar */}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-lg transition-all duration-300 ${
              saved
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : name.trim()
                  ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
          >
            {saved ? (
              <>
                <Check size={22} />
                {t('profile.saved')}
              </>
            ) : (
              <>
                <Save size={20} />
                {t('profile.save')}
              </>
            )}
          </button>

          {/* Borrar perfil */}
          {hasProfile && !saved && (
            <button
              onClick={handleClear}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              <Trash2 size={14} />
              {t('profile.clear')}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 glass-panel p-4 border-l-4 border-l-blue-500/50">
          <p className="text-xs text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">{t('profile.infoTitle')}</strong> — {t('profile.infoBody')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
