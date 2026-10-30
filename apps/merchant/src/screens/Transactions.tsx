import { apiData, manilaDate, type CampaignView, type MerchantSaleRow } from '@gcash/shared';
import { EmptyState, ErrorState, formatManilaDateTime, formatPeso, formatPoints, Skeleton, Tabs, useAsync } from '@gcash/ui';
import { ChevronDown, ReceiptText, Search, Zap } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Shell } from '../app/Shell';
import { useManager } from '../app/session';
import { inputClass, PageHeader } from '../app/ui';
import { shiftDate } from './CampaignForm';

type Preset = 'today' | '7' | '30' | 'custom';
type Who = 'ALL' | 'MEMBER' | 'GUEST';
const PAGE = 50;

/**
 * Merchant portal: Transactions (replaces the M-5 daily log with a date-range sales ledger). Everyday UI.
 * Feeling: "every bill, voucher and point at my store is accounted for."
 */
export default function Transactions() {
  const { manager } = useManager();
  const merchantId = manager?.merchantId ?? '';
  const today = manilaDate(new Date().toISOString());
  const [preset, setPreset] = useState<Preset>('today');
  const [range, setRange] = useState({ from: today, to: today });
  const [who, setWho] = useState<Who>('ALL');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string>();
  const [limit, setLimit] = useState(PAGE);

  const q = useAsync(
    () => apiData<MerchantSaleRow[]>(`/merchant/transactions?merchantId=${encodeURIComponent(merchantId)}&from=${range.from}&to=${range.to}`),
    [merchantId, range.from, range.to],
  );
  // Campaign names for the "campaigns applied" column
  const campaigns = useAsync(() => apiData<CampaignView[]>(`/merchant/campaigns?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const campaignName = (id: string) => campaigns.data?.find((c) => c.campaignId === id)?.name ?? id;

  function choose(p: Preset) {
    setPreset(p);
    setLimit(PAGE);
    if (p === 'today') setRange({ from: today, to: today });
    if (p === '7') setRange({ from: shiftDate(today, -6), to: today });
    if (p === '30') setRange({ from: shiftDate(today, -29), to: today });
  }

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        (who === 'ALL' || (who === 'MEMBER' ? !!r.userId : !r.userId)) &&
        (!s || r.billId.toLowerCase().includes(s) || (r.customerName ?? '').toLowerCase().includes(s) || (r.userId ?? '').toLowerCase().includes(s) || r.cashier.toLowerCase().includes(s)),
    );
  }, [q.data, who, search]);

  const totals = rows.reduce((t, r) => ({ net: t.net + r.net, discount: t.discount + r.discount, points: t.points + r.basePoints + r.bonusPoints }), { net: 0, discount: 0, points: 0 });

  return (
    <Shell>
      <PageHeader title="Transactions" sub="Every bill rung up at your POS, with vouchers used and points earned." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs
          tabs={[
            { id: 'today' as const, label: 'Today' },
            { id: '7' as const, label: '7 days' },
            { id: '30' as const, label: '30 days' },
            { id: 'custom' as const, label: 'Custom' },
          ]}
          value={preset}
          onChange={choose}
          label="Date range"
        />
        {preset === 'custom' && (
          <div className="flex items-end gap-2">
            <label className="text-xs font-bold text-text-2">
              From
              <input type="date" max={range.to} value={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={`${inputClass()} mt-1`} />
            </label>
            <label className="text-xs font-bold text-text-2">
              To
              <input type="date" min={range.from} max={today} value={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={`${inputClass()} mt-1`} />
            </label>
          </div>
        )}
        <Tabs
          tabs={[
            { id: 'ALL' as const, label: 'All bills' },
            { id: 'MEMBER' as const, label: 'Members' },
            { id: 'GUEST' as const, label: 'Non-members' },
          ]}
          value={who}
          onChange={setWho}
          label="Customer"
        />
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Search bills</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-2" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bill ID, member or cashier" className={`${inputClass()} pl-9`} />
        </label>
      </div>

      {q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={() => void q.reload()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-hero" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={q.data.length ? 'No bills match' : preset === 'today' ? 'No bills yet today' : 'No bills in this range'}
          body={q.data.length ? 'Try a different search or customer filter.' : 'Bills appear here as soon as the cashier completes a purchase at the POS.'}
        />
      ) : (
        <section className={`overflow-hidden rounded-hero bg-surface-1 shadow-e1 ring-1 ring-line transition-opacity ${q.loading ? 'opacity-60' : ''}`}>
          <dl className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-text-2">Bills</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{formatPoints(rows.length)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-2">Revenue (paid)</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{formatPeso(totals.net)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-2">Voucher discounts</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{formatPeso(totals.discount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-2">Points issued</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{formatPoints(totals.points)}</dd>
            </div>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface-2 text-xs text-text-2">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Time</th>
                  <th className="px-4 py-2.5 font-bold">Bill</th>
                  <th className="px-4 py-2.5 font-bold">Customer</th>
                  <th className="px-4 py-2.5 text-right font-bold">Subtotal</th>
                  <th className="px-4 py-2.5 text-right font-bold">Vouchers</th>
                  <th className="px-4 py-2.5 text-right font-bold">Paid</th>
                  <th className="px-4 py-2.5 text-right font-bold">Points</th>
                  <th className="w-10 px-2 py-2.5">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((r) => {
                  const expanded = open === r.billId;
                  return (
                    <Fragment key={r.billId}>
                      <tr className="border-t border-line hover:bg-surface-2/60">
                        <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatManilaDateTime(r.timestamp)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{r.billId}</td>
                        <td className="px-4 py-2.5">
                          {r.userId ? (
                            <>
                              <span className="font-semibold">{r.customerName}</span>
                              <span className="block font-mono text-xs text-text-2">{r.userId}</span>
                            </>
                          ) : (
                            <span className="text-text-2">Non-member</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatPeso(r.subtotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.discount ? `−${formatPeso(r.discount)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatPeso(r.net)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {r.userId ? (
                            <>
                              {formatPoints(r.basePoints + r.bonusPoints)}
                              {r.bonusPoints > 0 && (
                                <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-promo-100 px-1.5 text-xs font-bold text-promo-700">
                                  <Zap className="size-3" aria-hidden />+{formatPoints(r.bonusPoints)}
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            onClick={() => setOpen(expanded ? undefined : r.billId)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Hide' : 'Show'} items on ${r.billId}`}
                            className="grid size-11 place-items-center rounded-full text-text-2 hover:bg-surface-2"
                          >
                            <ChevronDown className={`size-4 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-surface-2/60">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                              <ul className="space-y-1 text-sm">
                                {r.lines.map((l) => (
                                  <li key={l.sku} className="flex justify-between gap-3">
                                    <span>
                                      {l.qty}× {l.name} <span className="font-mono text-xs text-text-2">{l.sku}</span>
                                    </span>
                                    <span className="tabular-nums">{formatPeso(l.unitPrice * l.qty)}</span>
                                  </li>
                                ))}
                              </ul>
                              <dl className="space-y-1 text-xs text-text-2">
                                <div className="flex justify-between gap-2">
                                  <dt>Cashier</dt>
                                  <dd className="font-semibold text-text-1">{r.cashier}</dd>
                                </div>
                                {r.voucherIds.length > 0 && (
                                  <div className="flex justify-between gap-2">
                                    <dt>Vouchers</dt>
                                    <dd className="text-right font-mono text-text-1">{r.voucherIds.join(', ')}</dd>
                                  </div>
                                )}
                                {r.userId && (
                                  <div className="flex justify-between gap-2">
                                    <dt>Points</dt>
                                    <dd className="text-text-1">
                                      {formatPoints(r.basePoints)} base{r.bonusPoints ? ` + ${formatPoints(r.bonusPoints)} bonus` : ''}
                                    </dd>
                                  </div>
                                )}
                                {r.campaignIds.map((id) => (
                                  <div key={id} className="flex justify-between gap-2">
                                    <dt>{campaignName(id)}</dt>
                                    <dd className="font-bold text-promo-700">+{formatPoints(r.campaignPoints?.[id] ?? 0)} pts</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <div className="border-t border-line px-5 py-3 text-center">
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="min-h-11 rounded-full px-4 text-sm font-bold text-brand hover:bg-brand-soft">
                Show {Math.min(PAGE, rows.length - limit)} more of {formatPoints(rows.length - limit)} remaining
              </button>
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
