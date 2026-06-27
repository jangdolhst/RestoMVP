Status: completed

Implemented marketplace review surfacing in the owned files:
- Added `src/components/reviews/FeaturedRestaurantsSection.jsx` to show top-rated restaurants with at least 3 reviews.
- Updated `src/pages/MarketplacePage.jsx` to fetch review summaries after active restaurants, merge summaries before filtering, render rating badges and `Ver opiniones` controls on cards, preserve existing distance/search/category filtering, and add `data-restaurant-id` to cards.

Verification:
- `npm run lint`

Commit:
- `Show restaurant ratings in marketplace`

Concerns:
- No automated test runner is configured in this repository, so verification for this task is limited to linting.
