import confetti from 'canvas-confetti';
import { MotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type MotionPref = 'system' | 'reduce' | 'full';

interface MotionPrefValue {
  pref: MotionPref;
  setPref: (pref: MotionPref) => void;
  /** True when animations should degrade to static + fade. */
  reduced: boolean;
}

const MotionPrefContext = createContext<MotionPrefValue>({ pref: 'system', setPref: () => {}, reduced: false });

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function useOsReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(REDUCE_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(REDUCE_QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Honours the OS reduced-motion setting; `pref` lets a page (e.g. the playground) force either mode. */
export function MotionPrefProvider({ children, initial = 'system' }: { children: ReactNode; initial?: MotionPref }) {
  const [pref, setPref] = useState<MotionPref>(initial);
  const os = useOsReducedMotion();
  const reduced = pref === 'reduce' || (pref === 'system' && os);
  return (
    <MotionPrefContext.Provider value={{ pref, setPref, reduced }}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </MotionPrefContext.Provider>
  );
}

export const useMotionPref = () => useContext(MotionPrefContext);

// GCash gold and logo blues (canvas-confetti needs literal colours)
const BURST_COLORS = ['#F2B21B', '#FFD56B', '#007CFF', '#6FBEFB'];

/** One short particle pop for a T3 reward moment. No-op under reduced motion. */
export function rewardBurst(reduced: boolean, origin = { x: 0.5, y: 0.45 }) {
  if (reduced) return;
  void confetti({
    particleCount: 45,
    spread: 70,
    startVelocity: 38,
    gravity: 1.1,
    ticks: 160,
    scalar: 0.9,
    origin,
    colors: BURST_COLORS,
    disableForReducedMotion: true,
  })?.then(() => confetti.reset());
}

export function haptic(pattern: number | number[] = 12) {
  // Browsers block vibrate() until the user has interacted with the page.
  if (typeof navigator === 'undefined' || !('vibrate' in navigator) || navigator.userActivation?.hasBeenActive === false) return;
  navigator.vibrate(pattern);
}
