import { apiData, apiRequest, ApiRequestError, type CampaignView } from '@gcash/shared';
import { Button, Dialog, EmptyState, ErrorState, formatManilaDateTime, formatPeso, formatPoints, InlineError, ProgressBar, Skeleton, Tabs, useAsync } from '@gcash/ui';
import { CircleCheck, Copy, Megaphone, Plus, Square, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Shell } from '../app/Shell';
import { useManager } from '../app/session';
import { CampaignPill, PageHeader, shortDate } from '../app/ui';
import { CampaignForm } from './CampaignForm';

type Filter = 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ENDED';
const matches = (f: Filter, c: CampaignView) =>
  f === 'ALL' ||
  (f === 'PENDING' && c.displayStatus === 'PENDING') ||
  (f === 'ACTIVE' && (c.displayStatus === 'LIVE' || c.displayStatus === 'SCHEDULED')) ||
  (f === 'REJECTED' && c.displayStatus === 'REJECTED') ||
  (f === 'ENDED' && (c.displayStatus === 'ENDED' || c.displayStatus === 'WITHDRAWN'));

/**
 * Merchant portal: Campaigns (v2 plan §2.1). Everyday UI.
 * Feeling: "I can launch a promo in a minute and always know where it stands with the mall."
 */
export default function Campaigns() {
  const { manager, merchant } = useManager();
  const merchantId = manager?.merchantId ?? '';
  const q = useAsync(() => apiData<CampaignView[]>(`/merchant/campaigns?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [form, setForm] = useState<{ key: number; from?: CampaignView } | null>(null);
  const [notice, setNotice] = useState<string>();
  const [confirm, setConfirm] = useState<{ c: CampaignView; action: 'withdraw' | 'end' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const list = q.data ?? [];
  const count = (f: Filter) => list.filter((c) => matches(f, c)).length;
  const tabs = [
    { id: 'ALL' as const, label: 'All', count: list.length },
    { id: 'PENDING' as const, label: 'Pending', count: count('PENDING') },
    { id: 'ACTIVE' as const, label: 'Live & scheduled', count: count('ACTIVE') },
    { id: 'REJECTED' as const, label: 'Rejected', count: count('REJECTED') },
    { id: 'ENDED' as const, label: 'Ended', count: count('ENDED') },
  ];
  const shown = list.filter((c) => matches(filter, c));

  async function act() {
    if (!confirm) return;
    setBusy(true);
    setActionError(undefined);
    try {
      await apiRequest(`/merchant/campaigns/${confirm.c.campaignId}/${confirm.action}`, { method: 'POST' });
      setNotice(confirm.action === 'withdraw' ? `${confirm.c.name} was withdrawn.` : `${confirm.c.name} has ended. Bills from now on earn base points only.`);
      setConfirm(null);
      await q.reload();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Campaigns"
        sub="Give members extra points at your store. The mall team approves each campaign before it goes live."
        action={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({ key: Date.now() })}>
            New campaign
          </Button>
        }
      />

      {notice && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-chip bg-success-100 px-4 py-3 text-sm font-semibold text-success-700">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={() => void q.reload()} />
      ) : !q.data ? (
        <div className="space-y-3" aria-busy aria-label="Loading campaigns">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-hero" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" body="Try “2× points on bills ₱5,000+” to lift your average bill on a slow week." action={<Button onClick={() => setForm({ key: Date.now() })}>Create your first campaign</Button>} />
      ) : (
        <>
          <Tabs tabs={tabs} value={filter} onChange={setFilter} label="Campaign status" className="mb-4 w-fit max-w-full" />
          {shown.length === 0 ? (
            <p className="rounded-hero bg-surface-1 px-5 py-8 text-center text-sm text-text-2 ring-1 ring-line">Nothing here right now.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((c) => (
                <li key={c.campaignId}>
                  <CampaignCard
                    c={c}
                    onWithdraw={() => setConfirm({ c, action: 'withdraw' })}
                    onEnd={() => setConfirm({ c, action: 'end' })}
                    onDuplicate={() => setForm({ key: Date.now(), from: c })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {form && (
        <CampaignForm
          key={form.key}
          open
          from={form.from}
          merchantId={merchantId}
          merchantName={merchant?.name ?? 'your store'}
          onClose={() => setForm(null)}
          onSubmitted={(c) => {
            setForm(null);
            setFilter('ALL');
            setNotice(`${c.name} submitted. The mall team usually reviews within 1 business day.`);
            void q.reload();
          }}
        />
      )}

      <Dialog
        open={!!confirm}
        onClose={() => {
          setConfirm(null);
          setActionError(undefined);
        }}
        busy={busy}
        title={confirm?.action === 'withdraw' ? `Withdraw ${confirm.c.name}?` : `End ${confirm?.c.name ?? ''} now?`}
        description={
          confirm?.action === 'withdraw'
            ? 'The mall team will no longer review it. You can duplicate it later to resubmit.'
            : 'Bills from now on earn base points only. Points already given stay with your members.'
        }
        footer={
          <>
            <Button onClick={act} disabled={busy}>
              {busy ? 'Working…' : confirm?.action === 'withdraw' ? 'Withdraw campaign' : 'End campaign'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
              Keep it
            </Button>
          </>
        }
      >
        {actionError && <InlineError>{actionError}</InlineError>}
      </Dialog>
    </Shell>
  );
}

function CampaignCard({ c, onWithdraw, onEnd, onDuplicate }: { c: CampaignView; onWithdraw: () => void; onEnd: () => void; onDuplicate: () => void }) {
  const steps = timeline(c);
  const ran = c.displayStatus === 'LIVE' || c.displayStatus === 'ENDED' || (c.stats?.bills ?? 0) > 0;
  return (
    <article className={`rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line ${c.displayStatus === 'WITHDRAWN' ? 'opacity-75' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg leading-tight font-bold">{c.name}</h2>
            <CampaignPill status={c.displayStatus} />
          </div>
          <p className="mt-1 text-sm font-semibold text-promo-700">{c.mechanics}</p>
          <p className="mt-0.5 text-xs text-text-2">
            {shortDate(c.startDate)} – {shortDate(c.endDate)} · <span className="font-mono">{c.campaignId}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.displayStatus === 'PENDING' && (
            <Button variant="secondary" icon={<Undo2 className="size-4" aria-hidden />} onClick={onWithdraw}>
              Withdraw
            </Button>
          )}
          {(c.displayStatus === 'LIVE' || c.displayStatus === 'SCHEDULED') && (
            <Button variant="secondary" icon={<Square className="size-4" aria-hidden />} onClick={onEnd}>
              {c.displayStatus === 'LIVE' ? 'End early' : 'Cancel campaign'}
            </Button>
          )}
          {(c.displayStatus === 'REJECTED' || c.displayStatus === 'ENDED' || c.displayStatus === 'WITHDRAWN') && (
            <Button variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={onDuplicate}>
              Duplicate & edit
            </Button>
          )}
        </div>
      </div>

      {c.displayStatus === 'REJECTED' && c.rejectReason && (
        <p className="mt-3 rounded-chip bg-danger-100 px-3 py-2 text-sm text-danger-700">
          <span className="font-bold">Mall team’s reason:</span> {c.rejectReason}
        </p>
      )}

      {ran && (
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-chip bg-surface-2 px-4 py-3 text-sm">
          <div>
            <dt className="text-xs text-text-2">Bills boosted</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{formatPoints(c.stats?.bills ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-2">Revenue on them</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{formatPeso(c.stats?.revenue ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-2">Bonus points given</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{formatPoints(c.bonusPointsIssued)}</dd>
          </div>
        </dl>
      )}

      {c.budgetPoints !== undefined && (
        <div className="mt-3 text-xs text-text-2">
          <div className="mb-1 flex justify-between">
            <span>Bonus budget</span>
            <span className="tabular-nums">
              {formatPoints(c.bonusPointsIssued)} / {formatPoints(c.budgetPoints)} pts
            </span>
          </div>
          <ProgressBar value={c.bonusPointsIssued} max={c.budgetPoints} />
        </div>
      )}

      <ol className="mt-4 flex flex-wrap gap-x-1 gap-y-2 text-xs" aria-label="Timeline">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1">
            {i > 0 && <span className={`h-px w-4 ${s.done ? 'bg-text-2' : 'bg-line'}`} aria-hidden />}
            <span className={`size-2 rounded-full ${s.bad ? 'bg-danger-500' : s.done ? 'bg-success-600' : 'bg-line'}`} aria-hidden />
            <span className={s.done ? 'font-semibold text-text-1' : 'text-text-2'}>
              {s.label}
              {s.when && <span className="font-normal text-text-2"> · {s.when}</span>}
            </span>
          </li>
        ))}
      </ol>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Terms & conditions</summary>
        <p className="whitespace-pre-line text-text-2">{c.terms}</p>
      </details>
    </article>
  );
}

function timeline(c: CampaignView) {
  const at = (iso?: string) => (iso ? formatManilaDateTime(iso).slice(0, 10) : undefined);
  const steps: { label: string; when?: string; done: boolean; bad?: boolean }[] = [{ label: 'Submitted', when: at(c.submittedAt), done: true }];
  if (c.status === 'REJECTED') return [...steps, { label: 'Rejected', when: at(c.decidedAt), done: true, bad: true }];
  if (c.status === 'WITHDRAWN') return [...steps, { label: 'Withdrawn', when: at(c.decidedAt), done: true, bad: true }];
  const decided = c.status !== 'PENDING';
  const live = c.displayStatus === 'LIVE' || c.displayStatus === 'ENDED';
  const ended = c.displayStatus === 'ENDED';
  const endedWhy = c.endedReason === 'BUDGET' ? 'budget used' : c.endedReason === 'ADMIN' ? 'by the mall' : c.endedReason === 'MERCHANT' ? 'early' : undefined;
  return [
    ...steps,
    { label: decided ? 'Approved' : 'Mall review', when: at(c.decidedAt), done: decided },
    { label: 'Live', when: shortDate(c.startDate), done: live },
    { label: endedWhy ? `Ended ${endedWhy}` : 'Ends', when: c.endedAt ? at(c.endedAt) : shortDate(c.endDate), done: ended },
  ];
}
