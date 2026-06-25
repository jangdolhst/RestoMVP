import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { hasFeature } from '../../lib/features';

const FeatureGate = ({ feature, children, title, description, compact = false }) => {
  const { subscriptionData } = useAuth();
  const { t } = useTranslation();

  if (hasFeature(subscriptionData, feature)) {
    return children;
  }

  return (
    <div className={`glass-panel border border-amber-500/20 bg-amber-500/5 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <LockKeyhole size={20} className="text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300 mb-1">
            {t('premium.badge')}
          </p>
          <h2 className="text-lg font-bold text-white">
            {title || t('premium.lockedTitle')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {description || t('premium.lockedDescription')}
          </p>
          <Link
            to="/billing"
            className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold transition-colors"
          >
            {t('premium.upgradeCta')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeatureGate;
