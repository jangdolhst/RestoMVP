import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, CalendarDays, CheckCircle, DollarSign, Loader2, RefreshCw, WalletCards } from 'lucide-react';
import FeatureGate from '../components/billing/FeatureGate';
import { PREMIUM_FEATURES } from '../lib/features';
import { supabase } from '../lib/supabase';
import { DEFAULT_BUSINESS_TIMEZONE, normalizeBusinessTimeZone } from '../lib/businessTimezone';
import { calculateCashClosure, roundMoney } from '../lib/paymentMath';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';

const todayLocalDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_BUSINESS_TIMEZONE;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
const formatUsd = (value) => `$${Number(value || 0).toFixed(2)} USD`;

const StatCard = ({ icon: Icon, label, value, tone = 'slate' }) => {
  const tones = {
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    sky: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    slate: 'border-white/10 bg-white/5 text-white',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] opacity-80 mb-2">
        <Icon size={15} />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
};

const NumberField = ({ id, label, value, onChange, disabled = false }) => (
  <label htmlFor={id} className="block">
    <span className="text-xs text-slate-400 font-semibold mb-1 block">{label}</span>
    <input
      id={id}
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="glass-input w-full disabled:opacity-60 disabled:cursor-not-allowed"
      placeholder="0.00"
    />
  </label>
);

const FinancePage = () => {
  const { user } = useAuth();
  const { restaurantProfile } = usePOS();
  const { t } = useTranslation();
  const [businessDate, setBusinessDate] = useState(todayLocalDate);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [closureForm, setClosureForm] = useState({
    openingCashMxn: '',
    openingCashUsd: '',
    countedCashMxn: '',
    countedCashUsd: '',
    cashExpensesMxn: '',
    notes: '',
  });

  const businessTimezone = useMemo(
    () => normalizeBusinessTimeZone(restaurantProfile?.business_timezone, getBrowserTimeZone()),
    [restaurantProfile?.business_timezone]
  );

  const loadFinance = useCallback(async () => {
    if (!user?.id) return;
    if (!businessDate) {
      setBusinessDate(todayLocalDate());
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const [{ data: summaryData, error: summaryError }, { data: historyData, error: historyError }] = await Promise.all([
        supabase.rpc('get_finance_day_summary', {
          p_business_date: businessDate,
          p_timezone: businessTimezone,
        }),
        supabase
          .from('cash_closures')
          .select('id, business_date, status, snapshot_total_sales_mxn, expected_cash_mxn, expected_cash_usd, difference_mxn, difference_usd, closed_at')
          .eq('tenant_id', user.id)
          .order('business_date', { ascending: false })
          .limit(14),
      ]);

      if (summaryError) throw summaryError;
      if (historyError) throw historyError;

      const nextSummary = summaryData?.[0] || null;
      setSummary(nextSummary);
      setHistory(historyData || []);

      if (nextSummary) {
        setClosureForm({
          openingCashMxn: nextSummary.opening_cash_mxn ? String(nextSummary.opening_cash_mxn) : '',
          openingCashUsd: nextSummary.opening_cash_usd ? String(nextSummary.opening_cash_usd) : '',
          countedCashMxn: nextSummary.counted_cash_mxn != null ? String(nextSummary.counted_cash_mxn) : '',
          countedCashUsd: nextSummary.counted_cash_usd != null ? String(nextSummary.counted_cash_usd) : '',
          cashExpensesMxn: nextSummary.cash_expenses_mxn ? String(nextSummary.cash_expenses_mxn) : '',
          notes: nextSummary.closure_notes || '',
        });
      }
    } catch (error) {
      console.error('Error cargando finanzas:', error.message);
      setErrorMessage(t('finance.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [businessDate, businessTimezone, t, user?.id]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const projectedClosure = useMemo(() => calculateCashClosure({
    openingCashMxn: closureForm.openingCashMxn,
    openingCashUsd: closureForm.openingCashUsd,
    countedCashMxn: closureForm.countedCashMxn,
    countedCashUsd: closureForm.countedCashUsd,
    cashExpensesMxn: closureForm.cashExpensesMxn,
    cashMxnReceived: summary?.cash_mxn_received || 0,
    cashUsdReceived: summary?.cash_usd_received || 0,
    changeMxn: summary?.change_mxn || 0,
  }), [closureForm, summary]);

  const updateClosureField = (field, value) => {
    setClosureForm((current) => ({ ...current, [field]: value }));
    setStatusMessage('');
    setErrorMessage('');
  };

  const saveClosure = async (shouldClose = false) => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');

    const rpcName = shouldClose ? 'close_cash_closure' : 'save_cash_closure_draft';

    try {
      const { error } = await supabase.rpc(rpcName, {
        p_business_date: businessDate,
        p_opening_cash_mxn: roundMoney(closureForm.openingCashMxn),
        p_opening_cash_usd: roundMoney(closureForm.openingCashUsd),
        p_counted_cash_mxn: closureForm.countedCashMxn === '' ? null : roundMoney(closureForm.countedCashMxn),
        p_counted_cash_usd: closureForm.countedCashUsd === '' ? null : roundMoney(closureForm.countedCashUsd),
        p_cash_expenses_mxn: roundMoney(closureForm.cashExpensesMxn),
        p_notes: closureForm.notes,
        p_timezone: businessTimezone,
      });

      if (error) throw error;
      setStatusMessage(shouldClose ? t('finance.closeSuccess') : t('finance.saveSuccess'));
      await loadFinance();
    } catch (error) {
      console.error('Error guardando corte:', error.message);
      setErrorMessage(t('finance.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const isClosed = summary?.closure_status === 'closed';

  return (
    <FeatureGate
      feature={PREMIUM_FEATURES.cashClosure}
      title={t('premium.features.cashClosure.title')}
      description={t('premium.features.cashClosure.description')}
    >
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto h-[calc(100vh-100px)]">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Calculator className="text-emerald-400" size={30} />
                {t('finance.title')}
              </h1>
              <p className="text-sm text-slate-400 mt-1">{t('finance.subtitle')}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <label htmlFor="finance-date" className="glass-panel px-3 py-2 flex items-center gap-2">
                <CalendarDays size={18} className="text-slate-400" />
                <span className="sr-only">{t('finance.selectedDate')}</span>
                <input
                  id="finance-date"
                  type="date"
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value || todayLocalDate())}
                  className="bg-transparent text-white text-sm outline-none"
                />
              </label>
              <button
                onClick={loadFinance}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-semibold transition-colors flex items-center gap-2"
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                {t('finance.refresh')}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
              {errorMessage}
            </div>
          )}
          {statusMessage && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
              {statusMessage}
            </div>
          )}

          {isLoading ? (
            <div className="glass-panel p-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-xl font-bold text-white mb-4">{t('finance.todaySummary')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard icon={DollarSign} label={t('finance.totalSales')} value={formatCurrency(summary?.total_sales_mxn)} tone="emerald" />
                  <StatCard icon={CheckCircle} label={t('finance.paidOrders')} value={summary?.paid_order_count || 0} tone="sky" />
                  <StatCard icon={WalletCards} label={t('finance.averageTicket')} value={formatCurrency(summary?.average_ticket_mxn)} />
                  <StatCard icon={CalendarDays} label={t('finance.cancelledOrders')} value={summary?.cancelled_order_count || 0} tone="amber" />
                </div>
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="glass-panel p-5">
                  <h2 className="text-lg font-bold text-white mb-4">{t('finance.paymentBreakdown')}</h2>
                  <div className="space-y-3 text-sm">
                    {[
                      [t('finance.cashMxn'), `${formatCurrency(summary?.cash_mxn_received)} MXN`],
                      [t('finance.cashUsd'), formatUsd(summary?.cash_usd_received)],
                      [t('finance.usdEquivalent'), `${formatCurrency(summary?.cash_usd_equivalent_mxn)} MXN`],
                      [t('finance.cardMxn'), `${formatCurrency(summary?.card_mxn_amount)} MXN`],
                      [t('finance.transferMxn'), `${formatCurrency(summary?.transfer_mxn_amount)} MXN`],
                      [t('finance.changeMxn'), `${formatCurrency(summary?.change_mxn)} MXN`],
                      [t('finance.expectedCashSales'), `${formatCurrency(summary?.expected_cash_mxn_from_sales)} MXN`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                        <span className="text-slate-400">{label}</span>
                        <strong className="text-white">{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-bold text-white">{t('finance.closeCash')}</h2>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${isClosed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {isClosed ? t('finance.closed') : t('finance.draft')}
                    </span>
                  </div>

                  {isClosed && (
                    <p className="text-xs text-emerald-300 mb-4">{t('finance.readOnlyClosed')}</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <NumberField id="opening-mxn" label={t('finance.openingCashMxn')} value={closureForm.openingCashMxn} onChange={(value) => updateClosureField('openingCashMxn', value)} disabled={isClosed} />
                    <NumberField id="opening-usd" label={t('finance.openingCashUsd')} value={closureForm.openingCashUsd} onChange={(value) => updateClosureField('openingCashUsd', value)} disabled={isClosed} />
                    <NumberField id="counted-mxn" label={t('finance.countedCashMxn')} value={closureForm.countedCashMxn} onChange={(value) => updateClosureField('countedCashMxn', value)} disabled={isClosed} />
                    <NumberField id="counted-usd" label={t('finance.countedCashUsd')} value={closureForm.countedCashUsd} onChange={(value) => updateClosureField('countedCashUsd', value)} disabled={isClosed} />
                    <NumberField id="expenses-mxn" label={t('finance.expensesMxn')} value={closureForm.cashExpensesMxn} onChange={(value) => updateClosureField('cashExpensesMxn', value)} disabled={isClosed} />
                  </div>

                  <label htmlFor="closure-notes" className="block mb-4">
                    <span className="text-xs text-slate-400 font-semibold mb-1 block">{t('finance.notes')}</span>
                    <textarea
                      id="closure-notes"
                      value={closureForm.notes}
                      disabled={isClosed}
                      onChange={(event) => updateClosureField('notes', event.target.value)}
                      className="glass-input w-full min-h-24 disabled:opacity-60 disabled:cursor-not-allowed"
                      maxLength={1000}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                    <StatCard icon={DollarSign} label={t('finance.expectedCashMxn')} value={`${formatCurrency(projectedClosure.expectedCashMxn)} MXN`} />
                    <StatCard icon={DollarSign} label={t('finance.expectedCashUsd')} value={formatUsd(projectedClosure.expectedCashUsd)} />
                    <StatCard icon={Calculator} label={t('finance.differenceMxn')} value={projectedClosure.differenceMxn == null ? '-' : `${formatCurrency(projectedClosure.differenceMxn)} MXN`} tone={Number(projectedClosure.differenceMxn || 0) === 0 ? 'emerald' : 'amber'} />
                    <StatCard icon={Calculator} label={t('finance.differenceUsd')} value={projectedClosure.differenceUsd == null ? '-' : formatUsd(projectedClosure.differenceUsd)} tone={Number(projectedClosure.differenceUsd || 0) === 0 ? 'emerald' : 'amber'} />
                  </div>

                  {!isClosed && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => saveClosure(false)}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors disabled:opacity-60"
                      >
                        {t('finance.saveDraft')}
                      </button>
                      <button
                        onClick={() => saveClosure(true)}
                        disabled={isSaving || closureForm.countedCashMxn === '' || closureForm.countedCashUsd === ''}
                        className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold transition-colors disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {t('finance.closeClosure')}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="glass-panel p-5">
                <h2 className="text-lg font-bold text-white mb-4">{t('finance.history')}</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('finance.emptyHistory')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-white/10">
                          <th className="py-2 pr-4">{t('finance.selectedDate')}</th>
                          <th className="py-2 pr-4">{t('finance.totalSales')}</th>
                          <th className="py-2 pr-4">{t('finance.expectedCashMxn')}</th>
                          <th className="py-2 pr-4">{t('finance.differenceMxn')}</th>
                          <th className="py-2 pr-4">{t('finance.closed')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((closure) => (
                          <tr key={closure.id} className="border-b border-white/5 text-slate-300">
                            <td className="py-3 pr-4">{closure.business_date}</td>
                            <td className="py-3 pr-4">{formatCurrency(closure.snapshot_total_sales_mxn)}</td>
                            <td className="py-3 pr-4">{formatCurrency(closure.expected_cash_mxn)}</td>
                            <td className="py-3 pr-4">{closure.difference_mxn == null ? '-' : formatCurrency(closure.difference_mxn)}</td>
                            <td className="py-3 pr-4">{closure.status === 'closed' ? t('finance.closed') : t('finance.draft')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </FeatureGate>
  );
};

export default FinancePage;
