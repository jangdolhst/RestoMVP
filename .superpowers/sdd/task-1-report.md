# Task 1 Report: Database Migration and Security Contract

## Outcome
- Implemented the restaurant reviews database contract in `migrations/012_restaurant_reviews.sql`.
- Added the migration contract test in `tests/reviews.migration.test.mjs`.

## Verification
- `node --test tests\reviews.migration.test.mjs`
- Result: pass

## Notes
- The migration creates `public.restaurant_reviews`, enables RLS, revokes direct public table access, and exposes only the controlled RPCs required by the brief.
- The public review reader RPC returns only safe review fields and does not expose order tokens, order IDs, or phone numbers.

## Fix Report
- Removed `order_id` from the `public.get_review_eligibility` return contract.
- Updated every public eligibility return path to stop emitting the internal order identifier.
- Strengthened `tests/reviews.migration.test.mjs` so it checks the eligibility RPC return clauses and the public reader RPC surfaces for `order_id`, `order_token`, and `customer_phone_normalized` exposure.

## Verification
- `node --test tests\reviews.migration.test.mjs`
- Result: pass
