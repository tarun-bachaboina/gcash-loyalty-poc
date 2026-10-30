import { motion } from "motion/react";
import type { ReactNode } from "react";

interface ProgressRingProps {
  value: number;
  max: number;
  /** Required text so progress is never colour-only, e.g. "25 pts to Ayala Cinema ₱50 Off Ticket". */
  label: string;
  size?: number;
  stroke?: number;
  /** Rendered on a SpacePanel. */
  onSpace?: boolean;
  /** Center content: usually the target reward's icon. */
  children?: ReactNode;
  /** Optional second line under the label, e.g. the next goal. */
  caption?: ReactNode;
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function ProgressRing({
  value,
  max,
  label,
  size = 96,
  stroke = 8,
  onSpace = false,
  children,
  caption,
  className,
}: ProgressRingProps) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const c = size / 2;
  const r = (size - stroke) / 2 - 2;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={label}
      className={`flex items-center gap-3 ${className ?? ""}`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className={onSpace ? "stroke-white/15" : "stroke-line"}
          />
          {pct > 0 && (
            <motion.circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              className={onSpace ? "stroke-gold-500" : "stroke-gold-600"}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: pct }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {children}
        </div>
      </div>
      <div className="min-w-0">
        <p
          className={`text-sm font-bold ${onSpace ? "text-on-space" : "text-text-1"}`}
        >
          {label}
        </p>
        {caption && (
          <p
            className={`mt-0.5 text-xs ${onSpace ? "text-on-space-muted" : "text-text-2"}`}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/** Thin linear variant for tight spaces (reward tiles, tier card). */
export function ProgressBar({
  value,
  max,
  className,
  track = "bg-line",
}: {
  value: number;
  max: number;
  className?: string;
  track?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full ${track} ${className ?? ""}`}
      aria-hidden
    >
      <motion.div
        className="h-full origin-left rounded-full bg-gold-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct }}
        transition={{ duration: 0.7, ease: EASE }}
      />
    </div>
  );
}
