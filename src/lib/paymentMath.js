export const PAYMENT_FIELDS = {
  cashMxnReceived: 'cashMxnReceived',
  cashUsdReceived: 'cashUsdReceived',
  cardMxnAmount: 'cardMxnAmount',
  transferMxnAmount: 'transferMxnAmount',
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

const hasNegativePayment = (input) => (
  toNumber(input.cashMxnReceived) < 0
  || toNumber(input.cashUsdReceived) < 0
  || toNumber(input.cardMxnAmount) < 0
  || toNumber(input.transferMxnAmount) < 0
);

export const normalizePaymentInput = (input = {}) => ({
  cashMxnReceived: roundMoney(input.cashMxnReceived),
  cashUsdReceived: roundMoney(input.cashUsdReceived),
  cardMxnAmount: roundMoney(input.cardMxnAmount),
  transferMxnAmount: roundMoney(input.transferMxnAmount),
});

export const calculatePaymentBreakdown = (input = {}) => {
  const orderTotal = roundMoney(input.orderTotal);
  const exchangeRate = roundMoney(input.exchangeRate);
  const acceptsUsd = Boolean(input.acceptsUsd);
  const normalized = normalizePaymentInput(input);

  if (orderTotal <= 0) {
    return { isValid: false, error: 'invalid_total' };
  }

  if (hasNegativePayment(input)) {
    return { isValid: false, error: 'negative_payment' };
  }

  if (normalized.cashUsdReceived > 0 && !acceptsUsd) {
    return { isValid: false, error: 'usd_disabled' };
  }

  if (normalized.cashUsdReceived > 0 && exchangeRate <= 0) {
    return { isValid: false, error: 'invalid_exchange_rate' };
  }

  const cashUsdEquivalentMxn = roundMoney(normalized.cashUsdReceived * exchangeRate);
  const totalReceivedMxn = roundMoney(
    normalized.cashMxnReceived
    + cashUsdEquivalentMxn
    + normalized.cardMxnAmount
    + normalized.transferMxnAmount
  );
  const changeMxn = Math.max(0, roundMoney(totalReceivedMxn - orderTotal));
  const remainingMxn = Math.max(0, roundMoney(orderTotal - totalReceivedMxn));
  const effectivePaidMxn = roundMoney(totalReceivedMxn - changeMxn);
  const usedSources = [
    normalized.cashMxnReceived > 0 || normalized.cashUsdReceived > 0 ? 'cash' : null,
    normalized.cardMxnAmount > 0 ? 'card' : null,
    normalized.transferMxnAmount > 0 ? 'transfer' : null,
  ].filter(Boolean);

  return {
    ...normalized,
    exchangeRate,
    orderTotal,
    acceptsUsd,
    cashUsdEquivalentMxn,
    totalReceivedMxn,
    changeMxn,
    remainingMxn,
    effectivePaidMxn,
    paymentLabel: usedSources.length === 1 ? usedSources[0] : 'mixed',
    isValid: effectivePaidMxn === orderTotal && usedSources.length > 0,
    error: effectivePaidMxn === orderTotal && usedSources.length > 0 ? null : 'incomplete_payment',
  };
};

export const calculateCashClosure = (input = {}) => {
  const openingCashMxn = roundMoney(input.openingCashMxn);
  const openingCashUsd = roundMoney(input.openingCashUsd);
  const cashMxnReceived = roundMoney(input.cashMxnReceived);
  const cashUsdReceived = roundMoney(input.cashUsdReceived);
  const changeMxn = roundMoney(input.changeMxn);
  const cashExpensesMxn = roundMoney(input.cashExpensesMxn);
  const countedCashMxn = input.countedCashMxn == null || input.countedCashMxn === '' ? null : roundMoney(input.countedCashMxn);
  const countedCashUsd = input.countedCashUsd == null || input.countedCashUsd === '' ? null : roundMoney(input.countedCashUsd);
  const expectedCashMxn = roundMoney(openingCashMxn + cashMxnReceived - changeMxn - cashExpensesMxn);
  const expectedCashUsd = roundMoney(openingCashUsd + cashUsdReceived);

  return {
    openingCashMxn,
    openingCashUsd,
    cashMxnReceived,
    cashUsdReceived,
    changeMxn,
    cashExpensesMxn,
    countedCashMxn,
    countedCashUsd,
    expectedCashMxn,
    expectedCashUsd,
    differenceMxn: countedCashMxn == null ? null : roundMoney(countedCashMxn - expectedCashMxn),
    differenceUsd: countedCashUsd == null ? null : roundMoney(countedCashUsd - expectedCashUsd),
  };
};
