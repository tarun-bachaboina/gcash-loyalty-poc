import { motion } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { useMotionPref } from './motion';

interface SpacePanelProps extends HTMLAttributes<HTMLDivElement> {
  /** "gold" adds a gold inner arc: use only when the panel is about points or rewards. */
  tone?: 'brand' | 'gold';
  /** Show the pay-wave graphic (the hero zone's one light source). */
  grid?: boolean;
  /** Draw the arcs in once on mount (hero zones only; static under reduced motion). */
  drift?: boolean;
  edge?: boolean | 'gold';
}

const EASE = [0.22, 1, 0.36, 1] as const;

// Concentric arcs opening to the right, like the pay waves in the GCash logo. Centre sits left of the arcs.
const CX = 40;
const CY = 100;
const SPREAD = (52 * Math.PI) / 180;
function arc(r: number) {
  const x0 = CX + r * Math.cos(-SPREAD);
  const y0 = CY + r * Math.sin(-SPREAD);
  const x1 = CX + r * Math.cos(SPREAD);
  const y1 = CY + r * Math.sin(SPREAD);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

const WAVES = {
  brand: [
    { r: 58, className: 'stroke-wave-2', opacity: 0.32 },
    { r: 98, className: 'stroke-wave-1', opacity: 0.38 },
    { r: 138, className: 'stroke-wave-1', opacity: 0.2 },
  ],
  gold: [
    { r: 58, className: 'stroke-gold-500', opacity: 0.55 },
    { r: 98, className: 'stroke-wave-2', opacity: 0.3 },
    { r: 138, className: 'stroke-wave-1', opacity: 0.22 },
  ],
};

function PayWaves({ tone, play }: { tone: 'brand' | 'gold'; play: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute top-[16%] right-0 -z-10 h-[min(150px,80%)] translate-x-1/3"
      fill="none"
      strokeLinecap="round"
    >
      {WAVES[tone].map((w, i) => (
        <motion.path
          key={w.r}
          d={arc(w.r)}
          strokeWidth={14}
          className={w.className}
          initial={play ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: w.opacity }}
          transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: EASE }}
        />
      ))}
    </svg>
  );
}

/** Hero zone: GCash navy with the pay-wave graphic and a 1px edge. Dark in both themes. */
export function SpacePanel({ tone = 'brand', grid = true, drift = true, edge = true, className, style, children, ...rest }: SpacePanelProps) {
  const { reduced } = useMotionPref();
  return (
    <div
      {...rest}
      style={{ backgroundImage: 'linear-gradient(160deg, var(--space-800) 0%, var(--space-900) 100%)', ...style }}
      className={`focus-on-dark relative isolate overflow-hidden bg-space-800 text-on-space ${edge === 'gold' ? 'ring-1 ring-gold-300/70 ring-inset' : edge ? 'ring-1 ring-white/14 ring-inset' : ''} ${className ?? ''}`}
    >
      {grid && <PayWaves tone={tone} play={drift && !reduced} />}
      {children}
    </div>
  );
}
