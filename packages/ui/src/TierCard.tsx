import type { Tier } from '@gcash/shared';
import { animate, motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { useEffect } from 'react';
import { formatPoints } from './format';
import { GCashLogo } from './GCashLogo';
import { useMotionPref } from './motion';
import { ProgressBar } from './ProgressRing';
import { SpacePanel } from './SpacePanel';

interface TierCardProps {
  name: string;
  tier: Tier;
  memberId: string; // USR-001-09171112222
  /** Lifetime points toward the next tier; omit for the top tier. */
  progress?: { value: number; target: number; nextTier: Tier };
  /** Play one sheen sweep on mount (welcome / tier-up moments). */
  sweep?: boolean;
}

/** Membership card on the navy hero surface. VIP earns the gold arc and gold edge. */
export function TierCard({ name, tier, memberId, progress, sweep = false }: TierCardProps) {
  const { reduced } = useMotionPref();
  const sheenX = useMotionValue(-60);
  const sheenTransform = useMotionTemplate`translateX(${sheenX}%)`;
  const vip = tier === 'VIP';

  useEffect(() => {
    if (!sweep || reduced) return;
    const c = animate(sheenX, [-60, 60], { duration: 1.1, delay: 0.3, ease: [0.65, 0, 0.35, 1] });
    return () => c.stop();
  }, [sweep, reduced, sheenX]);

  return (
    <SpacePanel
      tone={vip ? 'gold' : 'brand'}
      edge={vip ? 'gold' : true}
      drift={sweep}
      style={{ aspectRatio: '1.586' }}
      className="flex w-full flex-col rounded-hero p-5 text-left shadow-e2"
    >
      {sweep && !reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[40%] -z-10"
          style={{ background: 'linear-gradient(115deg, transparent 40%, rgb(255 255 255 / .14) 50%, transparent 60%)', transform: sheenTransform }}
        />
      )}

      <div className="flex items-start justify-between">
        <GCashLogo tone="white" className="h-7" alt="" />
        <div className="text-right">
          <p className="text-xs font-semibold text-on-space-muted">Ayala Malls Loyalty</p>
          <p className={`mt-0.5 font-display text-2xl font-extrabold tracking-tight ${vip ? 'text-gold-300' : 'text-on-space'}`}>{tier}</p>
        </div>
      </div>

      {/* Card chip */}
      <svg width="42" height="32" viewBox="0 0 42 32" aria-hidden className="mt-3">
        <rect x="0.5" y="0.5" width="41" height="31" rx="6" className={vip ? 'fill-gold-300' : 'fill-on-space-muted'} stroke="rgb(0 0 0 / .2)" />
        <path d="M14 1v30M28 1v30M1 11h13M28 11h13M1 21h13M28 21h13M14 16h14" stroke="rgb(0 0 0 / .28)" fill="none" />
      </svg>

      <div className="mt-auto">
        <p className="font-display text-xl font-extrabold tracking-tight">{name}</p>
        <p className="font-mono text-xs font-semibold tracking-wide text-on-space-muted">{memberId}</p>
        {progress && (
          <div className="mt-3">
            <ProgressBar value={progress.value} max={progress.target} track="bg-white/20" />
            <p className="mt-1.5 text-xs font-semibold text-on-space">
              {formatPoints(Math.max(0, progress.target - progress.value))} pts to {progress.nextTier}
            </p>
          </div>
        )}
      </div>
    </SpacePanel>
  );
}
