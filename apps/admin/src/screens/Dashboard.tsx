import { apiData, BRANCH_LABEL, type Dashboard as DashboardData } from '@gcash/shared';
import { Button, Coin, ErrorState, formatPeso, formatPoints, Skeleton, SpacePanel, useAsync } from '@gcash/ui';
import { ArrowDownRight, ChevronRight, CircleCheck, ClipboardCheck, Coins, Megaphone, RefreshCw, Store, Ticket } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Shell, table } from '../app/Shell';

/** PRD A-1: Executive Points Economy Dashboard. */
export default function Dashboard() {
  const q = useAsync(() => apiData<DashboardData>('/admin/dashboard'), []);
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const { data, reload } = q;

  useEffect(() => {
    if (data) setUpdatedAt(new Date());
  }, [data]);
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  const totals = data?.merchants.reduce(
    (t, m) => ({ sales: t.sales + m.totalSales, bills: t.bills + m.bills, points: t.points + m.pointsIssued, bonus: t.bonus + m.bonusPoints, redeemed: t.redeemed + m.vouchersRedeemed, funded: t.funded + m.discountsFunded }),
    { sales: 0, bills: 0, points: 0, bonus: 0, redeemed: 0, funded: 0 },
  );

  return (
    <Shell
      title="Executive Points Economy Dashboard"
      description="Ayala Mall Manila Bay · all figures since program launch"
      actions={
        <>
          {updatedAt && (
            <span className="text-xs text-text-2" aria-live="polite">
              Updated {updatedAt.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          )}
          <Button variant="secondary" onClick={() => void reload()} disabled={q.loading} icon={<RefreshCw className={`size-4 ${q.loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden />}>
            Refresh
          </Button>
        </>
      }
    >
      {q.error && !data ? (
        <ErrorState message={q.error.message} onRetry={() => void reload()} />
      ) : (
        <>
          {/* KPI summary cards: the console's one (calm) hero zone */}
          <SpacePanel drift={false} grid={false} className="rounded-hero p-2" aria-busy={!data}>
            <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Total Points Issued" loading={!data} icon={<Coin size={24} />}>
                {data && (
                  <>
                    <span className="text-gold-300">{formatPoints(data.totalPointsIssued)}</span> <Unit>PTS</Unit>
                  </>
                )}
              </Kpi>
              <Kpi label="Total Points Redeemed" loading={!data} icon={<ArrowDownRight className="size-6 text-gold-300" aria-hidden />}>
                {data && (
                  <>
                    <span className="text-gold-300">{formatPoints(data.totalPointsRedeemed)}</span> <Unit>PTS</Unit>
                  </>
                )}
              </Kpi>
              <Kpi label="Active Unredeemed Vouchers" loading={!data} icon={<Ticket className="size-6 text-on-space-success" aria-hidden />}>
                {data && (
                  <>
                    {formatPoints(data.activeVouchers.count)} <Unit>Vouchers</Unit>
                    <span className="mt-1 block text-sm font-semibold text-on-space-muted">{formatPeso(data.activeVouchers.value)} value</span>
                  </>
                )}
              </Kpi>
              <Kpi label="Active Merchant Count" loading={!data} icon={<Store className="size-6 text-on-space-success" aria-hidden />}>
                {data && (
                  <>
                    {data.activeMerchantCount} <Unit>Stores Onboarded</Unit>
                  </>
                )}
              </Kpi>
            </dl>
          </SpacePanel>

          {/* v2: campaigns, approvals, store-funded discounts and the fixed programme values (working surface) */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card icon={ClipboardCheck} label="Waiting for your review" to="/approvals" loading={!data}>
              {data && (
                <>
                  <p className="font-display text-2xl font-extrabold tabular">{data.pendingApprovals.campaigns + data.pendingApprovals.rewards}</p>
                  <p className="text-xs text-text-2">
                    {data.pendingApprovals.campaigns} campaign{data.pendingApprovals.campaigns === 1 ? '' : 's'} · {data.pendingApprovals.rewards} store reward{data.pendingApprovals.rewards === 1 ? '' : 's'}
                  </p>
                </>
              )}
            </Card>
            <Card icon={Megaphone} label="Campaigns live" loading={!data}>
              {data && (
                <>
                  <p className="font-display text-2xl font-extrabold tabular">{data.campaigns.live}</p>
                  <p className="text-xs text-text-2">
                    {data.campaigns.scheduled} scheduled · {formatPoints(data.campaigns.bonusPointsIssued)} bonus pts issued
                  </p>
                </>
              )}
            </Card>
            <Card icon={Ticket} label="Voucher discounts funded by stores" loading={!data}>
              {data && (
                <>
                  <p className="font-display text-2xl font-extrabold tabular">{formatPeso(data.voucherDiscountsFunded)}</p>
                  <p className="text-xs text-text-2">Each store funds the vouchers redeemed there</p>
                </>
              )}
            </Card>
            <Card icon={Coins} label="Programme values (fixed)" loading={!data}>
              {data && (
                <>
                  <p className="font-display text-lg font-extrabold tabular">
                    ₱{data.program.spendPerPoint} = 1 pt · 1 pt = {formatPeso(data.program.pointValue)}
                  </p>
                  <p className="text-xs text-text-2">Same at every store; campaigns add bonus points on top</p>
                </>
              )}
            </Card>
          </div>

          <section aria-labelledby="perf" className="mt-6">
            <h2 id="perf" className="mb-3 font-display text-lg font-bold">
              Merchant Performance Comparison
            </h2>
            {!data ? (
              <Skeleton className="h-96 rounded-card" />
            ) : (
              <div className={table.wrap}>
                <table className={`${table.table} min-w-[1040px]`}>
                  <thead className={table.thead}>
                    <tr>
                      <th scope="col" className={table.th}>Merchant Name</th>
                      <th scope="col" className={`${table.th} text-right`}>Total Sales Value (₱)</th>
                      <th scope="col" className={`${table.th} text-right`}>Bills</th>
                      <th scope="col" className={`${table.th} text-right`}>Points Issued</th>
                      <th scope="col" className={`${table.th} text-right`}>of which Campaign Bonus</th>
                      <th scope="col" className={`${table.th} text-right`}>Vouchers Redeemed</th>
                      <th scope="col" className={`${table.th} text-right`}>Discounts Funded (₱)</th>
                      <th scope="col" className={table.th}>Active Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.merchants.map((m) => (
                      <tr key={m.merchantId} className={table.row}>
                        <th scope="row" className={`${table.td} font-semibold`}>
                          {m.name}
                          <span className="block text-xs font-normal text-text-2">{BRANCH_LABEL[m.merchantId]?.split(' - ')[1] ?? m.merchantId}</span>
                        </th>
                        <td className={table.num}>{formatPeso(m.totalSales)}</td>
                        <td className={table.num}>{formatPoints(m.bills)}</td>
                        <td className={`${table.num} font-semibold`}>{formatPoints(m.pointsIssued)}</td>
                        <td className={table.num}>{m.bonusPoints ? formatPoints(m.bonusPoints) : '—'}</td>
                        <td className={table.num}>{formatPoints(m.vouchersRedeemed)}</td>
                        <td className={table.num}>{formatPeso(m.discountsFunded)}</td>
                        <td className={table.td}>
                          {m.active ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-bold text-success-700">
                                <CircleCheck className="size-3.5" aria-hidden />
                                Active
                              </span>
                              {m.liveCampaigns > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-promo-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-promo-700">
                                  <Megaphone className="size-3.5" aria-hidden />
                                  {m.liveCampaigns} live campaign{m.liveCampaigns === 1 ? '' : 's'}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-text-2">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot className="border-t-2 border-line bg-surface-2 font-bold">
                      <tr>
                        <th scope="row" className={table.td}>
                          All {data.merchants.length} stores
                        </th>
                        <td className={table.num}>{formatPeso(totals.sales)}</td>
                        <td className={table.num}>{formatPoints(totals.bills)}</td>
                        <td className={table.num}>{formatPoints(totals.points)}</td>
                        <td className={table.num}>{formatPoints(totals.bonus)}</td>
                        <td className={table.num}>{formatPoints(totals.redeemed)}</td>
                        <td className={table.num}>{formatPeso(totals.funded)}</td>
                        <td className={table.td} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function Kpi({ label, loading, icon, children }: { label: string; loading: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-card bg-white/8 ring-1 ring-white/12 p-4">
      <dt className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-on-space-muted">{label}</span>
        {icon}
      </dt>
      <dd className="mt-3 font-display text-3xl font-extrabold tabular text-white">{loading ? <span className="block h-9 w-32 rounded bg-white/15 motion-safe:animate-pulse" /> : children}</dd>
    </div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="font-sans text-sm font-bold text-on-space-muted">{children}</span>;
}

function Card({ icon: Icon, label, to, loading, children }: { icon: typeof Store; label: string; to?: string; loading: boolean; children: ReactNode }) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-xs font-semibold text-text-2">
        <Icon className="size-4 text-brand" aria-hidden />
        {label}
        {to && <ChevronRight className="ml-auto size-4" aria-hidden />}
      </p>
      <div className="mt-2">{loading ? <Skeleton className="h-12 w-32" /> : children}</div>
    </>
  );
  const cls = 'block rounded-card bg-surface-1 p-4 shadow-e1 ring-1 ring-line';
  return to ? (
    <Link to={to} className={`${cls} transition hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-brand`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
