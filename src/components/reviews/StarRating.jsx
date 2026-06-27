import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';

const StarRating = ({ value = 0, onChange, readOnly = false, size = 18 }) => {
  const { t } = useTranslation();
  const rating = Number(value) || 0;

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        const icon = (
          <Star
            size={size}
            className={filled ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
          />
        );

        if (readOnly) {
          return <span key={star}>{icon}</span>;
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="rounded-lg p-1 transition-colors hover:bg-amber-400/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            aria-label={t('reviews.starLabel', { star })}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
