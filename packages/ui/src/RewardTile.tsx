import { Car, Film, Lock, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { RewardCategory } from '@gcash/shared';
import { Button } from './Button';
import { formatPoints } from './format';
import { PointsChip } from './PointsChip';
import { ProgressBar } from './ProgressRing';
import { SpacePanel } from './SpacePanel';

export const CATEGORY_ICON: Record<RewardCategory, LucideIcon> = {
  Entertainment: Film,
  Parking: Car,
  'Food & Dining': UtensilsCrossed,
  Retail: ShoppingBag,
};

export type RewardAffordability = 'affordable' | 'almost' | 'locked';

/** Affordable ≥ cost; almost = within 20% of cost; otherwise locked. */
export function affordability(balance: number, cost: number): RewardAffordability {
  if (balance >= cost) return 'affordable';
  if (balance >= cost * 0.8) return 'almost';
  return 'locked';
}

interface RewardTileProps {
  title: string;
  sponsor: string;
  category: RewardCategory;
  pointsRequired: number;
  balance: number;
  /** Stock is 0: shown but not claimable. */
  soldOut?: boolean;
  onClaim?: () => void;
}

export function RewardTile({ title, sponsor, category, pointsRequired, balance, soldOut = false, onClaim }: RewardTileProps) {
  const state = soldOut ? 'locked' : affordability(balance, pointsRequired);
  const Icon = CATEGORY_ICON[category];
  const need = pointsRequired - balance;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-card bg-surface-1 shadow-e1 transition duration-200 hover:-translate-y-0.5 hover:shadow-e2 ${
        state === 'affordable' ? 'ring-2 ring-gold-600' : 'ring-1 ring-line'
      }`}
    >
      {/* Display case: the prize sits in a small navy zone, lit by the pay-waves */}
      <SpacePanel tone={state === 'affordable' ? 'gold' : 'brand'} edge={false} drift={false} className={`flex h-28 items-end p-3 ${state === 'locked' ? 'saturate-[.35]' : ''}`}>
        <Icon className={`size-9 ${state === 'locked' ? 'text-on-space-muted' : 'text-on-space'}`} strokeWidth={1.6} aria-hidden />
        {state === 'affordable' && (
          <span className="absolute top-2 left-2 rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-space-900">Ready to claim</span>
        )}
        {soldOut && (
          <span className="absolute top-2 left-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-on-space-muted ring-1 ring-white/15">Out of stock</span>
        )}
        {state === 'locked' && (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-white/10 text-on-space-muted">
            <Lock className="size-3.5" aria-label="Locked" />
          </span>
        )}
      </SpacePanel>

      <div className="flex flex-1 flex-col gap-2 p-3 text-text-1">
        <h3 className="font-display text-base leading-tight font-extrabold tracking-tight">{title}</h3>
        <p className="text-xs text-text-2">{sponsor}</p>
        <PointsChip points={pointsRequired} size="sm" className="mt-auto" />

        {soldOut && <p className="-mb-1 text-xs font-semibold text-text-2">Out of stock: check back soon.</p>}
        {state === 'almost' && <ProgressBar value={balance} max={pointsRequired} />}

        <Button onClick={onClaim} disabled={state !== 'affordable'} fullWidth className="mt-1">
          Claim Voucher
        </Button>
        {state !== 'affordable' && !soldOut && (
          <p className={`-mt-1 text-center text-xs font-semibold ${state === 'almost' ? 'text-gold-700' : 'text-text-2'}`}>
            Need {formatPoints(need)} more points
          </p>
        )}
      </div>
    </article>
  );
}
