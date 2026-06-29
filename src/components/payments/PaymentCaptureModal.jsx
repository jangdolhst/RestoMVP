import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Loader2, X } from 'lucide-react';
import { calculatePaymentBreakdown, normalizePaymentInput } from '../../lib/paymentMath';

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const PaymentField = ({ id, label, value, onChange, disabled = false }) => (
  <label htmlFor={id} className="block">
    <span className="text-xs font-semibold text-slate-400 mb-1 block">{label}</span>
    <input
      id={id}
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="glass-input w-full disabled:opacity-50 disabled:cursor-not-allowed"
      placeholder="0.00"
    />
  </label>
);

const PaymentCaptureModal = ({ order, restaurantProfile, onClose, onConfirm, isSubmitting = false }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    cashMxnReceived: '',
    cashUsdReceived: '',
    cardMxnAmount: '',
    transferMxnAmount: '',
  });

  const acceptsUsd = Boolean(restaurantProfile?.accepts_usd);
  const exchangeRate = Number(restaurantProfile?.usd_exchange_rate || 0);
  const orderTotal = Number(order?.total || 0);

  const breakdown = useMemo(() => calculatePaymentBreakdown({
    orderTotal,
    acceptsUsd,
    exchangeRate,
    ...form,
  }), [acceptsUsd, exchangeRate, form, orderTotal]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!breakdown.isValid || isSubmitting) return;
    await onConfirm(normalizePaymentInput(form));
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-lg p-5 sm:p-6 border-t-2 border-t-emerald-500 animate-scale-up">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 mb-1">
              {t('payments.paymentModal.title')}
            </p>
            <h2 className="text-2xl font-bold text-white">#{order.orderNumber}</h2>
            <p className="text-sm text-slate-400 mt-1">{t('payments.paymentModal.description')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            disabled={isSubmitting}
            aria-label={t('common.actions.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-5 flex items-center justify-between">
          <span className="text-sm text-emerald-200">{t('payments.paymentModal.orderTotal')}</span>
          <span className="text-2xl font-black text-emerald-300">{formatCurrency(orderTotal)} MXN</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <PaymentField
            id="payment-cash-mxn"
            label={t('payments.paymentModal.cashMxn')}
            value={form.cashMxnReceived}
            onChange={(value) => updateField('cashMxnReceived', value)}
          />
          <PaymentField
            id="payment-cash-usd"
            label={t('payments.paymentModal.cashUsd')}
            value={form.cashUsdReceived}
            onChange={(value) => updateField('cashUsdReceived', value)}
            disabled={!acceptsUsd}
          />
          <PaymentField
            id="payment-card-mxn"
            label={t('payments.paymentModal.cardMxn')}
            value={form.cardMxnAmount}
            onChange={(value) => updateField('cardMxnAmount', value)}
          />
          <PaymentField
            id="payment-transfer-mxn"
            label={t('payments.paymentModal.transferMxn')}
            value={form.transferMxnAmount}
            onChange={(value) => updateField('transferMxnAmount', value)}
          />
        </div>

        <div className="space-y-2 rounded-2xl bg-black/25 border border-white/10 p-4 mb-5">
          {acceptsUsd ? (
            <div className="flex justify-between text-xs text-slate-400">
              <span>{t('payments.paymentModal.exchangeRate', { rate: exchangeRate.toFixed(2) })}</span>
              <span>{formatCurrency(breakdown.cashUsdEquivalentMxn)} MXN</span>
            </div>
          ) : (
            <p className="text-xs text-amber-300">{t('payments.paymentModal.usdDisabled')}</p>
          )}
          <div className="flex justify-between text-sm text-slate-300">
            <span>{t('payments.paymentModal.received')}</span>
            <strong className="text-white">{formatCurrency(breakdown.totalReceivedMxn)} MXN</strong>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>{t('payments.paymentModal.remaining')}</span>
            <strong className={breakdown.remainingMxn > 0 ? 'text-amber-300' : 'text-emerald-300'}>
              {formatCurrency(breakdown.remainingMxn)} MXN
            </strong>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>{t('payments.paymentModal.change')}</span>
            <strong className="text-orange-300">{formatCurrency(breakdown.changeMxn)} MXN</strong>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>{t('payments.paymentModal.effectivePaid')}</span>
            <strong className="text-emerald-300">{formatCurrency(breakdown.effectivePaidMxn)} MXN</strong>
          </div>
        </div>

        {!breakdown.isValid && (
          <p className="text-xs text-amber-300 mb-4">
            {breakdown.error === 'incomplete_payment'
              ? t('payments.paymentModal.incomplete')
              : t('payments.paymentModal.invalid')}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-colors"
            disabled={isSubmitting}
          >
            {t('common.actions.cancel')}
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold transition-colors flex items-center justify-center gap-2"
            disabled={!breakdown.isValid || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <DollarSign size={18} />}
            {t('payments.paymentModal.confirmPayment')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentCaptureModal;
