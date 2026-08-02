import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
