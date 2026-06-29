import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCashClosure,
  calculatePaymentBreakdown,
  normalizePaymentInput,
  roundMoney,
} from '../src/lib/paymentMath.js';

test('roundMoney keeps two decimals with numeric strings', () => {
  assert.equal(roundMoney('10.239'), 10.24);
  assert.equal(roundMoney('bad'), 0);
});

test('calculatePaymentBreakdown accepts exact MXN cash', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 350,
    cashMxnReceived: 350,
    acceptsUsd: false,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.totalReceivedMxn, 350);
  assert.equal(result.changeMxn, 0);
  assert.equal(result.remainingMxn, 0);
  assert.equal(result.effectivePaidMxn, 350);
  assert.equal(result.paymentLabel, 'cash');
});

test('calculatePaymentBreakdown calculates remaining after USD cash', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 350,
    cashUsdReceived: 10,
    cashMxnReceived: 165,
    exchangeRate: 18.5,
    acceptsUsd: true,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.cashUsdEquivalentMxn, 185);
  assert.equal(result.totalReceivedMxn, 350);
  assert.equal(result.remainingMxn, 0);
  assert.equal(result.changeMxn, 0);
});

test('calculatePaymentBreakdown calculates MXN change for USD overpayment', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 350,
    cashUsdReceived: 20,
    exchangeRate: 18.5,
    acceptsUsd: true,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.totalReceivedMxn, 370);
  assert.equal(result.changeMxn, 20);
  assert.equal(result.effectivePaidMxn, 350);
});

test('calculatePaymentBreakdown supports mixed cash card and transfer', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 500,
    cashMxnReceived: 100,
    cardMxnAmount: 250,
    transferMxnAmount: 150,
    acceptsUsd: false,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.totalReceivedMxn, 500);
  assert.equal(result.paymentLabel, 'mixed');
});

test('calculatePaymentBreakdown rejects USD when disabled', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 100,
    cashUsdReceived: 5,
    exchangeRate: 18,
    acceptsUsd: false,
  });

  assert.equal(result.isValid, false);
  assert.equal(result.error, 'usd_disabled');
});

test('calculatePaymentBreakdown rejects negative payment values', () => {
  const result = calculatePaymentBreakdown({
    orderTotal: 100,
    cashMxnReceived: -1,
  });

  assert.equal(result.isValid, false);
  assert.equal(result.error, 'negative_payment');
});

test('normalizePaymentInput returns rounded numeric payload', () => {
  const result = normalizePaymentInput({
    cashMxnReceived: '10.239',
    cashUsdReceived: '1.234',
    cardMxnAmount: '',
    transferMxnAmount: '5',
  });

  assert.deepEqual(result, {
    cashMxnReceived: 10.24,
    cashUsdReceived: 1.23,
    cardMxnAmount: 0,
    transferMxnAmount: 5,
  });
});

test('calculateCashClosure computes expected cash and differences', () => {
  const result = calculateCashClosure({
    openingCashMxn: 1000,
    openingCashUsd: 20,
    cashMxnReceived: 800,
    cashUsdReceived: 15,
    changeMxn: 50,
    cashExpensesMxn: 120,
    countedCashMxn: 1630,
    countedCashUsd: 35,
  });

  assert.equal(result.expectedCashMxn, 1630);
  assert.equal(result.expectedCashUsd, 35);
  assert.equal(result.differenceMxn, 0);
  assert.equal(result.differenceUsd, 0);
});

test('calculateCashClosure allows negative differences', () => {
  const result = calculateCashClosure({
    openingCashMxn: 100,
    cashMxnReceived: 200,
    countedCashMxn: 250,
  });

  assert.equal(result.expectedCashMxn, 300);
  assert.equal(result.differenceMxn, -50);
});
