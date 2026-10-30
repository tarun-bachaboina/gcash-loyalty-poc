import { apiData, apiRequest, ApiRequestError, CAMPAIGN_MULTIPLIERS, describeCampaign, manilaDate, type CampaignType, type CampaignView, type CreateCampaignRequest, type Product } from '@gcash/shared';
import { Button, Dialog, InlineError, Select, useAsync } from '@gcash/ui';
import { Gift, Layers, Receipt } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Field, inputClass } from '../app/ui';

const TYPES: { id: CampaignType; label: string; example: string; icon: typeof Receipt }[] = [
  { id: 'BILL_MULTIPLIER', label: 'Big bills earn more', example: '2× points on bills ₱5,000+', icon: Receipt },
  { id: 'PRODUCT_MULTIPLIER', label: 'Products earn more', example: '1.5× points on linen shirts', icon: Layers },
  { id: 'FLAT_BONUS', label: 'Flat bonus', example: '+100 pts on bills ₱3,000+', icon: Gift },
];

export function shiftDate(yyyyMmDd: string, days: number) {
  const t = new Date(`${yyyyMmDd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

interface FormState {
  name: string;
  type: CampaignType;
  multiplier: string;
  minSpend: string;
  target: string; // "tag:linen-shirt" | "cat:Menswear"
  flatBonus: string;
  startDate: string;
  endDate: string;
  budgetPoints: string;
  terms: string;
}

function initial(from?: CampaignView): FormState {
  const today = manilaDate(new Date().toISOString());
  return {
    name: from?.name ?? '',
    type: from?.type ?? 'BILL_MULTIPLIER',
    multiplier: String(from?.multiplier ?? 2),
    minSpend: from?.minSpend ? String(from.minSpend) : '',
    target: from?.productTag ? `tag:${from.productTag}` : from?.productCategory ? `cat:${from.productCategory}` : '',
    flatBonus: from?.flatBonus ? String(from.flatBonus) : '',
    // A duplicate keeps its dates only if they're still ahead
    startDate: from && from.startDate >= today ? from.startDate : today,
    endDate: from && from.endDate >= today && from.startDate >= today ? from.endDate : shiftDate(today, 30),
    budgetPoints: from?.budgetPoints ? String(from.budgetPoints) : '',
    terms: from?.terms ?? '',
  };
}

const prettyTag = (t: string) => t.replace(/-/g, ' ');

/** Create (or duplicate & edit) a campaign. Everyday UI: a form with a live plain-language preview. */
export function CampaignForm({ open, onClose, merchantId, merchantName, from, onSubmitted }: { open: boolean; onClose: () => void; merchantId: string; merchantName: string; from?: CampaignView; onSubmitted: (c: CampaignView) => void }) {
  const [f, setF] = useState<FormState>(() => initial(from));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const products = useAsync(() => apiData<Product[]>(`/merchant/products?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const tags = [...new Set(products.data?.flatMap((p) => p.tags) ?? [])].sort();
  const categories = [...new Set(products.data?.map((p) => p.category) ?? [])].sort();
  const [targetKind, targetValue] = f.target.split(/:(.*)/s);
  const matching = products.data?.filter((p) => (targetKind === 'tag' ? p.tags.includes(targetValue) : p.category === targetValue)) ?? [];

  const draft = {
    type: f.type,
    multiplier: Number(f.multiplier),
    minSpend: Number(f.minSpend) || 0,
    productTag: targetKind === 'tag' ? targetValue : undefined,
    productCategory: targetKind === 'cat' ? targetValue : undefined,
    flatBonus: Number(f.flatBonus) || 0,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body: CreateCampaignRequest = {
      merchantId,
      name: f.name,
      type: f.type,
      startDate: f.startDate,
      endDate: f.endDate,
      terms: f.terms,
      ...(f.type !== 'FLAT_BONUS' ? { multiplier: draft.multiplier } : {}),
      ...(f.type !== 'PRODUCT_MULTIPLIER' ? { minSpend: Number(f.minSpend) } : {}),
      ...(f.type === 'PRODUCT_MULTIPLIER' ? { productTag: draft.productTag, productCategory: draft.productCategory } : {}),
      ...(f.type === 'FLAT_BONUS' ? { flatBonus: Number(f.flatBonus) } : {}),
      ...(f.budgetPoints ? { budgetPoints: Number(f.budgetPoints) } : {}),
    };
    setBusy(true);
    try {
      const { data: created } = await apiRequest<{ data: CampaignView }>('/merchant/campaigns', { body });
      onSubmitted(created);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit the campaign. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title={from ? 'Duplicate & edit campaign' : 'New campaign'}
      description="The mall team reviews every campaign before it goes live."
      footer={
        <>
          <Button type="submit" form="campaign-form" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field id="c-name" label="Campaign name">
          <input id="c-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Linen Season" className={inputClass()} maxLength={60} />
        </Field>

        <fieldset>
          <legend className="text-sm font-bold">Type</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => {
              const on = f.type === t.id;
              return (
                <label key={t.id} className={`flex cursor-pointer flex-col gap-1 rounded-chip p-3 ring-1 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${on ? 'bg-brand-soft ring-brand' : 'bg-surface-1 ring-line hover:bg-surface-2'}`}>
                  <input type="radio" name="type" value={t.id} checked={on} onChange={() => set('type', t.id)} className="sr-only" />
                  <t.icon className={`size-5 ${on ? 'text-brand' : 'text-text-2'}`} aria-hidden />
                  <span className="text-sm font-bold">{t.label}</span>
                  <span className="text-xs text-text-2">{t.example}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {f.type !== 'FLAT_BONUS' && (
            <fieldset>
              <legend className="text-sm font-bold">Multiplier</legend>
              <div className="mt-1.5 flex gap-1 rounded-full bg-surface-2 p-1">
                {CAMPAIGN_MULTIPLIERS.map((m) => (
                  <label key={m} className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full text-sm font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${String(m) === f.multiplier ? 'bg-surface-1 text-brand shadow-e1' : 'text-text-2'}`}>
                    <input type="radio" name="multiplier" value={m} checked={String(m) === f.multiplier} onChange={() => set('multiplier', String(m))} className="sr-only" />
                    {m}×
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {f.type !== 'PRODUCT_MULTIPLIER' && (
            <Field id="c-min" label="Minimum bill (₱)" hint="Checked against the amount paid, after vouchers.">
              <input id="c-min" inputMode="decimal" value={f.minSpend} onChange={(e) => set('minSpend', e.target.value.replace(/[^\d.]/g, ''))} placeholder="5000" className={inputClass()} />
            </Field>
          )}
          {f.type === 'PRODUCT_MULTIPLIER' && (
            <Field id="c-target" label="Products" hint={targetValue ? `${matching.length} item${matching.length === 1 ? '' : 's'} in your catalogue: ${matching.slice(0, 3).map((p) => p.name).join(', ')}${matching.length > 3 ? '…' : ''}` : 'Pick a product line or a whole category.'}>
              <Select id="c-target" value={f.target} onChange={(e) => set('target', e.target.value)} disabled={!products.data}>
                <option value="" disabled>
                  {products.data ? 'Choose products…' : 'Loading catalogue…'}
                </option>
                <optgroup label="Product lines">
                  {tags.map((t) => (
                    <option key={t} value={`tag:${t}`}>
                      {prettyTag(t)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Whole categories">
                  {categories.map((c) => (
                    <option key={c} value={`cat:${c}`}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
          )}
          {f.type === 'FLAT_BONUS' && (
            <Field id="c-bonus" label="Bonus points per bill">
              <input id="c-bonus" inputMode="numeric" value={f.flatBonus} onChange={(e) => set('flatBonus', e.target.value.replace(/\D/g, ''))} placeholder="100" className={inputClass()} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="c-start" label="Starts">
            <input id="c-start" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputClass()} />
          </Field>
          <Field id="c-end" label="Ends">
            <input id="c-end" type="date" value={f.endDate} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} className={inputClass()} />
          </Field>
          <Field id="c-budget" label="Bonus points budget" hint="Optional. Ends the campaign when used up.">
            <input id="c-budget" inputMode="numeric" value={f.budgetPoints} onChange={(e) => set('budgetPoints', e.target.value.replace(/\D/g, ''))} placeholder="No cap" className={inputClass()} />
          </Field>
        </div>

        <Field id="c-terms" label="Terms & conditions" hint="Shoppers see these on the promo.">
          <textarea id="c-terms" rows={3} value={f.terms} onChange={(e) => set('terms', e.target.value)} placeholder="Members only. Points are earned on the amount paid after vouchers." className={`${inputClass()} py-2`} />
        </Field>

        <div className="rounded-chip bg-promo-100 px-4 py-3 text-sm text-promo-700" aria-live="polite">
          <p className="text-xs font-bold">Shoppers will see</p>
          <p className="mt-0.5 font-bold">
            {f.name.trim() || 'Your campaign'} · {describeCampaign(draft, merchantName)}
          </p>
        </div>

        {error && <InlineError>{error}</InlineError>}
      </form>
    </Dialog>
  );
}
