import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic, rewardBurst, useMotionPref } from './motion';
import { Button } from './Button';
import { PointsChip } from './PointsChip';
import { SpacePanel } from './SpacePanel';

/**
 * T3 reward moment with the skill's four beats:
 * build-up (dim) → reveal (object springs in) → payoff (pay-wave ripple, count-up, burst, haptic, copy)
 * → settle (next actions). Tap anywhere to skip to settled. Reduced motion: settled + 200ms fade.
 */
export type RewardBeat = 'buildup' | 'reveal' | 'payoff' | 'settled';

const ORDER: RewardBeat[] = ['buildup', 'reveal', 'payoff', 'settled'];
const BEAT_AT: Record<Exclude<RewardBeat, 'buildup'>, number> = { reveal: 250, payoff: 800, settled: 2000 };

interface Action {
  label: string;
  onClick: () => void;
}

interface RewardMomentProps {
  open: boolean;
  onClose: () => void;
  /** The thing that was earned: coin, voucher ticket, tier card. */
  object: ReactNode;
  title: string;
  /** Specific copy naming what happened, e.g. "Ayala Cinema ₱50 Off Ticket is now in My Vouchers." */
  message: string;
  points?: { value: number; tone: 'earn' | 'burn' };
  primaryAction: Action;
  secondaryAction?: Action;
  /** Transaction/voucher id. A moment is never played twice for the same key. */
  celebrationKey?: string;
  /** Start at a given beat (playground / screenshots). */
  initialBeat?: RewardBeat;
}

const celebratedKey = (k: string) => `gcash:celebrated:${k}`;
function wasCelebrated(key?: string) {
  if (!key) return false;
  try {
    return localStorage.getItem(celebratedKey(key)) === '1';
  } catch {
    return false;
  }
}
function markCelebrated(key?: string) {
  if (!key) return;
  try {
    localStorage.setItem(celebratedKey(key), '1');
  } catch {
    /* storage unavailable: worst case the moment can replay */
  }
}

export function RewardMoment(props: RewardMomentProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{props.open && <MomentDialog key="moment" {...props} />}</AnimatePresence>, document.body);
}

const RIPPLES = ['stroke-gold-300', 'stroke-wave-2', 'stroke-wave-1'];

/** One-shot broadcast of three rings (gold, then the logo blues) behind the earned object. */
function PayWaveRipple() {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-80 -translate-1/2" fill="none">
      {RIPPLES.map((cls, i) => (
        <motion.circle
          key={cls}
          cx="100"
          cy="100"
          r="40"
          strokeWidth="6"
          className={cls}
          style={{ transformOrigin: '100px 100px' }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 2.3], opacity: [0, 0.85, 0] }}
          transition={{ duration: 1.1, delay: i * 0.16, ease: [0.22, 1, 0.36, 1], times: [0, 0.25, 1] }}
        />
      ))}
    </svg>
  );
}

function MomentDialog({ onClose, object, title, message, points, primaryAction, secondaryAction, celebrationKey, initialBeat }: RewardMomentProps) {
  const { reduced } = useMotionPref();
  // While exiting, the overlay must never swallow clicks meant for the page underneath.
  const present = useIsPresent();
  const [beat, setBeat] = useState<RewardBeat>(() =>
    reduced || wasCelebrated(celebrationKey) ? 'settled' : (initialBeat ?? 'buildup'),
  );
  const reached = (b: RewardBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(b);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const celebrateRef = useRef(!reduced && !wasCelebrated(celebrationKey) && (initialBeat ?? 'buildup') !== 'settled');

  // Schedule the beats once; skipping just jumps state ahead.
  useEffect(() => {
    markCelebrated(celebrationKey);
    if (beat === 'settled') return;
    const offset = beat === 'buildup' ? 0 : BEAT_AT[beat];
    const timers = (['reveal', 'payoff', 'settled'] as const)
      .filter((b) => BEAT_AT[b] > offset)
      .map((b) =>
        setTimeout(() => setBeat((cur) => (ORDER.indexOf(cur) < ORDER.indexOf(b) ? b : cur)), BEAT_AT[b] - offset),
      );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Payoff side effects fire once, and only for a live (not skipped) celebration.
  useEffect(() => {
    if (beat === 'payoff' && celebrateRef.current) {
      celebrateRef.current = false;
      rewardBurst(reduced);
      haptic(12);
    }
    if (beat === 'settled') primaryRef.current?.focus();
  }, [beat, reduced]);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const skipOrClose = () => (beat === 'settled' ? onClose() : setBeat('settled'));
  const pop = { type: 'spring', stiffness: 420, damping: 22 } as const;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-moment-title"
      tabIndex={-1}
      className={`fixed inset-0 z-50 grid place-items-center p-4 outline-none ${present ? '' : 'pointer-events-none'}`}
      inert={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.25 }}
      onClick={skipOrClose}
    >
      <div className="absolute inset-0 bg-space-900/75 backdrop-blur-sm" aria-hidden />

      <motion.div
        onClick={(e) => {
          e.stopPropagation();
          if (beat !== 'settled') setBeat('settled');
        }}
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-hero shadow-e3"
      >
        <SpacePanel tone="gold" edge="gold" className="rounded-hero px-5 pt-8 pb-5 text-center">
          <motion.div
            className="relative flex justify-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={reached('reveal') ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            transition={pop}
          >
            {/* Pay-wave ripple: rings broadcast once from the object at the payoff, then are gone. */}
            {!reduced && reached('payoff') && <PayWaveRipple />}
            {object}
          </motion.div>

          <div className="relative mt-5 min-h-24" aria-live="polite">
            {reached('payoff') && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                {points && (
                  <PointsChip points={points.value} tone={points.tone} size="lg" onSpace animate={beat === 'payoff'} className="justify-center" />
                )}
                <h2 id="reward-moment-title" className="mt-2 font-display text-2xl font-extrabold text-white">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-on-space-muted">{message}</p>
              </motion.div>
            )}
          </div>

          <motion.div
            className="relative mt-4 flex flex-col gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: reached('settled') ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            style={{ pointerEvents: reached('settled') ? 'auto' : 'none' }}
          >
            <Button ref={primaryRef} size="lg" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
            {secondaryAction && (
              <Button variant="inverse" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </motion.div>
        </SpacePanel>
      </motion.div>
    </motion.div>
  );
}
