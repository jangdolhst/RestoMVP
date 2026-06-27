import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';

import ReviewSummaryBadge from '../components/reviews/ReviewSummaryBadge.jsx';
import StarRating from '../components/reviews/StarRating.jsx';
import Logo from '../components/ui/Logo.jsx';
import { EMPTY_REVIEW_SUMMARY, formatRating, getStoredOrderTokens, mapReviewError } from '../lib/reviews.js';
import { supabase } from '../lib/supabase.js';

const ELIGIBILITY_PRIORITY = {
  alreadyReviewed: 3,
  orderNotPaid: 2,
  invalidOrder: 1,
  genericError: 0,
};

const ReviewsPage = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(EMPTY_REVIEW_SUMMARY);
  const [pageLoading, setPageLoading] = useState(true);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [eligibility, setEligibility] = useState({ eligible: false, token: null, reason: null, clientName: '' });
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviewsData = useCallback(async () => {
    if (!restaurantId) {
      setRestaurant(null);
      setReviews([]);
      setSummary(EMPTY_REVIEW_SUMMARY);
      setPageError('invalidOrder');
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    setPageError('');

    try {
      const [restaurantResult, reviewsResult, summaryResult] = await Promise.all([
        supabase
          .from('restaurant_profiles')
          .select('id, name, description, logo_url, banner_url, address')
          .eq('id', restaurantId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase.rpc('get_restaurant_reviews', {
          p_restaurant_id: restaurantId,
          p_limit: 100,
        }),
        supabase.rpc('get_restaurant_review_summary', {
          p_restaurant_ids: [restaurantId],
        }),
      ]);

      if (restaurantResult.error) throw restaurantResult.error;
      if (reviewsResult.error) throw reviewsResult.error;
      if (summaryResult.error) throw summaryResult.error;

      setRestaurant(restaurantResult.data || null);
      setReviews(reviewsResult.data || []);
      setSummary(summaryResult.data?.[0] || EMPTY_REVIEW_SUMMARY);

      if (!restaurantResult.data) {
        setPageError('invalidOrder');
      }
    } catch (error) {
      console.error('Error loading reviews page:', error.message);
      setRestaurant(null);
      setReviews([]);
      setSummary(EMPTY_REVIEW_SUMMARY);
      setPageError('genericError');
    } finally {
      setPageLoading(false);
    }
  }, [restaurantId]);

  const loadEligibility = useCallback(async () => {
    if (!restaurantId) {
      setEligibility({ eligible: false, token: null, reason: 'invalidOrder', clientName: '' });
      setEligibilityLoading(false);
      return;
    }

    setEligibilityLoading(true);

    const tokens = [...getStoredOrderTokens()].reverse();
    if (tokens.length === 0) {
      setEligibility({ eligible: false, token: null, reason: null, clientName: '' });
      setEligibilityLoading(false);
      return;
    }

    let bestCandidate = null;

    for (const token of tokens) {
      const { data, error } = await supabase.rpc('get_review_eligibility', {
        p_restaurant_id: restaurantId,
        p_order_token: token,
      });

      if (error) {
        const reason = mapReviewError(error.message);
        if (!bestCandidate || ELIGIBILITY_PRIORITY[reason] > ELIGIBILITY_PRIORITY[bestCandidate.reason]) {
          bestCandidate = { eligible: false, token: null, reason, clientName: '' };
        }
        continue;
      }

      const result = data?.[0];
      if (!result) continue;

      if (result.eligible) {
        setEligibility({
          eligible: true,
          token,
          reason: 'eligible',
          clientName: result.client_name || '',
        });
        setEligibilityLoading(false);
        return;
      }

      const reason = mapReviewError(result.reason);
      if (!bestCandidate || ELIGIBILITY_PRIORITY[reason] > ELIGIBILITY_PRIORITY[bestCandidate.reason]) {
        bestCandidate = {
          eligible: false,
          token: null,
          reason,
          clientName: result.client_name || '',
        };
      }
    }

    setEligibility(bestCandidate || { eligible: false, token: null, reason: 'invalidOrder', clientName: '' });
    setEligibilityLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadReviewsData();
    loadEligibility();
  }, [loadEligibility, loadReviewsData]);

  useEffect(() => {
    if (!eligibility.eligible) return;
    setCustomerName((current) => current || eligibility.clientName || '');
  }, [eligibility]);

  const formattedAverage = useMemo(() => formatRating(summary.average_rating), [summary.average_rating]);

  const formatReviewDate = (value) => {
    try {
      return new Date(value).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!eligibility.eligible || !eligibility.token) return;

    if (!rating) {
      setSubmitError('ratingRequired');
      setSubmitSuccess(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      const { error } = await supabase.rpc('create_restaurant_review', {
        p_restaurant_id: restaurantId,
        p_order_token: eligibility.token,
        p_customer_name: customerName.trim(),
        p_phone: phone.trim(),
        p_rating: rating,
        p_comment: comment.trim(),
      });

      if (error) throw error;

      setSubmitSuccess(true);
      setPhone('');
      setComment('');
      setRating(0);
      await Promise.all([loadReviewsData(), loadEligibility()]);
    } catch (error) {
      setSubmitError(mapReviewError(error.message));
      setSubmitSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showInitialLoader = pageLoading && !restaurant && reviews.length === 0;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden">
      <div className="ambient-background" />

      <header className="sticky top-0 z-10 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={t('reviews.backToDirectory')}
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex-1 flex justify-center">
            {restaurant?.logo_url ? (
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name || t('reviews.title')}
                  className="w-10 h-10 rounded-xl object-cover border border-white/10"
                />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{t('reviews.viewReviews')}</p>
                  <h1 className="text-lg font-semibold truncate">{restaurant.name}</h1>
                </div>
              </div>
            ) : (
              <Logo size="md" showText={true} />
            )}
          </div>

          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-12 space-y-6">
        {showInitialLoader ? (
          <div className="glass-panel p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="animate-spin text-orange-400" size={28} />
            <p>{t('common.actions.loading')}</p>
          </div>
        ) : (
          <>
            <section className="glass-panel overflow-hidden">
              {restaurant?.banner_url ? (
                <div className="h-40 sm:h-56 overflow-hidden border-b border-white/10">
                  <img
                    src={restaurant.banner_url}
                    alt={restaurant.name || t('reviews.title')}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <p className="text-orange-300 text-sm font-medium">{t('reviews.title')}</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    {restaurant?.name || t('reviews.title')}
                  </h2>
                  <p className="text-slate-400 max-w-2xl">{t('reviews.subtitle')}</p>
                  {restaurant?.description ? (
                    <p className="text-sm text-slate-500 max-w-2xl">{restaurant.description}</p>
                  ) : null}
                  {restaurant?.address ? (
                    <p className="text-sm text-slate-500">{restaurant.address}</p>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10 pt-4">
                  <ReviewSummaryBadge summary={summary} />
                  {Number(summary.review_count || 0) > 0 ? (
                    <p className="text-sm text-slate-400">
                      {t('reviews.averageRating', { rating: formattedAverage })}
                    </p>
                  ) : null}
                </div>

                {pageError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {t(`reviews.${pageError}`)}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{t('reviews.viewReviews')}</h3>
                    <p className="text-sm text-slate-500">
                      {t('reviews.reviewCountShort', { count: Number(summary.review_count || 0) })}
                    </p>
                  </div>
                  <ReviewSummaryBadge summary={summary} compact />
                </div>

                {pageLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="animate-spin text-orange-400" size={16} />
                    <span>{t('common.actions.loading')}</span>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-400">
                    {t('reviews.noReviews')}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <article key={review.id} className="rounded-2xl border border-white/10 bg-black/10 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium text-white">{review.customer_name}</h4>
                            <p className="text-xs text-slate-500">{formatReviewDate(review.created_at)}</p>
                          </div>
                          <StarRating value={review.rating} readOnly size={16} />
                        </div>
                        {review.comment ? (
                          <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">{review.comment}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="glass-panel p-6 space-y-4 h-fit">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">{t('reviews.writeReview')}</h3>
                  <p className="text-sm text-slate-400">{t('reviews.onlyPaidOrders')}</p>
                </div>

                {submitSuccess ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {t('reviews.thanks')}
                  </div>
                ) : null}

                {eligibilityLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="animate-spin text-orange-400" size={16} />
                    <span>{t('common.actions.loading')}</span>
                  </div>
                ) : eligibility.eligible ? (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <label htmlFor="review-rating" className="text-sm text-slate-300">
                        {t('reviews.writeReview')}
                      </label>
                      <div id="review-rating" className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                        <StarRating value={rating} onChange={setRating} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="review-name" className="text-sm text-slate-300">
                        {t('reviews.yourName')}
                      </label>
                      <input
                        id="review-name"
                        type="text"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        className="glass-input w-full"
                        maxLength={80}
                        autoComplete="name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="review-phone" className="text-sm text-slate-300">
                        {t('reviews.yourPhone')}
                      </label>
                      <input
                        id="review-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="glass-input w-full"
                        maxLength={24}
                        autoComplete="tel"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="review-comment" className="text-sm text-slate-300">
                        {t('reviews.comment')}
                      </label>
                      <textarea
                        id="review-comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        className="glass-input w-full min-h-32 resize-y"
                        maxLength={800}
                        placeholder={t('reviews.commentPlaceholder')}
                      />
                    </div>

                    {submitError ? (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {t(`reviews.${submitError}`)}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                      <span>{t('reviews.submitReview')}</span>
                    </button>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 space-y-2">
                    <p className="text-sm text-slate-300">{t('reviews.onlyPaidOrders')}</p>
                    {eligibility.reason ? (
                      <p className="text-sm text-slate-500">{t(`reviews.${eligibility.reason}`)}</p>
                    ) : null}
                  </div>
                )}
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default ReviewsPage;
