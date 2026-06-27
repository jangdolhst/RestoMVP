import { useTranslation } from 'react-i18next';

import { formatRating } from '../../lib/reviews.js';
import StarRating from './StarRating.jsx';

const ReviewSummaryBadge = ({ summary, compact = false }) => {
  const { t } = useTranslation();
  const count = Number(summary?.review_count || 0);
  const average = summary?.average_rating;

  if (count === 0) {
    return <span className="text-xs text-slate-500">{t('reviews.noReviews')}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <StarRating value={Number(average)} readOnly size={compact ? 13 : 15} />
      <strong className="text-amber-300">{formatRating(average)}</strong>
      <span className="text-slate-500">{t('reviews.reviewCountShort', { count })}</span>
    </span>
  );
};

export default ReviewSummaryBadge;
