import { CircleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

/** Content-shaped loading placeholder. Pulses only when motion is allowed. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`rounded-chip bg-surface-2 motion-safe:animate-pulse ${className ?? ''}`} />;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface-1 px-6 py-10 text-center ring-1 ring-line">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft">
        <Icon className="size-7 text-brand" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-text-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card bg-surface-1 px-6 py-8 text-center ring-1 ring-line">
      <span className="grid size-12 place-items-center rounded-full bg-danger-100">
        <CircleAlert className="size-6 text-danger-700" aria-hidden />
      </span>
      <p className="mt-3 font-bold">That didn't load</p>
      <p className="mt-1 max-w-xs text-sm text-text-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 rounded-chip bg-danger-100 px-3 py-2 text-sm font-semibold text-danger-700">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
