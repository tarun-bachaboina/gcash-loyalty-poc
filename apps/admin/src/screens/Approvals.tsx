import { apiData, apiRequest, ApiRequestError, type CampaignView, type Merchant, type Reward } from '@gcash/shared';
import { Button, CampaignPill, Dialog, EmptyState, ErrorState, formatManilaDateTime, formatPeso, formatPoints, InlineError, RewardPill, RewardTile, Skeleton, Tabs, useAsync } from '@gcash/ui';
import { CircleCheck, ClipboardCheck, OctagonAlert, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Shell, table } from '../app/Shell';

type Kind = 'campaigns' | 'rewards';
type CampaignFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ENDED';
type RewardFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const campaignIn = (f: CampaignFilter, c: CampaignView) =>
  f === 'PENDING' ? c.displayStatus === 'PENDING'
  : f === 'APPROVED' ? c.displayStatus === 'LIVE' || c.displayStatus === 'SCHEDULED'
  : f === 'REJECTED' ? c.displayStatus === 'REJECTED'
  : c.displayStatus === 'ENDED' || c.displayStatus === 'WITHDRAWN';
const rewardIn = (f: RewardFilter, r: Reward) =>
  f === 'PENDING' ? r.status === 'PENDING' : f === 'APPROVED' ? r.status === 'ACTIVE' || r.status === 'PAUSED' : r.status === 'REJECTED' || r.status === 'WITHDRAWN';

/**
 * v2 Approvals: campaigns and store rewards submitted by merchants. Everyday UI (calm, dense, decisive).
 * Feeling: "I can see exactly what a merchant is asking for, what it will cost, and decide in one place."
 */
export default function Approvals() {
  const [params, setParams] = useSearchParams();
  const kind: Kind = params.get('tab') === 'rewards' ? 'rewards' : 'campaigns';
  const campaigns = useAsync(() => apiData<CampaignView[]>('/admin/campaigns'), []);
  // Store rewards only: the mall's own common rewards never need approval
  const rewards = useAsync(() => apiData<Reward[]>('/admin/rewards'), []);
  const merchants = useAsync(() => apiData<Merchant[]>('/merchant/list'), []);
  const [cFilter, setCFilter] = useState<CampaignFilter>('PENDING');
  const [rFilter, setRFilter] = useState<RewardFilter>('PENDING');
  const [openCampaign, setOpenCampaign] = useState<CampaignView | null>(null);
  const [openReward, setOpenReward] = useState<Reward | null>(null);
  const [notice, setNotice] = useState<string>();
  const [decisions, setDecisions] = useState(0);

  const cList = campaigns.data ?? [];
  const rList = (rewards.data ?? []).filter((r) => r.createdBy === 'MERCHANT');
  const storeName = (id?: string) => merchants.data?.find((m) => m.merchantId === id)?.name ?? id ?? '';

  async function decided(message: string) {
    setNotice(message);
    setOpenCampaign(null);
    setOpenReward(null);
    setDecisions((n) => n + 1);
    await Promise.all([campaigns.reload(), rewards.reload()]);
  }

  return (
    <Shell title="Approvals" description="Campaigns and store rewards submitted by merchants. Nothing reaches shoppers until you approve it." pendingKey={decisions}>
      <Tabs
        className="mb-4 w-fit max-w-full"
        label="Approval type"
        value={kind}
        onChange={(k) => setParams(k === 'rewards' ? { tab: 'rewards' } : {}, { replace: true })}
        tabs={[
          { id: 'campaigns' as const, label: 'Campaigns', count: cList.filter((c) => c.status === 'PENDING').length },
          { id: 'rewards' as const, label: 'Store rewards', count: rList.filter((r) => r.status === 'PENDING').length },
        ]}
      />

      {notice && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-card bg-success-100 px-4 py-3 text-sm font-semibold text-success-700">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {kind === 'campaigns' ? (
        <>
          <Tabs
            className="mb-4 w-fit max-w-full"
            label="Campaign status"
            value={cFilter}
            onChange={setCFilter}
            tabs={[
              { id: 'PENDING' as const, label: 'Pending', count: cList.filter((c) => campaignIn('PENDING', c)).length },
              { id: 'APPROVED' as const, label: 'Live & scheduled', count: cList.filter((c) => campaignIn('APPROVED', c)).length },
              { id: 'REJECTED' as const, label: 'Rejected', count: cList.filter((c) => campaignIn('REJECTED', c)).length },
              { id: 'ENDED' as const, label: 'Ended & withdrawn', count: cList.filter((c) => campaignIn('ENDED', c)).length },
            ]}
          />
          {campaigns.error && !campaigns.data ? (
            <ErrorState message={campaigns.error.message} onRetry={() => void campaigns.reload()} />
          ) : !campaigns.data ? (
            <Skeleton className="h-72 rounded-card" />
          ) : cList.filter((c) => campaignIn(cFilter, c)).length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={cFilter === 'PENDING' ? 'All caught up' : 'Nothing here'} body={cFilter === 'PENDING' ? 'No campaigns are waiting for review. New submissions from stores appear here.' : 'No campaigns in this state.'} />
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[960px]`}>
                <thead className={table.thead}>
                  <tr>
                    <th scope="col" className={table.th}>Campaign</th>
                    <th scope="col" className={table.th}>Store</th>
                    <th scope="col" className={table.th}>Runs</th>
                    <th scope="col" className={`${table.th} text-right`}>Est. bonus points</th>
                    <th scope="col" className={table.th}>Submitted</th>
                    <th scope="col" className={table.th}>Status</th>
                    <th scope="col" className={table.th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cList
                    .filter((c) => campaignIn(cFilter, c))
                    .map((c) => (
                      <tr key={c.campaignId} className={table.row}>
                        <th scope="row" className={`${table.td} font-semibold`}>
                          {c.name}
                          <span className="block text-xs font-normal text-promo-700">{c.mechanics.replace(` at ${c.merchantName}`, '')}</span>
                        </th>
                        <td className={table.td}>{c.merchantName}</td>
                        <td className={`${table.td} whitespace-nowrap`}>
                          {shortDate(c.startDate)} – {shortDate(c.endDate)}
                        </td>
                        <td className={table.num}>{c.estimate ? `~${formatPoints(c.estimate.projectedBonusPoints)}` : '—'}</td>
                        <td className={`${table.td} whitespace-nowrap tabular`}>{formatManilaDateTime(c.submittedAt).slice(0, 10)}</td>
                        <td className={table.td}>
                          <CampaignPill status={c.displayStatus} />
                        </td>
                        <td className={`${table.td} text-right`}>
                          <Button variant={c.status === 'PENDING' ? 'primary' : 'secondary'} className="min-h-9" onClick={() => setOpenCampaign(c)} aria-label={`${c.status === 'PENDING' ? 'Review' : 'View'} ${c.name}`}>
                            {c.status === 'PENDING' ? 'Review' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <Tabs
            className="mb-4 w-fit max-w-full"
            label="Reward status"
            value={rFilter}
            onChange={setRFilter}
            tabs={[
              { id: 'PENDING' as const, label: 'Pending', count: rList.filter((r) => rewardIn('PENDING', r)).length },
              { id: 'APPROVED' as const, label: 'Approved', count: rList.filter((r) => rewardIn('APPROVED', r)).length },
              { id: 'REJECTED' as const, label: 'Rejected & withdrawn', count: rList.filter((r) => rewardIn('REJECTED', r)).length },
            ]}
          />
          {rewards.error && !rewards.data ? (
            <ErrorState message={rewards.error.message} onRetry={() => void rewards.reload()} />
          ) : !rewards.data ? (
            <Skeleton className="h-72 rounded-card" />
          ) : rList.filter((r) => rewardIn(rFilter, r)).length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={rFilter === 'PENDING' ? 'All caught up' : 'Nothing here'} body={rFilter === 'PENDING' ? 'No store rewards are waiting for review.' : 'No store rewards in this state.'} />
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[960px]`}>
                <thead className={table.thead}>
                  <tr>
                    <th scope="col" className={table.th}>Reward</th>
                    <th scope="col" className={table.th}>Store</th>
                    <th scope="col" className={`${table.th} text-right`}>Points</th>
                    <th scope="col" className={`${table.th} text-right`}>Face value</th>
                    <th scope="col" className={`${table.th} text-right`}>Stock</th>
                    <th scope="col" className={table.th}>Status</th>
                    <th scope="col" className={table.th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rList
                    .filter((r) => rewardIn(rFilter, r))
                    .map((r) => (
                      <tr key={r.rewardId} className={table.row}>
                        <th scope="row" className={`${table.td} font-semibold`}>
                          {r.title}
                          <span className="block text-xs font-normal text-text-2">{r.termsText}</span>
                        </th>
                        <td className={table.td}>{storeName(r.merchantId)}</td>
                        <td className={table.num}>{formatPoints(r.pointsRequired)}</td>
                        <td className={table.num}>{formatPeso(r.discountAmount)}</td>
                        <td className={table.num}>{formatPoints(r.stockQuantity)}</td>
                        <td className={table.td}>
                          <RewardPill status={r.status} />
                        </td>
                        <td className={`${table.td} text-right`}>
                          <Button variant={r.status === 'PENDING' ? 'primary' : 'secondary'} className="min-h-9" onClick={() => setOpenReward(r)} aria-label={`${r.status === 'PENDING' ? 'Review' : 'View'} ${r.title}`}>
                            {r.status === 'PENDING' ? 'Review' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {openCampaign && <CampaignReview c={openCampaign} all={cList} onClose={() => setOpenCampaign(null)} onDecided={decided} />}
      {openReward && <RewardReview r={openReward} storeName={storeName(openReward.merchantId)} onClose={() => setOpenReward(null)} onDecided={decided} />}
    </Shell>
  );
}

// ---------------------------------------------------------------- decision footer (shared)

function useDecision(onDecided: (message: string) => Promise<void>) {
  const [mode, setMode] = useState<'view' | 'reject'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function run(path: string, body: object | undefined, message: string) {
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(path, { method: 'POST', body });
      await onDecided(message);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That didn’t work. Try again.');
      setBusy(false);
    }
  }
  return { mode, setMode, reason, setReason, busy, error, setError, run };
}

function RejectBox({ d, what }: { d: ReturnType<typeof useDecision>; what: string }) {
  return (
    <div className="mt-4">
      <label htmlFor="reject-reason" className="text-sm font-bold">
        Reason for the merchant
      </label>
      <textarea
        id="reject-reason"
        data-autofocus
        rows={3}
        value={d.reason}
        onChange={(e) => d.setReason(e.target.value)}
        placeholder={`e.g. The ${what} overlaps your live campaign; resubmit after it ends.`}
        className="mt-1.5 w-full rounded-chip bg-surface-1 px-3 py-2 text-sm ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
      <p className="mt-1 text-xs text-text-2">The store sees this on its {what} and can duplicate it to resubmit.</p>
    </div>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-card bg-surface-2 px-4 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2.5">
          <dt className="text-text-2">{k}</dt>
          <dd className="text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- campaign review

function CampaignReview({ c, all, onClose, onDecided }: { c: CampaignView; all: CampaignView[]; onClose: () => void; onDecided: (m: string) => Promise<void> }) {
  const d = useDecision(onDecided);
  const pending = c.status === 'PENDING';
  const endable = c.displayStatus === 'LIVE' || c.displayStatus === 'SCHEDULED';
  // Same store, dates overlap, still in play
  const overlaps = all.filter(
    (o) => o.campaignId !== c.campaignId && o.merchantId === c.merchantId && ['PENDING', 'LIVE', 'SCHEDULED'].includes(o.displayStatus) && o.startDate <= c.endDate && o.endDate >= c.startDate,
  );
  const e = c.estimate;

  const footer = pending ? (
    d.mode === 'reject' ? (
      <>
        <Button onClick={() => (d.reason.trim() ? void d.run(`/admin/campaigns/${c.campaignId}/reject`, { reason: d.reason.trim() }, `${c.name} was rejected. ${c.merchantName} can see your reason.`) : d.setError('Tell the merchant why the campaign is rejected.'))} disabled={d.busy}>
          {d.busy ? 'Rejecting…' : 'Reject campaign'}
        </Button>
        <Button variant="secondary" onClick={() => d.setMode('view')} disabled={d.busy}>
          Back
        </Button>
      </>
    ) : (
      <>
        <Button onClick={() => void d.run(`/admin/campaigns/${c.campaignId}/approve`, undefined, `${c.name} is approved. It goes live on ${shortDate(c.startDate)}.`)} disabled={d.busy}>
          {d.busy ? 'Approving…' : 'Approve campaign'}
        </Button>
        <Button variant="secondary" onClick={() => d.setMode('reject')} disabled={d.busy}>
          Reject…
        </Button>
      </>
    )
  ) : endable ? (
    <>
      <Button variant="secondary" onClick={() => void d.run(`/admin/campaigns/${c.campaignId}/end`, undefined, `${c.name} has ended. ${c.merchantName}'s bills earn base points only from now.`)} disabled={d.busy}>
        {d.busy ? 'Ending…' : c.displayStatus === 'LIVE' ? 'End campaign now' : 'Cancel before it starts'}
      </Button>
    </>
  ) : undefined;

  return (
    <Dialog open onClose={onClose} busy={d.busy} size="lg" title={c.name} description={`${c.merchantName} · ${c.campaignId}`} footer={footer}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignPill status={c.displayStatus} />
            <span className="text-sm font-semibold text-promo-700">{c.mechanics}</span>
          </div>
          <Facts
            rows={[
              ['Runs', `${shortDate(c.startDate)} – ${shortDate(c.endDate)}`],
              ['Bonus budget', c.budgetPoints !== undefined ? `${formatPoints(c.budgetPoints)} pts (ends when used up)` : 'No cap'],
              ['Bonus points given so far', formatPoints(c.bonusPointsIssued)],
              ['Submitted', formatManilaDateTime(c.submittedAt)],
              ...(c.decidedAt ? ([[c.status === 'REJECTED' ? 'Rejected' : c.status === 'WITHDRAWN' ? 'Withdrawn' : 'Decided', formatManilaDateTime(c.decidedAt)]] as [string, ReactNode][]) : []),
              ...(c.rejectReason ? ([['Reason given', c.rejectReason]] as [string, ReactNode][]) : []),
            ]}
          />
          {e && (
            <section className="rounded-card p-4 ring-1 ring-line">
              <h3 className="text-sm font-bold">Estimated bonus points</h3>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">~{formatPoints(e.projectedBonusPoints)} pts</p>
              <p className="mt-1 text-xs text-text-2">
                Based on {c.merchantName}’s last 30 days: {formatPoints(e.qualifyingBills)} of {formatPoints(e.memberBills)} member bills would have qualified, earning {formatPoints(e.bonusPoints30d)} bonus points. Scaled to the campaign’s length{c.budgetPoints !== undefined ? ' and capped by its budget' : ''}. The store issues these points; vouchers are funded by the store where points are spent.
              </p>
            </section>
          )}
          {overlaps.length > 0 && (
            <p className="flex gap-2 rounded-card bg-promo-100 px-4 py-3 text-sm text-promo-700">
              <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-bold">Overlaps with {overlaps.map((o) => `${o.name} (${o.displayStatus.toLowerCase()})`).join(', ')}.</span> On a bill, each item earns only the highest multiplier; the largest flat bonus is added on top.
              </span>
            </p>
          )}
          <div>
            <h3 className="text-sm font-bold">Terms & conditions</h3>
            <p className="mt-1 text-sm whitespace-pre-line text-text-2">{c.terms}</p>
          </div>
          {d.mode === 'reject' && <RejectBox d={d} what="campaign" />}
          {d.error && <InlineError>{d.error}</InlineError>}
        </div>

        <div>
          <p className="text-xs font-bold text-text-2">Shoppers will see</p>
          <article className="mt-2 rounded-card bg-surface-1 p-4 shadow-e1 ring-1 ring-line">
            <span className="inline-flex items-center gap-1 rounded-full bg-promo-100 px-2.5 py-0.5 text-xs font-bold text-promo-700">
              <Zap className="size-3.5" aria-hidden />
              {c.multiplier ? `${c.multiplier}× points` : `+${formatPoints(c.flatBonus ?? 0)} pts`}
            </span>
            <h4 className="mt-2 font-display text-base leading-tight font-bold">{c.name}</h4>
            <p className="mt-1 text-sm text-text-2">{c.mechanics}</p>
            <p className="mt-2 text-xs text-text-2">Valid until {shortDate(c.endDate)}</p>
          </article>
          <p className="mt-2 text-xs text-text-2">Shown in the customer app’s Promos once approved.</p>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- reward review

function RewardReview({ r, storeName, onClose, onDecided }: { r: Reward; storeName: string; onClose: () => void; onDecided: (m: string) => Promise<void> }) {
  const d = useDecision(onDecided);
  const pending = r.status === 'PENDING';
  const footer = pending ? (
    d.mode === 'reject' ? (
      <>
        <Button onClick={() => (d.reason.trim() ? void d.run(`/admin/rewards/${r.rewardId}/reject`, { reason: d.reason.trim() }, `${r.title} was rejected. ${storeName} can see your reason.`) : d.setError('Tell the merchant why the reward is rejected.'))} disabled={d.busy}>
          {d.busy ? 'Rejecting…' : 'Reject reward'}
        </Button>
        <Button variant="secondary" onClick={() => d.setMode('view')} disabled={d.busy}>
          Back
        </Button>
      </>
    ) : (
      <>
        <Button onClick={() => void d.run(`/admin/rewards/${r.rewardId}/approve`, undefined, `${r.title} is approved. Shoppers can claim it in the catalogue now.`)} disabled={d.busy}>
          {d.busy ? 'Approving…' : 'Approve and publish'}
        </Button>
        <Button variant="secondary" onClick={() => d.setMode('reject')} disabled={d.busy}>
          Reject…
        </Button>
      </>
    )
  ) : undefined;

  return (
    <Dialog open onClose={onClose} busy={d.busy} size="lg" title={r.title} description={`${storeName} · ${r.rewardId}`} footer={footer}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="space-y-4">
          <RewardPill status={r.status} />
          <Facts
            rows={[
              ['Category', r.category],
              ['Face value', formatPeso(r.discountAmount)],
              ['Points to claim', `${formatPoints(r.pointsRequired)} pts${r.pointsRequired !== r.discountAmount ? ` (programme value ${formatPeso(r.pointsRequired)})` : ''}`],
              ['Stock', `${formatPoints(r.stockQuantity)} vouchers`],
              ['Terms', r.termsText ?? '—'],
              ...(r.submittedAt ? ([['Submitted', formatManilaDateTime(r.submittedAt)]] as [string, ReactNode][]) : []),
              ...(r.rejectReason ? ([['Reason given', r.rejectReason]] as [string, ReactNode][]) : []),
            ]}
          />
          <p className="text-xs text-text-2">{storeName} funds the discount each time the voucher is used there.</p>
          {d.mode === 'reject' && <RejectBox d={d} what="reward" />}
          {d.error && <InlineError>{d.error}</InlineError>}
        </div>
        <div>
          <p className="text-xs font-bold text-text-2">Customer preview</p>
          <div className="mt-2" inert>
            <RewardTile title={r.title} sponsor={storeName} category={r.category} pointsRequired={r.pointsRequired} balance={r.pointsRequired} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
