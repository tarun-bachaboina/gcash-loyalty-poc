import { apiData, type MerchantAnalytics } from '@gcash/shared';
import { EmptyState, ErrorState, formatPeso, formatPoints, Skeleton, SpacePanel, Tabs, useAsync } from '@gcash/ui';
import { BarChart3, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Shell } from '../app/Shell';
import { useManager } from '../app/session';
import { Delta, PageHeader, shortDate } from '../app/ui';

type Period = '7' | '30' | '90';
const PERIODS = [
  { id: '7' as const, label: '7 days' },
  { id: '30' as const, label: '30 days' },
  { id: '90' as const, label: '90 days' },
];

const pesoShort = (n: number) => (n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${Math.round(n)}`);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * Merchant portal Overview (v2 plan §3). Everyday UI with one calm hero zone (the KPI strip).
 * Feeling: "the programme is bringing paying members through my door, and I can see which campaign did it."
 */
export default function Overview() {
  const { manager, merchant } = useManager();
  const merchantId = manager?.merchantId ?? '';
  const [period, setPeriod] = useState<Period>('30');
  const q = useAsync(() => apiData<MerchantAnalytics>(`/merchant/analytics?merchantId=${encodeURIComponent(merchantId)}&days=${period}`), [merchantId, period]);
  const a = q.data;

  return (
    <Shell>
      <PageHeader
        title="Overview"
        sub={a ? `${merchant?.name ?? 'Your store'} · ${shortDate(a.period.from)} – ${shortDate(a.period.to)}, compared with the ${a.period.days} days before` : 'How the loyalty programme is working for your store'}
        action={<Tabs tabs={PERIODS} value={period} onChange={setPeriod} label="Period" />}
      />

      {q.error && !a ? (
        <ErrorState message={q.error.message} onRetry={() => void q.reload()} />
      ) : !a ? (
        <div className="space-y-4" aria-busy aria-label="Loading analytics">
          <Skeleton className="h-36 rounded-hero" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-hero lg:col-span-2" />
            <Skeleton className="h-80 rounded-hero" />
          </div>
        </div>
      ) : a.kpis.current.memberBills + a.kpis.current.nonMemberBills === 0 ? (
        <EmptyState icon={BarChart3} title="No bills in this period yet" body="Once the POS records sales at your store, revenue, members and campaign results show up here." />
      ) : (
        <div className={`space-y-4 transition-opacity duration-150 ${q.loading ? 'opacity-60' : ''}`}>
          <KpiStrip a={a} />
          <div className="grid gap-4 lg:grid-cols-3">
            <RevenueTrend a={a} />
            <CustomerMix a={a} />
          </div>
          <CampaignResults a={a} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PointsIssued a={a} />
            <BusyHours a={a} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TopProducts a={a} />
            <VoucherRedemptions a={a} />
          </div>
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- KPI strip (hero zone)

function KpiStrip({ a }: { a: MerchantAnalytics }) {
  const { current: c, previous: p } = a.kpis;
  const tiles: { label: string; value: string; delta: ReactNode; sub?: string }[] = [
    { label: 'Member revenue', value: formatPeso(c.memberRevenue), delta: <Delta now={c.memberRevenue} before={p.memberRevenue} />, sub: `${pct(c.memberRevenue, c.memberRevenue + c.nonMemberRevenue)}% of all revenue` },
    { label: 'Member bills', value: formatPoints(c.memberBills), delta: <Delta now={c.memberBills} before={p.memberBills} />, sub: `${formatPoints(c.uniqueMembers)} unique members` },
    { label: 'Avg member bill', value: formatPeso(c.avgMemberBill), delta: <Delta now={c.avgMemberBill} before={p.avgMemberBill} />, sub: `Non-members: ${formatPeso(c.avgNonMemberBill)}` },
    { label: 'Points issued', value: formatPoints(c.basePoints + c.bonusPoints), delta: <Delta now={c.basePoints + c.bonusPoints} before={p.basePoints + p.bonusPoints} />, sub: `${formatPoints(c.bonusPoints)} from campaigns` },
    { label: 'Voucher discounts', value: formatPeso(c.voucherDiscounts), delta: <Delta now={c.voucherDiscounts} before={p.voucherDiscounts} neutral />, sub: `${formatPoints(c.voucherRedemptions)} vouchers used here` },
  ];
  return (
    <SpacePanel drift={false} grid={false} className="rounded-hero p-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <dt className="text-xs font-bold text-on-space-muted">{t.label}</dt>
            <dd className="mt-1 truncate font-display text-2xl font-extrabold text-white tabular-nums">{t.value}</dd>
            <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-on-space-muted">
              {t.delta}
              {t.sub && <span className="truncate">{t.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </SpacePanel>
  );
}

// ---------------------------------------------------------------- building blocks

function Card({ title, takeaway, className, children, table }: { title: string; takeaway: ReactNode; className?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line ${className ?? ''}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mt-0.5 text-sm text-text-2">{takeaway}</p>
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Show data table</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-chip ring-1 ring-line">{table}</div>
        </details>
      )}
    </section>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-2">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-surface-2 text-text-2">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`px-3 py-2 font-bold ${i ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-t border-line">
            {r.map((c, i) => (
              <td key={i} className={`px-3 py-1.5 tabular-nums ${i ? 'text-right' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const axisProps = { tick: { fill: 'var(--text-2)', fontSize: 11 }, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string | number; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-chip bg-surface-1 px-3 py-2 text-xs shadow-e2 ring-1 ring-line">
      <p className="mb-1 font-bold text-text-1">{typeof label === 'string' && /^\d{4}-/.test(label) ? shortDate(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-text-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-bold text-text-1 tabular-nums">{format(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- charts

function RevenueTrend({ a }: { a: MerchantAnalytics }) {
  const c = a.kpis.current;
  const lift = c.avgNonMemberBill ? Math.round(((c.avgMemberBill - c.avgNonMemberBill) / c.avgNonMemberBill) * 100) : 0;
  const shaded = a.campaigns.filter((x) => x.bills > 0);
  return (
    <Card
      className="lg:col-span-2"
      title="Revenue by day"
      takeaway={`Members brought ${pct(c.memberRevenue, c.memberRevenue + c.nonMemberRevenue)}% of revenue${lift > 0 ? `, and their average bill is ${lift}% higher than non-members'` : ''}.${shaded.length ? ' Shaded: campaign periods.' : ''}`}
      table={<DataTable head={['Date', 'Members', 'Non-members', 'Bills']} rows={a.daily.map((d) => [d.date, formatPeso(d.memberRevenue), formatPeso(d.nonMemberRevenue), d.bills])} />}
    >
      <Legend items={[{ color: 'var(--chart-1)', label: 'Member bills' }, { color: 'var(--chart-2)', label: 'Non-member bills' }]} />
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={a.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            {shaded.map((x) => (
              <ReferenceArea key={x.campaignId} x1={x.startDate < a.period.from ? a.period.from : x.startDate} x2={x.endDate > a.period.to ? a.period.to : x.endDate} fill="var(--promo-100)" fillOpacity={0.6} ifOverflow="hidden" />
            ))}
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={pesoShort} width={48} {...axisProps} />
            <Tooltip content={<ChartTooltip format={formatPeso} />} cursor={{ stroke: 'var(--text-2)', strokeDasharray: '3 3' }} />
            <Line name="Members" dataKey="memberRevenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }} isAnimationActive={false} />
            <Line name="Non-members" dataKey="nonMemberRevenue" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function CustomerMix({ a }: { a: MerchantAnalytics }) {
  const { newMembers, returningMembers } = a.customerMix;
  const total = newMembers + returningMembers;
  return (
    <Card title="Members" takeaway={total ? `${pct(returningMembers, total)}% of members who shopped had been here before.` : 'No member bills in this period.'}>
      <p className="font-display text-4xl font-extrabold tabular-nums">{formatPoints(total)}</p>
      <p className="text-sm text-text-2">members bought from you</p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${newMembers} new, ${returningMembers} returning`}>
        <div style={{ width: `${pct(returningMembers, total)}%`, background: 'var(--chart-1)' }} />
        <div className="border-l-2 border-surface-1" style={{ width: `${pct(newMembers, total)}%`, background: 'var(--chart-3)' }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-text-2">
            <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-1)' }} aria-hidden />
            Returning
          </dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatPoints(returningMembers)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-text-2">
            <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-3)' }} aria-hidden />
            First visit
          </dt>
          <dd className="font-display text-xl font-bold tabular-nums">{formatPoints(newMembers)}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-line pt-3 text-sm text-text-2">
        Bills without a member scan: <span className="font-bold text-text-1 tabular-nums">{formatPoints(a.kpis.current.nonMemberBills)}</span>
      </p>
    </Card>
  );
}

function PointsIssued({ a }: { a: MerchantAnalytics }) {
  // 90 days of daily bars is too dense: group by week
  const rows =
    a.period.days > 30
      ? a.daily.reduce<{ date: string; basePoints: number; bonusPoints: number }[]>((acc, d, i) => {
          if (i % 7 === 0) acc.push({ date: d.date, basePoints: 0, bonusPoints: 0 });
          acc[acc.length - 1].basePoints += d.basePoints;
          acc[acc.length - 1].bonusPoints += d.bonusPoints;
          return acc;
        }, [])
      : a.daily;
  const { basePoints, bonusPoints } = a.kpis.current;
  return (
    <Card
      title={a.period.days > 30 ? 'Points issued per week' : 'Points issued per day'}
      takeaway={bonusPoints ? `Campaigns added ${formatPoints(bonusPoints)} bonus points, ${pct(bonusPoints, basePoints + bonusPoints)}% of everything you issued.` : 'No campaign bonus points in this period: every point was base earn (₱100 = 1 pt).'}
      table={<DataTable head={[a.period.days > 30 ? 'Week of' : 'Date', 'Base', 'Campaign bonus']} rows={rows.map((d) => [d.date, formatPoints(d.basePoints), formatPoints(d.bonusPoints)])} />}
    >
      <Legend items={[{ color: 'var(--chart-1)', label: 'Base points' }, { color: 'var(--chart-2)', label: 'Campaign bonus' }]} />
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={20} {...axisProps} />
            <YAxis width={40} {...axisProps} />
            <Tooltip content={<ChartTooltip format={(n) => `${formatPoints(n)} pts`} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar name="Base" dataKey="basePoints" stackId="p" fill="var(--chart-1)" stroke="var(--surface-1)" strokeWidth={1} isAnimationActive={false} />
            <Bar name="Campaign bonus" dataKey="bonusPoints" stackId="p" fill="var(--chart-2)" stroke="var(--surface-1)" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 10); // 10:00–21:00 mall hours
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function BusyHours({ a }: { a: MerchantAnalytics }) {
  const [hover, setHover] = useState<string>();
  const cell = (dow: number, hour: number) => a.heatmap.find((h) => h.dow === dow && h.hour === hour)?.bills ?? 0;
  const max = Math.max(1, ...a.heatmap.map((h) => h.bills));
  const top = a.heatmap.slice().sort((x, y) => y.bills - x.bills)[0];
  const step = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return (
    <Card title="Busy hours" takeaway={top ? `Busiest slot: ${DAYS[top.dow]} ${hourLabel(top.hour)}–${hourLabel(top.hour + 1)} (${top.bills} bills). Time campaigns for the quiet ones.` : 'No bills yet.'}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-xs" aria-label="Bills by weekday and hour">
          <thead>
            <tr>
              <th className="w-9" />
              {HOURS.map((h) => (
                <th key={h} scope="col" className="pb-1 font-normal text-text-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d, dow) => (
              <tr key={d}>
                <th scope="row" className="pr-1 text-left font-normal text-text-2">
                  {d}
                </th>
                {HOURS.map((h) => {
                  const n = cell(dow, h);
                  const label = `${d} ${hourLabel(h)}: ${n} bill${n === 1 ? '' : 's'}`;
                  return (
                    <td
                      key={h}
                      aria-label={label}
                      onMouseEnter={() => setHover(label)}
                      onMouseLeave={() => setHover(undefined)}
                      className="h-6 min-w-6 rounded-[4px]"
                      style={{ background: step(n) ? `var(--chart-seq-${step(n)})` : 'var(--surface-2)' }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-2">
        <span aria-live="polite" className="min-h-4 font-semibold text-text-1">
          {hover ?? 'Hover a cell for the count'}
        </span>
        <span className="inline-flex items-center gap-1">
          Fewer
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="size-3 rounded-[3px]" style={{ background: `var(--chart-seq-${s})` }} aria-hidden />
          ))}
          More bills
        </span>
      </div>
    </Card>
  );
}

function CampaignResults({ a }: { a: MerchantAnalytics }) {
  const best = a.campaigns.slice().sort((x, y) => y.revenue - x.revenue)[0];
  const liftOf = (c: MerchantAnalytics['campaigns'][number]) => (c.avgBillBefore && c.bills ? Math.round(((c.avgBillDuring - c.avgBillBefore) / c.avgBillBefore) * 100) : null);
  return (
    <Card
      title="Campaign results"
      takeaway={
        best && best.bills
          ? `${best.name} drove ${formatPeso(best.revenue)} from ${best.bills} bills${liftOf(best) !== null ? `; average bill ${liftOf(best)! >= 0 ? '+' : ''}${liftOf(best)}% vs the 2 weeks before` : ''}.`
          : 'No approved campaign ran in this period. Start one from Campaigns.'
      }
    >
      {a.campaigns.length === 0 ? (
        <p className="flex items-center gap-2 rounded-chip bg-surface-2 px-3 py-3 text-sm text-text-2">
          <Zap className="size-4" aria-hidden />
          Campaigns you run show their bills, revenue and bonus points here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-text-2">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-bold">Campaign</th>
                <th className="py-2 pr-3 text-right font-bold">Bills</th>
                <th className="py-2 pr-3 text-right font-bold">Revenue</th>
                <th className="py-2 pr-3 text-right font-bold">Bonus pts</th>
                <th className="py-2 pr-3 text-right font-bold">₱ per bonus pt</th>
                <th className="py-2 text-right font-bold">Avg bill vs before</th>
              </tr>
            </thead>
            <tbody>
              {a.campaigns.map((c) => {
                const lift = liftOf(c);
                return (
                  <tr key={c.campaignId} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-bold">{c.name}</p>
                      <p className="text-xs text-text-2">
                        {shortDate(c.startDate)} – {shortDate(c.endDate)}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatPoints(c.bills)}</td>
                    <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{formatPeso(c.revenue)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatPoints(c.bonusPoints)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.revenuePerBonusPoint ? formatPeso(c.revenuePerBonusPoint) : '—'}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {lift === null ? '—' : (
                        <span className={lift >= 0 ? 'font-bold text-success-700' : 'font-bold text-danger-700'}>
                          {lift >= 0 ? '+' : ''}
                          {lift}%
                        </span>
                      )}
                      <span className="block text-xs text-text-2">
                        {formatPeso(c.avgBillDuring)} vs {c.avgBillBefore ? formatPeso(c.avgBillBefore) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TopProducts({ a }: { a: MerchantAnalytics }) {
  const top = a.topProducts[0];
  const data = a.topProducts.map((p) => ({ ...p, label: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name }));
  return (
    <Card
      title="Top products"
      takeaway={top ? `${top.name} leads with ${formatPeso(top.revenue)} (${formatPoints(top.qty)} sold).${a.topProducts.some((p) => p.campaignTagged) ? ' Orange: targeted by a campaign.' : ''}` : 'No products sold yet.'}
      table={<DataTable head={['Product', 'Qty', 'Revenue']} rows={a.topProducts.map((p) => [`${p.name}${p.campaignTagged ? ' (campaign)' : ''}`, p.qty, formatPeso(p.revenue)])} />}
    >
      <div style={{ height: Math.max(120, data.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={150} {...axisProps} />
            <Tooltip content={<ChartTooltip format={formatPeso} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar
              name="Revenue"
              dataKey="revenue"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              label={{ position: 'right', fill: 'var(--text-2)', fontSize: 11, formatter: (v: unknown) => pesoShort(Number(v)) }}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { campaignTagged: boolean } }) => (
                <rect x={props.x} y={props.y} width={Math.max(0, props.width ?? 0)} height={props.height} rx={4} fill={props.payload?.campaignTagged ? 'var(--chart-2)' : 'var(--chart-1)'} />
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function VoucherRedemptions({ a }: { a: MerchantAnalytics }) {
  const { voucherDiscounts, voucherRedemptions } = a.kpis.current;
  return (
    <Card
      title="Vouchers used at your store"
      takeaway={voucherRedemptions ? `${formatPoints(voucherRedemptions)} vouchers redeemed here, ${formatPeso(voucherDiscounts)} in discounts funded by your store.` : 'No vouchers were redeemed at your store in this period.'}
    >
      {a.vouchers.length === 0 ? (
        <p className="rounded-chip bg-surface-2 px-3 py-3 text-sm text-text-2">When members pay with a voucher at your POS, it shows up here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {a.vouchers.map((v) => (
            <li key={v.rewardId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-bold">{v.title}</p>
                <p className="font-mono text-xs text-text-2">{v.rewardId}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums">{formatPeso(v.discount)}</p>
                <p className="text-xs text-text-2 tabular-nums">{formatPoints(v.count)} used</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
