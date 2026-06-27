Task 3 Report - Reviews Page and i18n

Status: Completed.

Implemented:
- Added public reviews page at `src/pages/ReviewsPage.jsx`.
- Added `/opiniones/:restaurantId` route in `src/App.jsx`.
- Extended the existing `reviews` i18n object in `src/i18n/resources/es.js` and `src/i18n/resources/en.js` without creating duplicate top-level keys.
- Expanded `tests/i18n.resources.test.mjs` with the required review resource keys.

Behavior notes:
- Public page loads active restaurant info, public reviews, and review summary via the required Supabase RPCs.
- Local order tokens are checked until an eligible token is found; the form is only shown when `get_review_eligibility` returns `eligible: true`.
- Review submission uses `create_restaurant_review` and refreshes the page data after success.
- The page keeps the order token internal and does not render order id, order token, or stored phone data.

Verification:
- `node --test tests\i18n.resources.test.mjs`
- `npm run lint`

Notes:
- No marketplace changes were made.
- No database changes were made.
