import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ReviewSummaryBadge from './ReviewSummaryBadge.jsx';
import { isRestaurantOpen } from '../../utils/businessHours';

const MIN_FEATURED_REVIEW_COUNT = 3;
const MAX_FEATURED_RESTAURANTS = 3;

const FeaturedRestaurantsSection = ({ restaurants, onOpenMenu, onOpenReviews }) => {
  const { t } = useTranslation();

  const featuredRestaurants = (restaurants || [])
    .filter((restaurant) => Number(restaurant.reviewSummary?.review_count || 0) >= MIN_FEATURED_REVIEW_COUNT)
    .sort((left, right) => {
      const ratingDiff =
        Number(right.reviewSummary?.average_rating || 0) - Number(left.reviewSummary?.average_rating || 0);

      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return Number(right.reviewSummary?.review_count || 0) - Number(left.reviewSummary?.review_count || 0);
    })
    .slice(0, MAX_FEATURED_RESTAURANTS);

  if (featuredRestaurants.length === 0) {
    return null;
  }

  return (
    <section className="relative z-10 px-4 sm:px-6 pb-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-amber-300" />
          <div>
            <h2 className="text-xl font-bold text-white">{t('reviews.featuredTitle')}</h2>
            <p className="text-xs text-slate-500">{t('reviews.featuredSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {featuredRestaurants.map((restaurant) => (
            <article key={restaurant.id} className="glass-card p-4 border border-amber-400/10">
              <button
                type="button"
                onClick={() => {
                  if (!isRestaurantOpen(restaurant.business_hours)) return;
                  onOpenMenu(restaurant.id);
                }}
                disabled={!isRestaurantOpen(restaurant.business_hours)}
                className="text-left w-full group disabled:cursor-not-allowed disabled:opacity-70"
              >
                <h3 className="font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                  {restaurant.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-1">{restaurant.description}</p>
                <div className="mt-3">
                  <ReviewSummaryBadge summary={restaurant.reviewSummary} compact />
                </div>
              </button>
              <button
                type="button"
                onClick={() => onOpenReviews(restaurant.id)}
                className="text-xs text-orange-300 hover:text-orange-200 mt-3"
              >
                {t('reviews.viewReviews')}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedRestaurantsSection;
