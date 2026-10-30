import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

export { CampaignPill, RewardPill } from '@gcash/ui';

export function PageHeader({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        <p className="text-sm text-text-2">{sub}</p>
      </div>
      {action}
    </div>
  );
}

export const inputClass = (invalid?: boolean) =>
  `min-h-11 w-full rounded-chip bg-surface-1 px-3 text-sm ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${invalid ? 'ring-danger-500' : 'ring-line'}`;

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-text-2">{hint}</p>}
    </div>
  );
}

/** "+12.4%" vs the previous period. `neutral` for figures that are neither good nor bad when they rise. */
export function Delta({ now, before, neutral }: { now: number; before: number; neutral?: boolean }) {
  if (!before) return <span className="text-xs text-on-space-muted">No earlier data</span>;
  const pct = ((now - before) / before) * 100;
  const flat = Math.abs(pct) < 0.5;
  const good = flat || neutral ? null : pct > 0;
  const Icon = flat ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${good === null ? 'text-on-space-muted' : good ? 'text-emerald-300' : 'text-rose-300'}`}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? 'Flat' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  );
}

export const shortDate = (yyyyMmDd: string) =>
  new Date(`${yyyyMmDd}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
