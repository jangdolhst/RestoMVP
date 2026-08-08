import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resources } from '../src/i18n/resources/index.js';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('POS context selects and maps delivery order fields', () => {
  const source = readSource('src/context/POSContext.jsx');

  assert.match(source, /delivery_service_mode/);
  assert.match(source, /delivery_fee_mode/);
  assert.match(source, /delivery_address/);
  assert.match(source, /delivery_fee_mxn/);
  assert.match(source, /fulfillmentType/);
  assert.match(source, /p_fulfillment_type:\s*fulfillmentType/);
  assert.match(source, /p_delivery_address:\s*fulfillmentType === 'delivery' \? deliveryAddress : null/);
  assert.match(source, /p_delivery_latitude:\s*fulfillmentType === 'delivery' \? deliveryLatitude : null/);
  assert.match(source, /en_entrega/);
  assert.match(source, /entregado/);
  assert.doesNotMatch(source, /p_delivery_fee_mxn/);
});

test('restaurant settings expose delivery configuration controls', () => {
  const source = readSource('src/pages/SettingsPage.jsx');

  assert.match(source, /settings\.delivery\.title/);
  assert.match(source, /delivery_service_mode/);
  assert.match(source, /delivery_fee_mode/);
  assert.match(source, /delivery_fixed_fee_mxn/);
  assert.match(source, /delivery_fee_per_km_mxn/);
});

test('delivery i18n resources are available in Spanish and English', () => {
  for (const language of ['es', 'en']) {
    const delivery = resources[language].translation.settings.delivery;
    for (const key of ['title', 'pickupOnly', 'deliveryOnly', 'pickupAndDelivery', 'free', 'fixed', 'perKm', 'manual']) {
      assert.equal(typeof delivery[key], 'string', `${language}.settings.delivery.${key} missing`);
    }
  }
});

test('customer checkout exposes delivery fulfillment and location capture', () => {
  const ticketSource = readSource('src/components/pos/TicketSidebar.jsx');
  const clientSource = readSource('src/pages/ClientePage.jsx');

  assert.match(ticketSource, /fulfillmentType/);
  assert.match(ticketSource, /deliveryAddress/);
  assert.match(ticketSource, /deliveryLatitude/);
  assert.match(ticketSource, /calculateDeliveryFee/);
  assert.match(ticketSource, /navigator\.geolocation/);
  assert.match(clientSource, /delivery_service_mode/);
  assert.match(clientSource, /delivery_fee_mode/);
});

test('restaurant order management exposes delivery details and status actions', () => {
  const paymentsSource = readSource('src/pages/PagosPage.jsx');
  const kitchenSource = readSource('src/pages/CocinaPage.jsx');

  assert.match(paymentsSource, /deliveryAddress/);
  assert.match(paymentsSource, /deliveryFeeStatus/);
  assert.match(paymentsSource, /set_manual_delivery_fee/);
  assert.match(paymentsSource, /en_entrega/);
  assert.match(paymentsSource, /entregado/);
  assert.match(kitchenSource, /deliveryAddress/);
  assert.match(kitchenSource, /delivery/);
  assert.doesNotMatch(kitchenSource, /set_manual_delivery_fee/);
});

test('customer order tracking exposes delivery statuses', () => {
  const source = readSource('src/pages/OrderTrackingPage.jsx');

  assert.match(source, /en_entrega/);
  assert.match(source, /entregado/);
  assert.match(source, /orders\.statuses\.inDelivery/);
  assert.match(source, /orders\.delivery\.driverOnTheWay/);
});
