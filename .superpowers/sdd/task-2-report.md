# Task 2 Report: Frontend Review Helpers and Rating Components

## Outcome
- Added review helper utilities in `src/lib/reviews.js`.
- Added helper coverage in `tests/reviews.helpers.test.mjs`.
- Added the rating UI in `src/components/reviews/StarRating.jsx`.
- Added the review summary badge in `src/components/reviews/ReviewSummaryBadge.jsx`.

## Verification
- `node --test tests\reviews.helpers.test.mjs`
- Result: pass

## Notes
- `getStoredOrderTokens` accepts both legacy string tokens and token objects, deduplicates them, and limits the stored list.
- `mergeReviewSummaries` attaches a normalized `reviewSummary` object to every restaurant, including the empty default for restaurants without reviews.
- `ReviewSummaryBadge` uses `defaultValue` fallbacks so the component stays readable even if the review translation keys are not yet present.
