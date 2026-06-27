# Restaurant Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build verified restaurant reviews so only customers with a paid order can rate a restaurant, while the marketplace shows review scores and featured restaurants.

**Architecture:** Reviews are enforced in Supabase with a private RLS-protected `restaurant_reviews` table and public RPCs that expose only safe fields. The React app reads summaries/reviews through RPCs, checks local order tokens for eligibility, and never trusts localStorage as authorization. UI changes are additive: a new `/opiniones/:restaurantId` page, reusable star/rating components, and marketplace badges/featured section.

**Tech Stack:** React 19, Vite 8, React Router 7, Supabase JS 2, PostgreSQL/RLS/RPC, node:test, i18next.

## Global Constraints

- Clientes siguen sin cuentas.
- Solo pedidos `pagado` pueden crear reseñas.
- No usar IP, MAC address ni fingerprinting.
- No exponer `order_token`, `order_id` ni teléfono normalizado en lecturas públicas.
- No permitir `INSERT` directo público a `restaurant_reviews`.
- Español e inglés deben tener todas las claves visibles.
- No agregar dependencias nuevas.
- No cambiar flujos de pedidos, POS, pagos, cocina, login ni suscripciones salvo enlaces/badges públicos.
- Supabase MCP actualmente puede requerir OAuth; si no está disponible, crear migración local y pedir ejecución manual del SQL.

---

## File Structure

- Create `migrations/012_restaurant_reviews.sql`: table, RLS, grants, helper function, RPCs.
- Create `tests/reviews.migration.test.mjs`: static security checks for migration SQL.
- Create `tests/reviews.helpers.test.mjs`: unit tests for frontend helper behavior.
- Create `src/lib/reviews.js`: local token parsing, rating formatting, review error mapping, safe summary merging.
- Create `src/components/reviews/StarRating.jsx`: read-only and interactive stars.
- Create `src/components/reviews/ReviewSummaryBadge.jsx`: compact average/count badge.
- Create `src/components/reviews/FeaturedRestaurantsSection.jsx`: featured restaurants section.
- Create `src/pages/ReviewsPage.jsx`: public reviews page and verified review form.
- Modify `src/App.jsx`: add `/opiniones/:restaurantId` route.
- Modify `src/pages/MarketplacePage.jsx`: fetch review summaries, render badges, add featured section and review link.
- Modify `src/i18n/resources/es.js` and `src/i18n/resources/en.js`: add `reviews.*` keys.
- Modify `tests/i18n.resources.test.mjs`: require critical review keys.

---

### Task 1: Database Migration and Security Contract

**Files:**
- Create: `migrations/012_restaurant_reviews.sql`
- Create: `tests/reviews.migration.test.mjs`

**Interfaces:**
- Produces table: `public.restaurant_reviews`
- Produces RPC: `public.create_restaurant_review(p_restaurant_id uuid, p_order_token uuid, p_customer_name text, p_phone text, p_rating integer, p_comment text)`
- Produces RPC: `public.get_review_eligibility(p_restaurant_id uuid, p_order_token uuid)`
- Produces RPC: `public.get_restaurant_reviews(p_restaurant_id uuid, p_limit integer default 100)`
- Produces RPC: `public.get_restaurant_review_summary(p_restaurant_ids uuid[] default null)`

- [ ] **Step 1: Write migration security tests**

Create `tests/reviews.migration.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../migrations/012_restaurant_reviews.sql', import.meta.url), 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

test('reviews migration enables RLS and blocks direct public writes', () => {
  assert.match(normalized, /create table if not exists public\.restaurant_reviews/);
  assert.match(normalized, /alter table public\.restaurant_reviews enable row level security/);
  assert.match(normalized, /revoke all on table public\.restaurant_reviews from public, anon, authenticated/);
  assert.doesNotMatch(normalized, /grant insert on table public\.restaurant_reviews to anon/);
  assert.doesNotMatch(normalized, /grant update on table public\.restaurant_reviews to anon/);
});

test('reviews migration exposes only controlled RPCs to anon', () => {
  assert.match(normalized, /security definer/);
  assert.match(normalized, /set search_path = ''/);
  assert.match(normalized, /grant execute on function public\.create_restaurant_review\(uuid, uuid, text, text, integer, text\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_review_eligibility\(uuid, uuid\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_reviews\(uuid, integer\) to anon/);
  assert.match(normalized, /grant execute on function public\.get_restaurant_review_summary\(uuid\[\]\) to anon/);
});

test('public review readers do not return order tokens or phone numbers', () => {
  const publicReaders = normalized.slice(normalized.indexOf('create or replace function public.get_restaurant_reviews'));
  assert.doesNotMatch(publicReaders, /customer_phone_normalized/);
  assert.doesNotMatch(publicReaders, /order_token/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests\reviews.migration.test.mjs`

Expected: FAIL with `ENOENT` for `migrations/012_restaurant_reviews.sql`.

- [ ] **Step 3: Create the migration**

Create `migrations/012_restaurant_reviews.sql` with:

```sql
CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurant_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_token UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone_normalized TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurant_reviews_one_per_order UNIQUE (order_id),
  CONSTRAINT restaurant_reviews_one_phone_per_restaurant UNIQUE (restaurant_id, customer_phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_public_list
  ON public.restaurant_reviews (restaurant_id, is_hidden, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_rating
  ON public.restaurant_reviews (restaurant_id, rating);

ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.restaurant_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.restaurant_reviews TO authenticated;

DROP POLICY IF EXISTS "Restaurant owners read their reviews" ON public.restaurant_reviews;
CREATE POLICY "Restaurant owners read their reviews"
  ON public.restaurant_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = restaurant_id);

CREATE OR REPLACE FUNCTION public.normalize_review_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_review_phone(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_review_eligibility(
  p_restaurant_id UUID,
  p_order_token UUID
)
RETURNS TABLE (
  eligible BOOLEAN,
  reason TEXT,
  order_id UUID,
  order_status TEXT,
  client_name TEXT,
  phone_hint TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_phone_digits TEXT;
BEGIN
  SELECT o.id, o.status, o.client_name, o.phone, o.tenant_id
  INTO v_order
  FROM public.orders o
  WHERE o.order_token = p_order_token
  LIMIT 1;

  IF NOT FOUND OR v_order.tenant_id <> p_restaurant_id THEN
    RETURN QUERY SELECT false, 'invalid_order', NULL::UUID, NULL::TEXT, ''::TEXT, ''::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurant_reviews rr WHERE rr.order_id = v_order.id) THEN
    RETURN QUERY SELECT false, 'already_reviewed', v_order.id, v_order.status, COALESCE(v_order.client_name, ''), ''::TEXT;
    RETURN;
  END IF;

  IF v_order.status <> 'pagado' THEN
    RETURN QUERY SELECT false, 'order_not_paid', v_order.id, v_order.status, COALESCE(v_order.client_name, ''), ''::TEXT;
    RETURN;
  END IF;

  v_phone_digits := public.normalize_review_phone(v_order.phone);

  RETURN QUERY SELECT
    true,
    'eligible',
    v_order.id,
    v_order.status,
    COALESCE(v_order.client_name, ''),
    CASE
      WHEN length(v_phone_digits) >= 4 THEN repeat('*', greatest(length(v_phone_digits) - 4, 0)) || right(v_phone_digits, 4)
      ELSE ''
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_restaurant_review(
  p_restaurant_id UUID,
  p_order_token UUID,
  p_customer_name TEXT,
  p_phone TEXT,
  p_rating INTEGER,
  p_comment TEXT
)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  customer_name TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_id UUID;
  v_order RECORD;
  v_phone_normalized TEXT;
  v_order_phone_normalized TEXT;
  v_customer_name TEXT;
  v_comment TEXT;
  v_review public.restaurant_reviews%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT rp.id
  INTO v_restaurant_id
  FROM public.restaurant_profiles rp
  WHERE rp.id = p_restaurant_id
    AND rp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_restaurant';
  END IF;

  SELECT o.id, o.tenant_id, o.order_token, o.status, o.client_name, o.phone
  INTO v_order
  FROM public.orders o
  WHERE o.order_token = p_order_token
  LIMIT 1;

  IF NOT FOUND OR v_order.tenant_id <> p_restaurant_id THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;

  IF v_order.status <> 'pagado' THEN
    RAISE EXCEPTION 'order_not_paid';
  END IF;

  v_phone_normalized := public.normalize_review_phone(p_phone);
  v_order_phone_normalized := public.normalize_review_phone(v_order.phone);

  IF length(v_phone_normalized) < 8 OR v_phone_normalized <> v_order_phone_normalized THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM public.restaurant_reviews rr WHERE rr.order_id = v_order.id) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_reviews rr
    WHERE rr.restaurant_id = p_restaurant_id
      AND rr.customer_phone_normalized = v_phone_normalized
  ) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  v_customer_name := left(trim(COALESCE(NULLIF(p_customer_name, ''), v_order.client_name, 'Cliente')), 80);
  v_comment := left(trim(COALESCE(p_comment, '')), 800);

  INSERT INTO public.restaurant_reviews (
    restaurant_id,
    order_id,
    order_token,
    customer_name,
    customer_phone_normalized,
    rating,
    comment
  ) VALUES (
    p_restaurant_id,
    v_order.id,
    p_order_token,
    v_customer_name,
    v_phone_normalized,
    p_rating,
    v_comment
  )
  RETURNING * INTO v_review;

  RETURN QUERY SELECT
    v_review.id,
    v_review.restaurant_id,
    v_review.customer_name,
    v_review.rating,
    v_review.comment,
    v_review.created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_reviewed';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_restaurant_reviews(
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  customer_name TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    rr.id,
    rr.restaurant_id,
    rr.customer_name,
    rr.rating,
    rr.comment,
    rr.created_at
  FROM public.restaurant_reviews rr
  JOIN public.restaurant_profiles rp ON rp.id = rr.restaurant_id
  WHERE rr.restaurant_id = p_restaurant_id
    AND rr.is_hidden = false
    AND rp.is_active = true
  ORDER BY rr.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_restaurant_review_summary(
  p_restaurant_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  average_rating NUMERIC,
  review_count INTEGER,
  five_star_count INTEGER,
  four_star_count INTEGER,
  three_star_count INTEGER,
  two_star_count INTEGER,
  one_star_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    rr.restaurant_id,
    ROUND(AVG(rr.rating)::numeric, 1) AS average_rating,
    COUNT(*)::integer AS review_count,
    COUNT(*) FILTER (WHERE rr.rating = 5)::integer AS five_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 4)::integer AS four_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 3)::integer AS three_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 2)::integer AS two_star_count,
    COUNT(*) FILTER (WHERE rr.rating = 1)::integer AS one_star_count
  FROM public.restaurant_reviews rr
  JOIN public.restaurant_profiles rp ON rp.id = rr.restaurant_id
  WHERE rr.is_hidden = false
    AND rp.is_active = true
    AND (p_restaurant_ids IS NULL OR rr.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY rr.restaurant_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_review_eligibility(UUID, UUID) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_restaurant_review(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_reviews(UUID, INTEGER) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_review_summary(UUID[]) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.get_review_eligibility(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.create_restaurant_review(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_reviews(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_review_summary(UUID[]) TO anon;
```

- [ ] **Step 4: Run migration contract tests**

Run: `node --test tests\reviews.migration.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit database contract**

```powershell
git add migrations\012_restaurant_reviews.sql tests\reviews.migration.test.mjs
git commit -m "Add verified reviews database contract"
```

---

### Task 2: Frontend Review Helpers and Rating Components

**Files:**
- Create: `src/lib/reviews.js`
- Create: `tests/reviews.helpers.test.mjs`
- Create: `src/components/reviews/StarRating.jsx`
- Create: `src/components/reviews/ReviewSummaryBadge.jsx`

**Interfaces:**
- Produces `getStoredOrderTokens(storage = window.localStorage): string[]`
- Produces `formatRating(value): string`
- Produces `mergeReviewSummaries(restaurants, summaries): Array<object>`
- Produces `mapReviewError(errorMessageOrCode): string`
- Produces `<StarRating value onChange readOnly size />`
- Produces `<ReviewSummaryBadge summary compact />`

- [ ] **Step 1: Write helper tests**

Create `tests/reviews.helpers.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatRating,
  getStoredOrderTokens,
  mapReviewError,
  mergeReviewSummaries,
} from '../src/lib/reviews.js';

const makeStorage = (value) => ({
  getItem: (key) => (key === 'resto_order_tokens' ? value : null),
});

test('getStoredOrderTokens supports legacy strings and token objects', () => {
  const tokens = getStoredOrderTokens(makeStorage(JSON.stringify([
    'legacy-token',
    { token: 'object-token', timestamp: Date.now() },
    { token: 'object-token', timestamp: Date.now() },
    { nope: true },
  ])));

  assert.deepEqual(tokens, ['legacy-token', 'object-token']);
});

test('formatRating returns one decimal or dash', () => {
  assert.equal(formatRating(4.333), '4.3');
  assert.equal(formatRating(null), '-');
  assert.equal(formatRating(undefined), '-');
});

test('mergeReviewSummaries attaches defaults for restaurants without reviews', () => {
  const restaurants = [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }];
  const summaries = [{ restaurant_id: 'r1', average_rating: 4.8, review_count: 7 }];

  assert.deepEqual(mergeReviewSummaries(restaurants, summaries), [
    { id: 'r1', name: 'A', reviewSummary: { average_rating: 4.8, review_count: 7 } },
    { id: 'r2', name: 'B', reviewSummary: { average_rating: null, review_count: 0 } },
  ]);
});

test('mapReviewError maps controlled RPC errors', () => {
  assert.equal(mapReviewError('order_not_paid'), 'orderNotPaid');
  assert.equal(mapReviewError('phone_mismatch'), 'phoneMismatch');
  assert.equal(mapReviewError('already_reviewed'), 'alreadyReviewed');
  assert.equal(mapReviewError('something else'), 'genericError');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests\reviews.helpers.test.mjs`

Expected: FAIL because `src/lib/reviews.js` does not exist.

- [ ] **Step 3: Implement `src/lib/reviews.js`**

```js
const TOKEN_STORAGE_KEY = 'resto_order_tokens';
const MAX_REVIEW_TOKENS = 20;

export const EMPTY_REVIEW_SUMMARY = {
  average_rating: null,
  review_count: 0,
};

export const getStoredOrderTokens = (storage = globalThis.localStorage) => {
  if (!storage?.getItem) return [];

  try {
    const parsed = JSON.parse(storage.getItem(TOKEN_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    const tokens = parsed
      .map((entry) => (typeof entry === 'string' ? entry : entry?.token))
      .filter((token) => typeof token === 'string' && token.trim().length > 0)
      .map((token) => token.trim());

    return [...new Set(tokens)].slice(-MAX_REVIEW_TOKENS);
  } catch {
    return [];
  }
};

export const formatRating = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toFixed(1);
};

export const mergeReviewSummaries = (restaurants, summaries) => {
  const summaryByRestaurant = new Map(
    (summaries || []).map((summary) => [summary.restaurant_id, summary])
  );

  return (restaurants || []).map((restaurant) => ({
    ...restaurant,
    reviewSummary: summaryByRestaurant.get(restaurant.id) || EMPTY_REVIEW_SUMMARY,
  }));
};

export const mapReviewError = (message = '') => {
  const text = String(message).toLowerCase();
  if (text.includes('invalid_order')) return 'invalidOrder';
  if (text.includes('order_not_paid')) return 'orderNotPaid';
  if (text.includes('phone_mismatch')) return 'phoneMismatch';
  if (text.includes('already_reviewed')) return 'alreadyReviewed';
  if (text.includes('invalid_rating')) return 'invalidRating';
  return 'genericError';
};
```

- [ ] **Step 4: Implement `StarRating.jsx`**

Create `src/components/reviews/StarRating.jsx`:

```jsx
import { Star } from 'lucide-react';

const StarRating = ({ value = 0, onChange, readOnly = false, size = 18, className = '' }) => {
  const roundedValue = Number(value) || 0;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(roundedValue);
        const icon = (
          <Star
            size={size}
            className={filled ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
          />
        );

        if (readOnly) return <span key={star}>{icon}</span>;

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="p-1 rounded-lg hover:bg-amber-400/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-colors"
            aria-label={`${star} estrellas`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
```

- [ ] **Step 5: Implement `ReviewSummaryBadge.jsx`**

Create `src/components/reviews/ReviewSummaryBadge.jsx`:

```jsx
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { formatRating } from '../../lib/reviews';

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
```

- [ ] **Step 6: Run helper tests**

Run: `node --test tests\reviews.helpers.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit helpers and components**

```powershell
git add src\lib\reviews.js tests\reviews.helpers.test.mjs src\components\reviews\StarRating.jsx src\components\reviews\ReviewSummaryBadge.jsx
git commit -m "Add review helpers and rating components"
```

---

### Task 3: Reviews Page and i18n

**Files:**
- Create: `src/pages/ReviewsPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Modify: `tests/i18n.resources.test.mjs`

**Interfaces:**
- Consumes `getStoredOrderTokens`, `mapReviewError`, `StarRating`, `ReviewSummaryBadge`
- Produces route `/opiniones/:restaurantId`

- [ ] **Step 1: Add i18n test keys**

Modify `tests/i18n.resources.test.mjs` and add:

```js
  'reviews.title',
  'reviews.viewReviews',
  'reviews.writeReview',
  'reviews.onlyPaidOrders',
  'reviews.orderNotPaid',
  'reviews.alreadyReviewed',
  'reviews.submitReview',
  'reviews.thanks',
```

- [ ] **Step 2: Run i18n test and verify failure**

Run: `node --test tests\i18n.resources.test.mjs`

Expected: FAIL because `reviews.*` keys are missing.

- [ ] **Step 3: Add translations**

Add a top-level `reviews` object to both `src/i18n/resources/es.js` and `src/i18n/resources/en.js`.

Spanish values:

```js
reviews: {
  title: 'Opiniones del local',
  subtitle: 'Reseñas verificadas por clientes que ya compraron aquí.',
  viewReviews: 'Ver opiniones',
  noReviews: 'Sin opiniones todavía',
  reviewCountShort_one: '{{count}} opinión',
  reviewCountShort_other: '{{count}} opiniones',
  featuredTitle: 'Locales destacados',
  featuredSubtitle: 'Los favoritos de clientes verificados.',
  averageRating: 'Promedio {{rating}} de 5',
  writeReview: 'Calificar este local',
  onlyPaidOrders: 'Solo clientes con pedidos pagados pueden opinar.',
  orderNotPaid: 'Podrás opinar cuando el restaurante marque tu pedido como pagado.',
  alreadyReviewed: 'Ya dejaste una opinión para este local.',
  invalidOrder: 'No encontramos un pedido válido para este local.',
  phoneMismatch: 'El teléfono no coincide con el pedido usado para opinar.',
  invalidRating: 'Selecciona una calificación de 1 a 5 estrellas.',
  genericError: 'No se pudo guardar la opinión. Inténtalo de nuevo.',
  submitReview: 'Enviar opinión',
  thanks: 'Gracias por tu opinión.',
  yourName: 'Tu nombre',
  yourPhone: 'Teléfono del pedido',
  comment: 'Comentario',
  commentPlaceholder: 'Cuenta cómo fue tu experiencia',
  ratingRequired: 'Selecciona una calificación.',
  backToDirectory: 'Volver al directorio',
}
```

English values:

```js
reviews: {
  title: 'Restaurant reviews',
  subtitle: 'Verified reviews from customers who already ordered here.',
  viewReviews: 'View reviews',
  noReviews: 'No reviews yet',
  reviewCountShort_one: '{{count}} review',
  reviewCountShort_other: '{{count}} reviews',
  featuredTitle: 'Featured restaurants',
  featuredSubtitle: 'Customer-verified favorites.',
  averageRating: '{{rating}} out of 5 average',
  writeReview: 'Rate this place',
  onlyPaidOrders: 'Only customers with paid orders can leave a review.',
  orderNotPaid: 'You can review once the restaurant marks your order as paid.',
  alreadyReviewed: 'You already reviewed this place.',
  invalidOrder: 'We could not find a valid order for this place.',
  phoneMismatch: 'The phone number does not match the order used for this review.',
  invalidRating: 'Select a rating from 1 to 5 stars.',
  genericError: 'Could not save the review. Try again.',
  submitReview: 'Submit review',
  thanks: 'Thanks for your review.',
  yourName: 'Your name',
  yourPhone: 'Order phone number',
  comment: 'Comment',
  commentPlaceholder: 'Share what your experience was like',
  ratingRequired: 'Select a rating.',
  backToDirectory: 'Back to directory',
}
```

- [ ] **Step 4: Implement `ReviewsPage.jsx`**

Create `src/pages/ReviewsPage.jsx` as a public page that:

```jsx
// Required behaviors:
// 1. Read restaurantId from useParams().
// 2. Fetch active restaurant info from restaurant_profiles.
// 3. Fetch public reviews with supabase.rpc('get_restaurant_reviews', { p_restaurant_id: restaurantId, p_limit: 100 }).
// 4. Fetch summary with supabase.rpc('get_restaurant_review_summary', { p_restaurant_ids: [restaurantId] }).
// 5. Read local tokens with getStoredOrderTokens().
// 6. For each token, call get_review_eligibility until an eligible token is found.
// 7. Show form only when eligibility.eligible is true.
// 8. Submit via create_restaurant_review with p_restaurant_id, p_order_token, p_customer_name, p_phone, p_rating, p_comment.
// 9. Map RPC errors with mapReviewError().
// 10. Reload reviews and summary after success.
```

Use `StarRating`, `ReviewSummaryBadge`, `Logo`, `ArrowLeft`, `Loader2`, and existing `glass-panel`, `glass-input`, `btn-primary` classes.

- [ ] **Step 5: Add route in `src/App.jsx`**

Add:

```js
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
```

Add:

```jsx
<Route path="/opiniones/:restaurantId" element={<ReviewsPage />} />
```

- [ ] **Step 6: Run i18n test**

Run: `node --test tests\i18n.resources.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit reviews page**

```powershell
git add src\pages\ReviewsPage.jsx src\App.jsx src\i18n\resources\es.js src\i18n\resources\en.js tests\i18n.resources.test.mjs
git commit -m "Add verified reviews page"
```

---

### Task 4: Marketplace Ratings and Featured Restaurants

**Files:**
- Create: `src/components/reviews/FeaturedRestaurantsSection.jsx`
- Modify: `src/pages/MarketplacePage.jsx`

**Interfaces:**
- Consumes `mergeReviewSummaries(restaurants, summaries)`
- Consumes `ReviewSummaryBadge`
- Produces visible rating badge and `Ver opiniones` link per restaurant card
- Produces featured section above categories/grid

- [ ] **Step 1: Implement featured section component**

Create `src/components/reviews/FeaturedRestaurantsSection.jsx`:

```jsx
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReviewSummaryBadge from './ReviewSummaryBadge';

const FeaturedRestaurantsSection = ({ restaurants, onOpenMenu, onOpenReviews }) => {
  const { t } = useTranslation();

  const featured = (restaurants || [])
    .filter((restaurant) => Number(restaurant.reviewSummary?.review_count || 0) >= 3)
    .sort((a, b) => {
      const ratingDiff = Number(b.reviewSummary.average_rating || 0) - Number(a.reviewSummary.average_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.reviewSummary.review_count || 0) - Number(a.reviewSummary.review_count || 0);
    })
    .slice(0, 3);

  if (featured.length === 0) return null;

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
          {featured.map((restaurant) => (
            <article key={restaurant.id} className="glass-card p-4 border border-amber-400/10">
              <button onClick={() => onOpenMenu(restaurant.id)} className="text-left w-full group">
                <h3 className="font-bold text-white group-hover:text-orange-400 transition-colors truncate">{restaurant.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-1">{restaurant.description}</p>
                <div className="mt-3"><ReviewSummaryBadge summary={restaurant.reviewSummary} compact /></div>
              </button>
              <button onClick={() => onOpenReviews(restaurant.id)} className="text-xs text-orange-300 hover:text-orange-200 mt-3">
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
```

- [ ] **Step 2: Modify marketplace**

In `src/pages/MarketplacePage.jsx`:

```js
import ReviewSummaryBadge from '../components/reviews/ReviewSummaryBadge';
import FeaturedRestaurantsSection from '../components/reviews/FeaturedRestaurantsSection';
import { mergeReviewSummaries } from '../lib/reviews';
```

Add state:

```js
const [reviewSummaries, setReviewSummaries] = useState([]);
```

After restaurant fetch succeeds:

```js
const restaurantIds = (data || []).map((restaurant) => restaurant.id);
if (restaurantIds.length > 0) {
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_restaurant_review_summary', {
    p_restaurant_ids: restaurantIds,
  });
  if (!summaryError) setReviewSummaries(summaryData || []);
}
```

Add:

```js
const restaurantsWithReviews = useMemo(
  () => mergeReviewSummaries(restaurants, reviewSummaries),
  [restaurants, reviewSummaries]
);
```

Use `restaurantsWithReviews` as the source for filtering.

- [ ] **Step 3: Add review link to card**

Inside `RestaurantCard`, render:

```jsx
<div className="mb-4 flex items-center justify-between gap-3">
  <ReviewSummaryBadge summary={restaurant.reviewSummary} compact />
  <span
    role="link"
    tabIndex={0}
    onClick={(event) => {
      event.stopPropagation();
      navigate(`/opiniones/${restaurant.id}`);
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        navigate(`/opiniones/${restaurant.id}`);
      }
    }}
    className="text-xs text-orange-300 hover:text-orange-200 underline-offset-4 hover:underline"
  >
    {t('reviews.viewReviews')}
  </span>
</div>
```

Update `RestaurantCard` props to receive `navigate`.

- [ ] **Step 4: Render featured section**

After hero/search section and before category chips:

```jsx
<FeaturedRestaurantsSection
  restaurants={restaurantsWithReviews}
  onOpenMenu={(restaurantId) => navigate(`/menu/${restaurantId}`)}
  onOpenReviews={(restaurantId) => navigate(`/opiniones/${restaurantId}`)}
/>
```

- [ ] **Step 5: Commit marketplace integration**

```powershell
git add src\pages\MarketplacePage.jsx src\components\reviews\FeaturedRestaurantsSection.jsx
git commit -m "Show restaurant ratings in marketplace"
```

---

### Task 5: Full Verification and Deployment Handoff

**Files:**
- Modify only if tests expose an actual defect.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified working branch ready for push/deploy.

- [ ] **Step 1: Run all node tests**

Run:

```powershell
node --test tests\features.test.mjs tests\i18n.resources.test.mjs tests\useCityDetection.cache.test.mjs tests\reviews.helpers.test.mjs tests\reviews.migration.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code `0`.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Vite build completes successfully and includes `ReviewsPage` chunk.

- [ ] **Step 4: Apply database migration**

First try Supabase MCP or CLI only if authenticated. If MCP returns OAuth required, do not retry-loop.

Manual fallback:

```text
Open Supabase Dashboard > SQL Editor > paste the full contents of migrations/012_restaurant_reviews.sql > Run.
```

Verification SQL:

```sql
select to_regclass('public.restaurant_reviews') as reviews_table;
select proname from pg_proc where proname in (
  'create_restaurant_review',
  'get_review_eligibility',
  'get_restaurant_reviews',
  'get_restaurant_review_summary'
);
```

Expected: `public.restaurant_reviews` and 4 function rows.

- [ ] **Step 5: Browser smoke local**

Run: `npm run dev`

Open:

```text
http://localhost:5173/
```

To get an active restaurant id for the second URL, run this in the browser console on `/`:

```js
document.querySelector('[data-restaurant-id]')?.getAttribute('data-restaurant-id')
```

Then open `/opiniones/` plus the printed id. If marketplace cards do not yet expose `data-restaurant-id`, open any active restaurant card and copy the UUID segment from the resulting `/menu/...` URL.

Expected:

- `/` loads restaurants with no console crash.
- Cards show `Sin opiniones todavía` when no review summary exists.
- `/opiniones/:restaurantId` loads public restaurant information.
- Without local order token, review form is blocked with `Solo clientes con pedidos pagados pueden opinar.`

- [ ] **Step 6: Functional paid-order review smoke**

Use an existing active restaurant and a paid order token, or create a test order through the client menu and mark it `pagado` in `/pagos`.

Expected flow:

1. Customer creates order from `/menu/:tenantId`.
2. Restaurant accepts/marks order through existing flow.
3. Restaurant marks order `pagado` in `/pagos`.
4. Customer opens `/opiniones/:tenantId` from same browser.
5. Form appears.
6. Wrong phone returns translated `phoneMismatch` error.
7. Correct phone + rating creates review.
8. Second submit returns translated `alreadyReviewed` error.
9. `/` shows updated stars/count.

- [ ] **Step 7: Final commit if verification fixes were needed**

```powershell
git add src migrations tests docs
git commit -m "Fix verified reviews flow"
```

- [ ] **Step 8: Push**

Run: `git push origin main`

Expected: push succeeds and Vercel deploys from Git integration.

---

## Self-Review

Spec coverage:

- Verified paid-order-only reviews: Task 1 RPC validation and Task 3 eligibility/form.
- One review per customer per restaurant: Task 1 unique `(restaurant_id, customer_phone_normalized)`.
- One review per order: Task 1 unique `order_id`.
- Public score on `/`: Task 4 review summary badge.
- Reviews page: Task 3 `/opiniones/:restaurantId`.
- Featured restaurants: Task 4 featured section with minimum 3 reviews.
- No IP/MAC/fingerprint: Global constraints and no task introduces these.
- No public sensitive fields: Task 1 RPC-only public readers and tests.
- i18n: Task 3 translations and test.
- Verification: Task 5.

Placeholder scan:

- No `TBD`, `TODO`, or undefined future work remains in the implementation tasks.
- Optional comment behavior is explicit: optional, max 800 chars.

Type consistency:

- SQL RPC names match frontend `supabase.rpc` calls.
- `p_restaurant_ids`, `p_restaurant_id`, `p_order_token` names match Supabase JS call payloads.
- Helper names from Task 2 match imports in Tasks 3 and 4.
