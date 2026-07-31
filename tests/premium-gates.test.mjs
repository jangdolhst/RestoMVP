import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const pagosPage = readSource('../src/pages/PagosPage.jsx');
const financePage = readSource('../src/pages/FinancePage.jsx');
const settingsPage = readSource('../src/pages/SettingsPage.jsx');

test('active order receiving and payment capture remain outside the Pro gate', () => {
  const featureGateIndex = pagosPage.indexOf('<FeatureGate');
  const activeOrdersIndex = pagosPage.indexOf('activeChargeOrders.length === 0');
  const paymentModalIndex = pagosPage.indexOf('<PaymentCaptureModal');

  assert.notEqual(featureGateIndex, -1);
  assert.notEqual(activeOrdersIndex, -1);
  assert.notEqual(paymentModalIndex, -1);
  assert.ok(activeOrdersIndex < featureGateIndex);
  assert.ok(paymentModalIndex > featureGateIndex);
  assert.match(pagosPage, /feature=\{PREMIUM_FEATURES\.paymentHistory\}/);
});

test('finance cash closure page remains a premium-only feature', () => {
  assert.match(financePage, /<FeatureGate[\s\S]*feature=\{PREMIUM_FEATURES\.cashClosure\}/);
  assert.match(financePage, /supabase\.rpc\('get_finance_day_summary'/);
  assert.match(financePage, /supabase\.rpc\(rpcName/);
});

test('fiscal data settings remain premium while basic settings stay available', () => {
  assert.match(settingsPage, /feature=\{PREMIUM_FEATURES\.fiscalData\}/);
  assert.match(settingsPage, /canUseFiscalData = hasFeature\(subscriptionData, PREMIUM_FEATURES\.fiscalData\)/);
  assert.match(settingsPage, /setProfile/);
});
