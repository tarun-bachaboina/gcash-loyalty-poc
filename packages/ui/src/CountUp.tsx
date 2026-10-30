import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { formatPoints } from './format';
import { useMotionPref } from './motion';

interface CountUpProps {
  to: number;
  /** Start value on first render; later changes animate from the previous value. */
  from?: number;
  duration?: number;
  delay?: number;
  /** Announce the final value to screen readers (use for balances that change in place). */
  announce?: boolean;
  format?: (n: number) => string;
  className?: string;
}

export function CountUp({ to, from = 0, duration = 0.9, delay = 0, announce = false, format = formatPoints, className }: CountUpProps) {
  const { reduced } = useMotionPref();
  const mv = useMotionValue(reduced ? to : from);
  const text = useTransform(mv, (v) => format(v));
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (reduced) {
      mv.set(to);
      return;
    }
    const controls = animate(mv, to, { duration, delay: isFirst ? delay : 0, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [to, reduced, duration, delay, mv]);

  return (
    <span className={`tabular ${className ?? ''}`}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only" aria-live={announce ? 'polite' : undefined}>
        {format(to)}
      </span>
    </span>
  );
}
