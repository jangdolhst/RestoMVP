import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/index.js';

const LanguageSwitcher = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'es';

  const handleChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:border-orange-500/20">
      <Languages size={compact ? 13 : 14} className="text-orange-400" />
      {!compact && <span className="hidden sm:inline">{t('common.language.label')}</span>}
      <select
        value={currentLanguage}
        onChange={handleChange}
        className="bg-transparent text-xs font-semibold text-slate-200 outline-none"
        aria-label={t('common.language.label')}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} className="bg-slate-900 text-white">
            {compact ? language.toUpperCase() : t(`common.language.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSwitcher;
