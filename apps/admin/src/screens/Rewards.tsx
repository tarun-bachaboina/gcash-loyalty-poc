import { anyStoreLabel, apiData, apiRequest, ApiRequestError, manilaDate, rewardTerms, type CreateRewardRequest, type Merchant, type Reward } from '@gcash/shared';
import { Button, CATEGORY_ICON, Dialog, EmptyState, ErrorState, formatPeso, formatPoints, InlineError, RewardPill, RewardTile, Skeleton, Tabs, useAsync } from '@gcash/ui';
import { CircleCheck, Gift, Loader2, Pause, Play, Plus } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Shell, table } from '../app/Shell';

type Filter = 'ALL' | 'ACTIVE' | 'PENDING' | 'PAUSED' | 'CLOSED';
const inFilter = (f: Filter, r: Reward, today: string) =>
  f === 'ALL' ||
  (f === 'ACTIVE' && r.status === 'ACTIVE' && r.validUntil >= today) ||
  (f === 'PENDING' && r.status === 'PENDING') ||
  (f === 'PAUSED' && r.status === 'PAUSED') ||
  (f === 'CLOSED' && (r.status === 'REJECTED' || r.status === 'WITHDRAWN' || (r.status === 'ACTIVE' && r.validUntil < today)));

interface Form {
  title: string;
  pointsRequired: string;
  discountAmount: string;
  validUntil: string;
  stockQuantity: string;
  minSpend: string;
  maxBillPercent: string;
}
const EMPTY: Form = { title: '', pointsRequired: '', discountAmount: '', validUntil: '', stockQuantity: '', minSpend: '', maxBillPercent: '' };

function validate(f: Form, today: string) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.title.trim()) e.title = 'Give the reward a title shoppers will recognize.';
  if (!/^\d+$/.test(f.pointsRequired) || Number(f.pointsRequired) < 1) e.pointsRequired = 'Whole number of points, 1 or more.';
  if (!/^\d+(\.\d{1,2})?$/.test(f.discountAmount) || Number(f.discountAmount) <= 0) e.discountAmount = 'Peso amount above 0, e.g. 100.00.';
  if (!f.validUntil) e.validUntil = 'Pick the last day it can be claimed.';
  else if (f.validUntil < today) e.validUntil = 'Choose today or a later date.';
  if (!/^\d+$/.test(f.stockQuantity) || Number(f.stockQuantity) < 1) e.stockQuantity = 'How many vouchers can be claimed (1 or more)?';
  if (f.minSpend && !/^\d+(\.\d{1,2})?$/.test(f.minSpend)) e.minSpend = 'A peso amount, or leave empty for no minimum.';
  if (f.maxBillPercent && !(Number(f.maxBillPercent) >= 1 && Number(f.maxBillPercent) <= 100)) e.maxBillPercent = 'A whole % from 1 to 100.';
  return e;
}

/**
 * A-3 Mall Rewards (v2): every reward in the programme. Store rewards are created by merchants and approved in
 * Approvals; the mall creates only common rewards (Retail, redeemable at any retail store).
 */
export default function Rewards() {
  const q = useAsync(() => apiData<Reward[]>('/admin/rewards'), []);
  const merchants = useAsync(() => apiData<Merchant[]>('/merchant/list'), []);
  const storeName = (id?: string) => (id ? (merchants.data?.find((m) => m.merchantId === id)?.name ?? id) : undefined);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string>();
  const [published, setPublished] = useState<Reward>();
  const [toggling, setToggling] = useState<string>();
  const [rowError, setRowError] = useState<string>();

  const today = manilaDate(new Date().toISOString());
  const errors = validate(form, today);
  const show = (k: keyof Form) => (touched ? errors[k] : undefined);
  const anyRetail = anyStoreLabel('Retail', merchants.data ?? []);

  function openCreate() {
    setForm(EMPTY);
    setTouched(false);
    setError(undefined);
    setOpen(true);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    setPublishing(true);
    setError(undefined);
    const body: CreateRewardRequest = {
      title: form.title.trim(),
      category: 'Retail',
      pointsRequired: Number(form.pointsRequired),
      discountAmount: Number(form.discountAmount),
      validUntil: form.validUntil,
      stockQuantity: Number(form.stockQuantity),
      ...(form.minSpend ? { minSpend: Number(form.minSpend) } : {}),
      ...(form.maxBillPercent ? { maxBillPercent: Number(form.maxBillPercent) } : {}),
    };
    try {
      const { data } = await apiRequest<{ data: Reward }>('/admin/rewards', { body });
      await q.reload();
      setPublished(data);
      setFilter('ALL');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not publish this reward. Try again.');
    } finally {
      setPublishing(false);
    }
  }

  async function toggle(r: Reward) {
    setToggling(r.rewardId);
    setRowError(undefined);
    try {
      await apiRequest(`/admin/rewards/${encodeURIComponent(r.rewardId)}`, { method: 'PATCH', body: { status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } });
      await q.reload();
    } catch (err) {
      setRowError(err instanceof ApiRequestError ? err.message : 'Could not update the reward status.');
    } finally {
      setToggling(undefined);
    }
  }

  const rewards = q.data ?? [];
  const count = (f: Filter) => rewards.filter((r) => inFilter(f, r, today)).length;
  const shown = rewards.filter((r) => inFilter(filter, r, today));

  return (
    <Shell
      title="Mall Rewards"
      description="Every voucher shoppers can claim with points. Stores create their own rewards (you approve them in Approvals); the mall creates common rewards redeemable at any retail store."
      actions={
        <Button onClick={openCreate} icon={<Plus className="size-4" aria-hidden />}>
          Create common reward
        </Button>
      }
    >
      {published && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-card bg-success-100 px-4 py-3 text-sm font-semibold text-success-700">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          {published.title} is published. Shoppers can claim it in the catalog now.
        </p>
      )}
      {rowError && (
        <div className="mb-4">
          <InlineError>{rowError}</InlineError>
        </div>
      )}

      {q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={() => void q.reload()} />
      ) : !q.data ? (
        <Skeleton className="h-72 rounded-card" />
      ) : rewards.length === 0 ? (
        <EmptyState icon={Gift} title="No rewards yet" body="Stores submit their rewards for approval. You can also create a common reward redeemable at any retail store." action={<Button onClick={openCreate}>Create common reward</Button>} />
      ) : (
        <>
          <Tabs
            className="mb-4 w-fit max-w-full"
            label="Reward status"
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: 'ALL' as const, label: 'All', count: rewards.length },
              { id: 'ACTIVE' as const, label: 'Active', count: count('ACTIVE') },
              { id: 'PENDING' as const, label: 'Pending approval', count: count('PENDING') },
              { id: 'PAUSED' as const, label: 'Paused', count: count('PAUSED') },
              { id: 'CLOSED' as const, label: 'Rejected, withdrawn & expired', count: count('CLOSED') },
            ]}
          />
          {shown.length === 0 ? (
            <p className="rounded-card bg-surface-1 px-5 py-8 text-center text-sm text-text-2 ring-1 ring-line">No rewards in this state.</p>
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[1040px]`}>
                <thead className={table.thead}>
                  <tr>
                    <th scope="col" className={table.th}>Reward Name</th>
                    <th scope="col" className={table.th}>Redeemable At</th>
                    <th scope="col" className={table.th}>Created By</th>
                    <th scope="col" className={`${table.th} text-right`}>Points Cost</th>
                    <th scope="col" className={`${table.th} text-right`}>Face Value (₱)</th>
                    <th scope="col" className={`${table.th} text-right`}>Stock Quantity</th>
                    <th scope="col" className={table.th}>Status</th>
                    <th scope="col" className={table.th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const Icon = CATEGORY_ICON[r.category];
                    const expired = r.status === 'ACTIVE' && r.validUntil < today;
                    const approved = r.status === 'ACTIVE' || r.status === 'PAUSED';
                    return (
                      <tr key={r.rewardId} className={`${table.row} ${published?.rewardId === r.rewardId ? 'bg-success-100/40' : ''}`}>
                        <th scope="row" className={`${table.td} font-semibold`}>
                          <span className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-brand-soft">
                              <Icon className="size-5 text-brand" aria-hidden />
                            </span>
                            <span>
                              {r.title}
                              <span className="block text-xs font-normal text-text-2">
                                <span className="font-mono">{r.rewardId}</span> · {r.termsText?.split(' · ').slice(1).join(' · ')}
                              </span>
                            </span>
                          </span>
                        </th>
                        <td className={table.td}>
                          {r.merchantId ? (
                            storeName(r.merchantId)
                          ) : (
                            <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-brand">Any retail store</span>
                          )}
                        </td>
                        <td className={`${table.td} text-text-2`}>{r.createdBy === 'ADMIN' ? 'Mall (common)' : 'Store'}</td>
                        <td className={`${table.num} font-semibold`}>{formatPoints(r.pointsRequired)}</td>
                        <td className={table.num}>{formatPeso(r.discountAmount)}</td>
                        <td className={`${table.num} ${r.stockQuantity === 0 ? 'font-bold text-danger-700' : ''}`}>{formatPoints(r.stockQuantity)}</td>
                        <td className={table.td}>
                          <RewardPill status={expired ? 'EXPIRED' : r.status} />
                        </td>
                        <td className={`${table.td} text-right`}>
                          {approved ? (
                            <Button
                              variant="secondary"
                              onClick={() => void toggle(r)}
                              disabled={toggling === r.rewardId}
                              aria-label={`${r.status === 'ACTIVE' ? 'Pause' : 'Activate'} ${r.title}`}
                              icon={toggling === r.rewardId ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : r.status === 'ACTIVE' ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                            >
                              {r.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            </Button>
                          ) : r.status === 'PENDING' ? (
                            <Link to="/approvals?tab=rewards" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-brand hover:bg-brand-soft">
                              Review
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} busy={publishing} size="lg" title="Create common reward" description={`A Retail voucher redeemable at ${anyRetail}. Whichever store accepts it funds the discount.`}>
        <form onSubmit={publish} noValidate className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="flex flex-col gap-4">
            <F label="Reward Title" id="r-title" error={show('title')}>
              <input id="r-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ayala Malls ₱250 Retail Gift Voucher" className={inputCls(!!show('title'))} aria-invalid={!!show('title')} />
            </F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Face Value Discount (₱)" id="r-val" error={show('discountAmount')}>
                <input
                  id="r-val"
                  inputMode="decimal"
                  value={form.discountAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '');
                    // Programme value is 1 pt = ₱1, so points follow the face value until edited
                    setForm((f) => ({ ...f, discountAmount: v, pointsRequired: f.pointsRequired && f.pointsRequired !== String(Math.round(Number(f.discountAmount) || 0)) ? f.pointsRequired : String(Math.round(Number(v) || 0) || '') }));
                  }}
                  placeholder="250.00"
                  className={inputCls(!!show('discountAmount'))}
                  aria-invalid={!!show('discountAmount')}
                />
              </F>
              <F label="Points Cost" id="r-pts" error={show('pointsRequired')} hint="Programme value: 1 pt = ₱1.">
                <input id="r-pts" inputMode="numeric" value={form.pointsRequired} onChange={(e) => setForm({ ...form, pointsRequired: e.target.value.replace(/\D/g, '') })} placeholder="250" className={inputCls(!!show('pointsRequired'))} aria-invalid={!!show('pointsRequired')} />
              </F>
              <F label="Valid Through Date" id="r-date" error={show('validUntil')}>
                <input id="r-date" type="date" min={today} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={inputCls(!!show('validUntil'))} aria-invalid={!!show('validUntil')} />
              </F>
              <F label="Stock Quantity" id="r-stock" error={show('stockQuantity')}>
                <input id="r-stock" inputMode="numeric" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value.replace(/\D/g, '') })} placeholder="500" className={inputCls(!!show('stockQuantity'))} aria-invalid={!!show('stockQuantity')} />
              </F>
            </div>
            <fieldset className="rounded-card bg-surface-2 p-4">
              <legend className="float-left mb-2 w-full text-sm font-bold">Terms (optional)</legend>
              <div className="clear-both grid gap-4 sm:grid-cols-2">
                <F label="Minimum Order (₱)" id="r-min" error={show('minSpend')} hint="Bill before vouchers.">
                  <input id="r-min" inputMode="decimal" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value.replace(/[^\d.]/g, '') })} placeholder="No minimum" className={inputCls(!!show('minSpend'))} />
                </F>
                <F label="Max Share of the Bill (%)" id="r-max" error={show('maxBillPercent')} hint="Any value above it is forfeited.">
                  <input id="r-max" inputMode="numeric" value={form.maxBillPercent} onChange={(e) => setForm({ ...form, maxBillPercent: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="100" className={inputCls(!!show('maxBillPercent'))} />
                </F>
              </div>
              <p className="mt-3 text-xs text-text-2">
                {rewardTerms({ category: 'Retail', minSpend: Number(form.minSpend) || undefined, maxBillPercent: Number(form.maxBillPercent) || undefined, validUntil: form.validUntil || '—' }, merchants.data ?? [])}
              </p>
            </fieldset>
            {error && <InlineError>{error}</InlineError>}
            <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row-reverse">
              <Button type="submit" size="lg" disabled={publishing} icon={publishing ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : undefined}>
                {publishing ? 'Publishing…' : 'Publish Reward to Catalog'}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={publishing}>
                Cancel
              </Button>
            </div>
          </div>

          <div aria-label="Customer preview" className="hidden md:block">
            <p className="text-xs font-bold text-text-2">Customer preview</p>
            <div className="mt-2 rounded-card bg-surface-0 p-3 ring-1 ring-line" inert>
              <RewardTile title={form.title.trim() || 'Your reward title'} sponsor="Any retail store" category="Retail" pointsRequired={Number(form.pointsRequired) || 0} balance={Number(form.pointsRequired) || 0} />
            </div>
            <p className="mt-2 text-xs text-text-2">Shown as a shopper with enough points sees it.</p>
          </div>
        </form>
      </Dialog>
    </Shell>
  );
}

const inputCls = (error: boolean) =>
  `min-h-11 w-full rounded-chip bg-surface-1 px-3 ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${error ? 'ring-danger-500' : 'ring-line'}`;

function F({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs font-semibold text-danger-700">{error}</p>}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-text-2">
          {hint}
        </p>
      )}
    </div>
  );
}
