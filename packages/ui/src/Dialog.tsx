import { X } from 'lucide-react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevent closing (e.g. while a request is in flight). */
  busy?: boolean;
  /** "lg" for side-by-side form + preview on desktop. */
  size?: 'md' | 'lg';
}

/** Bottom sheet on phones, centered dialog from sm up. Working surface (T2 sheet motion). */
export function Dialog(props: DialogProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{props.open && <Panel key="dialog" {...props} />}</AnimatePresence>, document.body);
}

function Panel({ onClose, title, description, children, footer, busy, size = 'md' }: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // While exiting, the overlay must never swallow clicks meant for the page underneath.
  const present = useIsPresent();
  const close = () => !busy && onClose();

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus], button, a, input, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && panelRef.current) {
        // Keep focus inside the dialog
        const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a, input, select, textarea, [tabindex="0"]')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4 ${present ? '' : 'pointer-events-none'}`} inert={!present}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-space-900/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={close}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className={`relative max-h-[90dvh] w-full ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'} overflow-y-auto rounded-t-hero bg-surface-1 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-text-1 shadow-e2 sm:rounded-hero`}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl font-bold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-text-2">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label="Close" className="-mt-1 -mr-2 grid size-11 place-items-center rounded-full text-text-2 hover:bg-surface-2 disabled:opacity-40">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
        {/* Sticky so a long form's actions stay reachable. Sticky offsets are inset by the panel's padding, so the
            negative bottom (and margin) cancel it and the footer sits flush with the panel edge. */}
        {footer && (
          <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 mt-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-line bg-surface-1 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}
