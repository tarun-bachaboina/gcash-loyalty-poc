import { apiData, apiRequest, ApiRequestError, manilaDate, rewardTerms, storesForCategory, type Merchant, type MerchantRewardRequest, type Reward, type RewardCategory } from '@gcash/shared';
import { Button, CATEGORY_ICON, Dialog, EmptyState, ErrorState, formatPeso, formatPoints, InlineError, RewardTile, Select, Skeleton, useAsync } from '@gcash/ui';
import { CircleCheck, Copy, Gift, Plus, Undo2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Shell } from '../app/Shell';
import { useManager } from '../app/session';
import { Field, inputClass, PageHeader, RewardPill } from '../app/ui';
import { shiftDate } from './CampaignForm';

const CATEGORIES: RewardCategory[] = ['Retail', 'Entertainment', 'Parking', 'Food & Dining'];

/**
 * Merchant portal: Rewards (v2 decision: merchants create their own rewards; the mall approves them).
 * Feeling: "my voucher sits on the mall's reward shelf and brings members back to my store."
 */
export default function Rewards() {
  const { manager, merchant, merchants } = useManager();
  const merchantId = manager?.merchantId ?? '';
  const q = useAsync(() => apiData<Reward[]>(`/merchant/rewards?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const [form, setForm] = useState<{ key: number; from?: Reward } | null>(null);
  const [notice, setNotice] = useState<string>();
  const [withdraw, setWithdraw] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const today = manilaDate(new Date().toISOString());

  async function doWithdraw() {
    if (!withdraw) return;
    setBusy(true);
    setActionError(undefined);
    try {
      await apiRequest(`/merchant/rewards/${withdraw.rewardId}/withdraw`, { method: 'POST' });
      setNotice(`${withdraw.title} was withdrawn.`);
      setWithdraw(null);
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
        title="Rewards"
        sub="Vouchers members can claim with points and use at your store. Your store funds the discount when a voucher is used here."
        action={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({ key: Date.now() })} disabled={!merchant}>
            New reward
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
        <div className="grid gap-3 md:grid-cols-2" aria-busy aria-label="Loading rewards">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-hero" />
          ))}
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState icon={Gift} title="No rewards for your store yet" body="Offer a voucher like “₱200 off on ₱1,000+” to give members a reason to come back." action={<Button onClick={() => setForm({ key: Date.now() })}>Create your first reward</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {q.data.map((r) => {
            const Icon = CATEGORY_ICON[r.category];
            const expired = r.status === 'ACTIVE' && r.validUntil < today;
            return (
              <li key={r.rewardId}>
                <article className={`flex h-full flex-col rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line ${r.status === 'WITHDRAWN' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base leading-tight font-bold">{r.title}</h2>
                        <RewardPill status={expired ? 'EXPIRED' : r.status} />
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-text-2">{r.rewardId}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-text-2">Discount</dt>
                      <dd className="font-bold tabular-nums">{formatPeso(r.discountAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-2">Points</dt>
                      <dd className="font-bold tabular-nums">{formatPoints(r.pointsRequired)} pts</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-2">Stock left</dt>
                      <dd className="font-bold tabular-nums">{formatPoints(r.stockQuantity)}</dd>
                    </div>
                  </dl>
                  {r.termsText && <p className="mt-3 text-xs text-text-2">{r.termsText}</p>}
                  {r.status === 'REJECTED' && r.rejectReason && (
                    <p className="mt-3 rounded-chip bg-danger-100 px-3 py-2 text-sm text-danger-700">
                      <span className="font-bold">Mall team’s reason:</span> {r.rejectReason}
                    </p>
                  )}
                  {r.status === 'PENDING' && <p className="mt-3 text-xs text-text-2">Waiting for the mall team. It reaches the customer catalogue once approved.</p>}
                  {(r.status === 'PENDING' || r.status === 'REJECTED' || r.status === 'WITHDRAWN') && (
                    <div className="mt-auto flex gap-2 pt-4">
                      {r.status === 'PENDING' ? (
                        <Button variant="secondary" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => setWithdraw(r)}>
                          Withdraw
                        </Button>
                      ) : (
                        <Button variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => setForm({ key: Date.now(), from: r })}>
                          Duplicate & edit
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {form && merchant && (
        <RewardForm
          key={form.key}
          merchant={merchant}
          merchants={merchants ?? []}
          from={form.from}
          onClose={() => setForm(null)}
          onSubmitted={(r) => {
            setForm(null);
            setNotice(`${r.title} submitted. The mall team usually reviews within 1 business day.`);
            void q.reload();
          }}
        />
      )}

      <Dialog
        open={!!withdraw}
        onClose={() => {
          setWithdraw(null);
          setActionError(undefined);
        }}
        busy={busy}
        title={`Withdraw ${withdraw?.title ?? ''}?`}
        description="The mall team will no longer review it. You can duplicate it later to resubmit."
        footer={
          <>
            <Button onClick={doWithdraw} disabled={busy}>
              {busy ? 'Working…' : 'Withdraw reward'}
            </Button>
            <Button variant="secondary" onClick={() => setWithdraw(null)} disabled={busy}>
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

function RewardForm({ merchant, merchants, from, onClose, onSubmitted }: { merchant: Merchant; merchants: Merchant[]; from?: Reward; onClose: () => void; onSubmitted: (r: Reward) => void }) {
  const allowed = CATEGORIES.filter((c) => storesForCategory(c, [merchant]).length);
  const today = manilaDate(new Date().toISOString());
  const [f, setF] = useState({
    title: from?.title ?? '',
    category: from && allowed.includes(from.category) ? from.category : allowed[0],
    discountAmount: from ? String(from.discountAmount) : '',
    pointsRequired: from ? String(from.pointsRequired) : '',
    stockQuantity: from ? String(from.stockQuantity) : '100',
    validUntil: from && from.validUntil >= today ? from.validUntil : shiftDate(today, 90),
    minSpend: from?.minSpend ? String(from.minSpend) : '',
    maxBillPercent: from?.maxBillPercent ? String(from.maxBillPercent) : '',
  });
  const [pointsTouched, setPointsTouched] = useState(!!from);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  type F = typeof f;
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((s) => ({ ...s, [k]: v }));
  const digits = (v: string) => v.replace(/[^\d.]/g, '');

  const preview = {
    merchantId: merchant.merchantId,
    category: f.category,
    minSpend: Number(f.minSpend) || undefined,
    maxBillPercent: Number(f.maxBillPercent) || undefined,
    validUntil: f.validUntil,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body: MerchantRewardRequest = {
      merchantId: merchant.merchantId,
      title: f.title,
      category: f.category,
      discountAmount: Number(f.discountAmount),
      pointsRequired: Number(f.pointsRequired),
      stockQuantity: Number(f.stockQuantity),
      validUntil: f.validUntil,
      ...(f.minSpend ? { minSpend: Number(f.minSpend) } : {}),
      ...(f.maxBillPercent ? { maxBillPercent: Number(f.maxBillPercent) } : {}),
    };
    setBusy(true);
    try {
      const { data } = await apiRequest<{ data: Reward }>('/merchant/rewards', { body });
      onSubmitted(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit the reward. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={from ? 'Duplicate & edit reward' : 'New reward'}
      description={`Redeemable only at ${merchant.name}. The mall team approves it before members can claim it.`}
      footer={
        <>
          <Button type="submit" form="reward-form" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
        <form id="reward-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field id="r-title" label="Reward title">
            <input id="r-title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={`${merchant.name} ₱200 Off Voucher`} className={inputClass()} maxLength={60} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-cat" label="Category" hint={allowed.length === 1 ? 'Set by your store type.' : undefined}>
              <Select id="r-cat" value={f.category} onChange={(e) => set('category', e.target.value as RewardCategory)} disabled={allowed.length === 1}>
                {allowed.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field id="r-stock" label="Stock (vouchers)">
              <input id="r-stock" inputMode="numeric" value={f.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value.replace(/\D/g, ''))} className={inputClass()} />
            </Field>
            <Field id="r-value" label="Discount value (₱)">
              <input
                id="r-value"
                inputMode="decimal"
                value={f.discountAmount}
                onChange={(e) => {
                  const v = digits(e.target.value);
                  setF((s) => ({ ...s, discountAmount: v, pointsRequired: pointsTouched ? s.pointsRequired : String(Math.round(Number(v) || 0) || '') }));
                }}
                placeholder="200"
                className={inputClass()}
              />
            </Field>
            <Field id="r-points" label="Points to claim" hint="Programme value: 1 pt = ₱1.">
              <input
                id="r-points"
                inputMode="numeric"
                value={f.pointsRequired}
                onChange={(e) => {
                  setPointsTouched(true);
                  set('pointsRequired', e.target.value.replace(/\D/g, ''));
                }}
                placeholder="200"
                className={inputClass()}
              />
            </Field>
            <Field id="r-until" label="Valid until">
              <input id="r-until" type="date" min={today} value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={inputClass()} />
            </Field>
          </div>

          <fieldset className="rounded-chip bg-surface-2 p-4">
            <legend className="float-left mb-2 w-full text-sm font-bold">Terms (optional)</legend>
            <div className="clear-both grid gap-4 sm:grid-cols-2">
              <Field id="r-min" label="Minimum order (₱)" hint="Bill before vouchers.">
                <input id="r-min" inputMode="decimal" value={f.minSpend} onChange={(e) => set('minSpend', digits(e.target.value))} placeholder="No minimum" className={inputClass()} />
              </Field>
              <Field id="r-max" label="Max share of the bill (%)" hint="Any value above it is forfeited.">
                <input id="r-max" inputMode="numeric" value={f.maxBillPercent} onChange={(e) => set('maxBillPercent', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="100" className={inputClass()} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-text-2">{rewardTerms(preview, merchants)}</p>
          </fieldset>

          {error && <InlineError>{error}</InlineError>}
        </form>

        <div>
          <p className="text-xs font-bold mb-2 text-text-2">Members will see</p>
          <div inert>
            <RewardTile title={f.title.trim() || 'Your reward'} sponsor={merchant.name} category={f.category} pointsRequired={Number(f.pointsRequired) || 0} balance={Number(f.pointsRequired) || 0} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
