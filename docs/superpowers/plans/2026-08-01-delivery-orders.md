# Delivery Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-plan restaurant-managed delivery orders with fixed, manual, free, and per-km delivery fees, customer address/GPS capture, secure server-side fee validation, and delivery status tracking.

**Architecture:** Store delivery configuration on `restaurant_profiles` and delivery metadata on `orders`. The frontend calculates a preview for usability, but Supabase RPCs must recalculate and persist delivery fees so browser tampering cannot reduce totals. Existing pickup/local flows remain compatible; delivery extends the current lifecycle with `en_entrega` and `entregado`.

**Tech Stack:** React 19, Vite 8, Supabase Postgres/RPC/RLS, `@supabase/supabase-js`, `react-leaflet`, `node:test`, ESLint.

## Global Constraints

- Delivery is free; do not add `FeatureGate` or `PREMIUM_FEATURES`.
- Restaurants manage delivery externally; do not add driver users, routes, or internal delivery roles.
- Customers still do not have accounts; tracking continues with `order_token` in localStorage.
- The browser may show an estimated fee, but Supabase must calculate the final fee.
- Existing pickup/local POS flows must not require address or GPS.
- Finance must count delivery fee inside `orders.total` after payment.
- All visible copy must use i18n keys in Spanish and English.
- Do not add a paid distance API; use Haversine distance between restaurant/customer coordinates.

---

## File Structure

- Create `src/lib/delivery.js`: delivery settings normalization, Haversine distance, fee calculation, fulfillment availability.
- Create `tests/delivery.test.mjs`: delivery helper unit tests.
- Create `tests/delivery.migration.test.mjs`: static tests for delivery schema/RPC migration.
- Create or extend `tests/delivery.integration.test.mjs`: source-level wiring tests.
- Create `migrations/016_delivery_orders.sql`: DB columns, constraints, RPC updates.
- Modify `src/context/POSContext.jsx`: delivery state, order selects, public RPC payload, status whitelist.
- Modify `src/pages/SettingsPage.jsx`: delivery configuration UI.
- Modify `src/components/pos/TicketSidebar.jsx`: customer delivery checkout UI.
- Modify `src/pages/ClientePage.jsx`: load delivery settings for public menu.
- Modify `src/pages/PagosPage.jsx`: delivery details, manual fee, `en_entrega` / `entregado` actions.
- Modify `src/pages/CocinaPage.jsx`: delivery badge/details for kitchen.
- Modify `src/pages/OrderTrackingPage.jsx`: customer delivery tracking statuses.
- Modify `src/components/ui/PendingOrderNotifier.jsx`: stronger alert for new delivery/online orders.
- Modify `src/i18n/resources/es.js` and `src/i18n/resources/en.js`: delivery copy.

---

### Task 1: Delivery Helper Library

**Files:**
- Create: `src/lib/delivery.js`
- Test: `tests/delivery.test.mjs`

**Interfaces:**
- Produces `DELIVERY_SERVICE_MODES`, `DELIVERY_FEE_MODES`, `normalizeDeliverySettings(profile)`, `calculateDistanceKm(from, to)`, `calculateDeliveryFee(settings, distanceKm)`, `canUseFulfillment(settings, fulfillmentType)`.

- [ ] **Step 1: Write failing tests**

Create `tests/delivery.test.mjs` with tests for:

```js
calculateDistanceKm(
  { latitude: 32.6101, longitude: -115.4494 },
  { latitude: 32.6245, longitude: -115.4523 }
)
```

Expected rounded distance: `1.6`.

Also test:

```js
calculateDeliveryFee({ delivery_fee_mode: 'free' }, 4.2)
// { fee: 0, distanceKm: 4.2, status: 'confirmed', reason: null }

calculateDeliveryFee({ delivery_fee_mode: 'fixed', delivery_fixed_fee_mxn: 35 }, 4.2)
// { fee: 35, distanceKm: 4.2, status: 'confirmed', reason: null }

calculateDeliveryFee({ delivery_fee_mode: 'manual' }, 4.2)
// { fee: null, distanceKm: 4.2, status: 'pending_manual', reason: 'manual_fee_required' }

calculateDeliveryFee({ delivery_fee_mode: 'per_km', delivery_base_fee_mxn: 20, delivery_fee_per_km_mxn: 10 }, 3.4)
// { fee: 54, distanceKm: 3.4, status: 'confirmed', reason: null }
```

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.test.mjs`

Expected: FAIL because `src/lib/delivery.js` does not exist.

- [ ] **Step 3: Implement helper**

Implement these exports exactly:

```js
export const DELIVERY_SERVICE_MODES = ['pickup_only', 'delivery_only', 'pickup_and_delivery'];
export const DELIVERY_FEE_MODES = ['free', 'fixed', 'per_km', 'manual'];
export const normalizeDeliverySettings = (profile = {}) => normalizedSettingsObject;
export const canUseFulfillment = (settings, fulfillmentType) => boolean;
export const calculateDistanceKm = (from, to) => distanceKmOrNull;
export const calculateDeliveryFee = (settings, distanceKm) => deliveryQuoteObject;
```

Return shapes:

```js
normalizedSettingsObject = {
  delivery_service_mode: 'pickup_only' | 'delivery_only' | 'pickup_and_delivery',
  delivery_fee_mode: 'free' | 'fixed' | 'per_km' | 'manual',
  delivery_fixed_fee_mxn: number,
  delivery_base_fee_mxn: number,
  delivery_fee_per_km_mxn: number,
  delivery_max_distance_km: number | null,
  delivery_min_order_mxn: number | null,
  delivery_eta_min_minutes: number | null,
  delivery_eta_max_minutes: number | null,
};

distanceKmOrNull = number | null;

deliveryQuoteObject = {
  fee: number | null,
  distanceKm: number | null,
  status: 'not_applicable' | 'pending_manual' | 'confirmed',
  reason: null | 'manual_fee_required' | 'distance_required' | 'outside_delivery_radius',
};
```

Rules:

- Unknown `delivery_service_mode` falls back to `pickup_only`.
- Unknown `delivery_fee_mode` falls back to `manual`.
- Money values are non-negative and rounded to 2 decimals.
- Distance is rounded to 1 decimal.
- `per_km` without distance returns `reason: 'distance_required'`.
- `per_km` beyond radius returns `reason: 'outside_delivery_radius'`.

- [ ] **Step 4: Run green test**

Run: `node --test tests/delivery.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/delivery.js tests/delivery.test.mjs
git commit -m "Add delivery fee helpers"
```

---

### Task 2: Delivery Schema And Secure RPCs

**Files:**
- Create: `migrations/016_delivery_orders.sql`
- Test: `tests/delivery.migration.test.mjs`

**Interfaces:**
- Produces profile delivery settings columns.
- Produces order delivery metadata columns.
- Updates `create_public_order` to accept delivery input but never a client-provided fee.
- Adds `set_manual_delivery_fee(p_order_id uuid, p_delivery_fee_mxn numeric)`.

- [ ] **Step 1: Write failing migration tests**

Create `tests/delivery.migration.test.mjs` and assert the migration contains:

```js
assert.match(normalized, /add column if not exists delivery_service_mode text not null default 'pickup_only'/);
assert.match(normalized, /add column if not exists delivery_fee_mode text not null default 'manual'/);
assert.match(normalized, /add column if not exists fulfillment_type text not null default 'pickup'/);
assert.match(normalized, /add column if not exists delivery_fee_mxn numeric\(10,2\) not null default 0/);
assert.match(normalized, /create or replace function public\.create_public_order\(/);
assert.match(normalized, /p_fulfillment_type text default 'pickup'/);
assert.match(normalized, /p_delivery_latitude numeric default null/);
assert.match(normalized, /v_delivery_fee_mxn/);
assert.doesNotMatch(normalized, /p_delivery_fee_mxn/);
assert.match(normalized, /create or replace function public\.set_manual_delivery_fee\(p_order_id uuid, p_delivery_fee_mxn numeric\)/);
assert.match(normalized, /auth\.uid\(\) <> v_order\.tenant_id/);
```

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.migration.test.mjs`

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Write migration**

Add profile columns:

```sql
ALTER TABLE public.restaurant_profiles
  ADD COLUMN IF NOT EXISTS delivery_service_mode TEXT NOT NULL DEFAULT 'pickup_only',
  ADD COLUMN IF NOT EXISTS delivery_fee_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS delivery_fixed_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_base_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_per_km_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_max_distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS delivery_min_order_mxn NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS delivery_eta_min_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_eta_max_minutes INTEGER;
```

Add order columns:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference TEXT,
  ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_mxn NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS delivery_fee_note TEXT;
```

Add constraints:

- `delivery_service_mode IN ('pickup_only', 'delivery_only', 'pickup_and_delivery')`
- `delivery_fee_mode IN ('free', 'fixed', 'per_km', 'manual')`
- `fulfillment_type IN ('pickup', 'delivery')`
- `delivery_fee_status IN ('not_applicable', 'pending_manual', 'confirmed')`
- money/distance fields non-negative.
- lat between `-90` and `90`, lng between `-180` and `180`.

Recreate `create_public_order` with signature:

```sql
public.create_public_order(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_items JSONB,
  p_fulfillment_type TEXT DEFAULT 'pickup',
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_reference TEXT DEFAULT NULL,
  p_delivery_latitude NUMERIC DEFAULT NULL,
  p_delivery_longitude NUMERIC DEFAULT NULL
)
```

Server-side rules:

- If restaurant is `pickup_only`, reject delivery.
- If restaurant is `delivery_only`, reject pickup.
- If delivery and `delivery_min_order_mxn` is not met, reject.
- If `per_km`, require restaurant coordinates and customer coordinates.
- Compute Haversine distance in SQL.
- If outside radius, reject with `outside_delivery_radius`.
- Store product total + delivery fee in `orders.total`.
- Store manual fee orders with `delivery_fee_status = 'pending_manual'` and `delivery_fee_mxn = 0`.

Add authenticated-only RPC:

```sql
public.set_manual_delivery_fee(p_order_id UUID, p_delivery_fee_mxn NUMERIC)
```

Rules:

- `auth.uid()` must match `orders.tenant_id`.
- Only delivery orders with `delivery_fee_status = 'pending_manual'`.
- Fee must be non-negative.
- Update `delivery_fee_mxn`, `delivery_fee_status = 'confirmed'`, and `total = total + p_delivery_fee_mxn`.

- [ ] **Step 4: Run green test**

Run: `node --test tests/delivery.migration.test.mjs`

Expected: PASS.

- [ ] **Step 5: Apply and verify in Supabase**

Use MCP `apply_migration` on project `btqsgyjccanitrpvahzm`, migration name `016_delivery_orders`.

Verify:

```sql
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_profiles' AND column_name = 'delivery_service_mode') AS profile_delivery_ok,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'fulfillment_type') AS orders_delivery_ok,
  has_function_privilege('anon', 'public.create_public_order(uuid, text, text, jsonb, text, text, text, numeric, numeric)', 'EXECUTE') AS anon_create_delivery_order_ok,
  has_function_privilege('anon', 'public.set_manual_delivery_fee(uuid, numeric)', 'EXECUTE') AS anon_manual_fee_blocked;
```

Expected: first three `true`, last one `false`.

- [ ] **Step 6: Commit**

```bash
git add migrations/016_delivery_orders.sql tests/delivery.migration.test.mjs
git commit -m "Add delivery order schema"
```

---

### Task 3: POS Context Delivery Wiring

**Files:**
- Modify: `src/context/POSContext.jsx`
- Test: `tests/delivery.integration.test.mjs`

**Interfaces:**
- Adds context state for `fulfillmentType`, `deliveryAddress`, `deliveryReference`, `deliveryLatitude`, `deliveryLongitude`.
- Maps delivery order DB fields to camelCase fields.

- [ ] **Step 1: Write failing source tests**

Create `tests/delivery.integration.test.mjs` with assertions that `POSContext.jsx` contains:

```js
delivery_service_mode
delivery_fee_mode
delivery_address
delivery_fee_mxn
fulfillmentType
p_fulfillment_type: fulfillmentType
p_delivery_address: deliveryAddress
p_delivery_latitude: deliveryLatitude
en_entrega
entregado
```

Also assert it does not contain `p_delivery_fee_mxn`.

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Update selects**

Add profile fields to `PROFILE_SELECT`:

```text
delivery_service_mode, delivery_fee_mode, delivery_fixed_fee_mxn, delivery_base_fee_mxn, delivery_fee_per_km_mxn, delivery_max_distance_km, delivery_min_order_mxn, delivery_eta_min_minutes, delivery_eta_max_minutes
```

Add order fields to `ORDER_SELECT`:

```text
fulfillment_type, delivery_address, delivery_reference, delivery_latitude, delivery_longitude, delivery_distance_km, delivery_fee_mxn, delivery_fee_status, delivery_fee_note
```

- [ ] **Step 4: Add checkout state and reset**

Add state:

```js
const [fulfillmentType, setFulfillmentType] = useState('pickup');
const [deliveryAddress, setDeliveryAddress] = useState('');
const [deliveryReference, setDeliveryReference] = useState('');
const [deliveryLatitude, setDeliveryLatitude] = useState(null);
const [deliveryLongitude, setDeliveryLongitude] = useState(null);
```

Reset those fields in `clearCart()`.

- [ ] **Step 5: Update public RPC payload**

Send:

```js
p_fulfillment_type: fulfillmentType,
p_delivery_address: fulfillmentType === 'delivery' ? deliveryAddress : null,
p_delivery_reference: fulfillmentType === 'delivery' ? deliveryReference : null,
p_delivery_latitude: fulfillmentType === 'delivery' ? deliveryLatitude : null,
p_delivery_longitude: fulfillmentType === 'delivery' ? deliveryLongitude : null,
```

Do not send a delivery fee.

- [ ] **Step 6: Add statuses**

```js
const VALID_ORDER_STATUSES = ['pendiente_confirmacion', 'pendiente_cocina', 'listo', 'en_entrega', 'entregado', 'pagado', 'cancelado'];
```

- [ ] **Step 7: Run test and commit**

```bash
node --test tests/delivery.integration.test.mjs
git add src/context/POSContext.jsx tests/delivery.integration.test.mjs
git commit -m "Wire delivery orders into POS context"
```

---

### Task 4: Restaurant Delivery Settings UI

**Files:**
- Modify: `src/pages/SettingsPage.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Test: `tests/delivery.integration.test.mjs`, `tests/i18n.resources.test.mjs`

**Interfaces:**
- Saves delivery settings to `restaurant_profiles`.

- [ ] **Step 1: Add failing tests**

Extend `tests/delivery.integration.test.mjs` to assert `SettingsPage.jsx` contains:

```js
settings.delivery.title
delivery_service_mode
delivery_fee_mode
delivery_fixed_fee_mxn
delivery_fee_per_km_mxn
```

Assert i18n contains:

```js
delivery: {
  title, pickupOnly, deliveryOnly, pickupAndDelivery, free, fixed, perKm, manual
}
```

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add state, fetch, and save fields**

Add defaults:

```js
delivery_service_mode: 'pickup_only',
delivery_fee_mode: 'manual',
delivery_fixed_fee_mxn: 0,
delivery_base_fee_mxn: 0,
delivery_fee_per_km_mxn: 0,
delivery_max_distance_km: '',
delivery_min_order_mxn: '',
delivery_eta_min_minutes: '',
delivery_eta_max_minutes: '',
```

Add those fields to select, `setProfile`, and `profilePayload`.

- [ ] **Step 4: Add UI section**

Place after payment settings:

- Service mode: pickup only, delivery only, both.
- Fee mode: free, fixed, per km, manual.
- Conditional fields:
  - fixed: fixed fee.
  - per km: base fee, price per km, max radius.
  - manual: explanation.
- Optional minimum order.
- Optional ETA min/max.

- [ ] **Step 5: Add validations**

Block save when:

- `per_km` and restaurant has no coordinates.
- `per_km` and fee per km <= 0.
- fixed fee < 0.
- max radius < 0.
- minimum order < 0.

- [ ] **Step 6: Add i18n and run tests**

Run:

```bash
node --test tests/delivery.integration.test.mjs tests/i18n.resources.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsPage.jsx src/i18n/resources/es.js src/i18n/resources/en.js tests/delivery.integration.test.mjs tests/i18n.resources.test.mjs
git commit -m "Add restaurant delivery settings"
```

---

### Task 5: Customer Delivery Checkout

**Files:**
- Modify: `src/components/pos/TicketSidebar.jsx`
- Modify: `src/pages/ClientePage.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Test: `tests/delivery.integration.test.mjs`

**Interfaces:**
- Lets client choose pickup/delivery.
- Captures delivery address/reference/GPS.
- Shows calculated delivery fee preview.

- [ ] **Step 1: Add failing tests**

Assert `TicketSidebar.jsx` contains:

```js
fulfillmentType
deliveryAddress
deliveryLatitude
calculateDeliveryFee
navigator.geolocation
```

Assert `ClientePage.jsx` loads delivery settings.

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Load settings in public profile**

Add delivery fields to `ClientePage.jsx` restaurant profile select.

- [ ] **Step 4: Add checkout UI**

When client is in `/menu/:tenantId`, show:

- `Recoger en local`
- `Entrega a domicilio`

Only show options supported by restaurant settings.

When delivery is selected, require:

- name.
- phone.
- address.
- GPS/map coordinates for `per_km`.
- optional reference.

- [ ] **Step 5: Add fee preview**

Use:

```js
const distanceKm = calculateDistanceKm(
  { latitude: restaurantProfile?.latitude, longitude: restaurantProfile?.longitude },
  { latitude: deliveryLatitude, longitude: deliveryLongitude }
);
const deliveryQuote = calculateDeliveryFee(restaurantProfile, distanceKm);
```

Show:

- confirmed fee and final total.
- manual fee message.
- outside radius blocking message.

- [ ] **Step 6: Validate send**

Block send if:

- delivery address missing.
- per-km delivery lacks customer coordinates.
- outside radius.
- delivery only restaurant but fulfillment is pickup.
- pickup only restaurant but fulfillment is delivery.

- [ ] **Step 7: Run tests and commit**

```bash
node --test tests/delivery.integration.test.mjs
git add src/components/pos/TicketSidebar.jsx src/pages/ClientePage.jsx src/i18n/resources/es.js src/i18n/resources/en.js tests/delivery.integration.test.mjs
git commit -m "Add customer delivery checkout"
```

---

### Task 6: Restaurant Delivery Management

**Files:**
- Modify: `src/pages/PagosPage.jsx`
- Modify: `src/pages/CocinaPage.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Test: `tests/delivery.integration.test.mjs`

**Interfaces:**
- Shows delivery details to restaurant.
- Captures manual delivery fee.
- Adds delivery status actions.

- [ ] **Step 1: Add failing tests**

Assert `PagosPage.jsx` contains:

```js
deliveryAddress
deliveryFeeStatus
set_manual_delivery_fee
en_entrega
entregado
```

Assert `CocinaPage.jsx` contains delivery badge/details but not `set_manual_delivery_fee`.

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Update payable statuses**

```js
const ACTIVE_PAYMENT_STATUSES = new Set(['pendiente_cocina', 'listo', 'en_entrega', 'entregado']);
```

- [ ] **Step 4: Add delivery card details**

Show:

- `Entrega a domicilio` badge.
- address.
- reference.
- distance km.
- delivery fee.
- total final.
- pending manual fee warning.

- [ ] **Step 5: Manual fee capture**

If `deliveryFeeStatus === 'pending_manual'`, show numeric input and call:

```js
supabase.rpc('set_manual_delivery_fee', {
  p_order_id: order.id,
  p_delivery_fee_mxn: Number(manualFee),
});
```

- [ ] **Step 6: Delivery status buttons**

- `listo` -> button `Marcar en entrega` -> `en_entrega`.
- `en_entrega` -> button `Marcar entregado` -> `entregado`.
- Payment capture remains available for `pendiente_cocina`, `listo`, `en_entrega`, `entregado`.

- [ ] **Step 7: Kitchen badge**

In `CocinaPage.jsx`, display delivery badge and address/reference excerpt. Do not add driver controls.

- [ ] **Step 8: Run tests and commit**

```bash
node --test tests/delivery.integration.test.mjs
git add src/pages/PagosPage.jsx src/pages/CocinaPage.jsx src/i18n/resources/es.js src/i18n/resources/en.js tests/delivery.integration.test.mjs
git commit -m "Add delivery order management"
```

---

### Task 7: Customer Delivery Tracking

**Files:**
- Modify: `src/pages/OrderTrackingPage.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Test: `tests/delivery.integration.test.mjs`

**Interfaces:**
- Shows delivery state to customer from token tracking RPC.

- [ ] **Step 1: Add failing tests**

Assert `OrderTrackingPage.jsx` contains:

```js
en_entrega
entregado
orders.statuses.inDelivery
orders.delivery.driverOnTheWay
```

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Extend status config**

Add:

```js
en_entrega: {
  labelKey: 'orders.statuses.inDelivery',
  color: 'text-sky-400',
  bg: 'border-sky-500/30 bg-sky-500/10',
  icon: Truck,
  pulse: true,
},
entregado: {
  labelKey: 'orders.statuses.delivered',
  color: 'text-emerald-400',
  bg: 'border-emerald-500/30 bg-emerald-500/10',
  icon: CheckCircle2,
},
```

- [ ] **Step 4: Add status copy**

When `order.status === 'en_entrega'`, show:

```text
El repartidor ya esta en proceso de entrega.
```

Use i18n key `orders.delivery.driverOnTheWay`.

- [ ] **Step 5: Run tests and commit**

```bash
node --test tests/delivery.integration.test.mjs tests/i18n.resources.test.mjs
git add src/pages/OrderTrackingPage.jsx src/i18n/resources/es.js src/i18n/resources/en.js tests/delivery.integration.test.mjs tests/i18n.resources.test.mjs
git commit -m "Show delivery tracking states"
```

---

### Task 8: Pending Order Notifications

**Files:**
- Modify: `src/components/ui/PendingOrderNotifier.jsx`
- Modify: `src/i18n/resources/es.js`
- Modify: `src/i18n/resources/en.js`
- Test: `tests/delivery.integration.test.mjs`, `tests/pendingOrders.test.mjs`

**Interfaces:**
- Stronger alert for online/delivery pending orders.

- [ ] **Step 1: Add failing test**

Assert `PendingOrderNotifier.jsx` contains:

```js
fulfillment_type
delivery
AudioContext
```

- [ ] **Step 2: Run red test**

Run: `node --test tests/delivery.integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Select delivery fields**

Include in notifier query:

```text
fulfillment_type, delivery_address, delivery_fee_status
```

- [ ] **Step 4: Add browser-safe beep**

Use Web Audio after user interaction or inside notification attempt:

```js
const playOrderBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch {
    // Browser blocked audio; visual notification still works.
  }
};
```

- [ ] **Step 5: Run tests and commit**

```bash
node --test tests/delivery.integration.test.mjs tests/pendingOrders.test.mjs
git add src/components/ui/PendingOrderNotifier.jsx src/i18n/resources/es.js src/i18n/resources/en.js tests/delivery.integration.test.mjs tests/pendingOrders.test.mjs
git commit -m "Improve pending delivery notifications"
```

---

### Task 9: Full Verification And Deploy

**Files:**
- No planned feature file changes.

**Interfaces:**
- Verifies complete delivery flow.

- [ ] **Step 1: Run full tests**

```bash
node --test
```

Expected: all tests pass; the existing local dev-server smoke skip is allowed.

- [ ] **Step 2: Run lint**

```bash
npm.cmd run lint
```

Expected: exit 0.

- [ ] **Step 3: Run build**

```bash
npm.cmd run build
```

Expected: exit 0.

- [ ] **Step 4: Supabase advisors**

Use Supabase MCP `get_advisors` for security and performance on project `btqsgyjccanitrpvahzm`.

Expected: no new delivery-specific critical issue. Existing known warnings can remain documented if unrelated.

- [ ] **Step 5: Browser smoke**

Minimum production/preview flow:

1. `/settings`: enable `pickup_and_delivery`, `per_km`, base 20, per km 10, radius 10, save.
2. `/menu/:tenantId`: choose delivery, fill name/phone/address/GPS, verify fee preview.
3. Submit order and store tracking token.
4. `/pagos`: pending order shows delivery badge/address/fee; confirm order.
5. `/cocina`: delivery order appears with badge; mark ready.
6. `/pagos`: mark `en_entrega`, then `entregado`, then capture payment.
7. `/pedidos`: customer sees `El repartidor ya esta en proceso de entrega` while `en_entrega`.

- [ ] **Step 6: Push and Vercel verify**

```bash
git push origin main
```

Use Vercel MCP `list_deployments` for project `prj_JASRTqKgDmOAaFs4kMQr8gYTdQq8`, team `team_3kS0nwfPrnePf9HZl57LhJfK`.

Expected: latest deployment for commit is `READY`.

---

## Self-Review

- Coverage: restaurant delivery settings, fixed/free/manual/per-km fees, customer checkout, server-side fee calculation, order management, tracking, notifications, Supabase verification, and deployment are covered.
- Excluded intentionally: driver accounts, internal delivery roles, live courier GPS, route assignment, online card payment, coupons, inventory, reports, and dashboard.
- Security: public order creation never accepts client-provided delivery fee; Supabase recalculates it.
- Compatibility: existing restaurants default to pickup-only; existing orders default to pickup and `not_applicable` delivery fee.
- Testing: includes unit tests, migration tests, integration source tests, full test suite, lint, build, advisors, and browser smoke.
