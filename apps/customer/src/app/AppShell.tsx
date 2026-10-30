import { GCashLogo, ThemeToggle } from '@gcash/ui';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface AppShellProps {
  /** Sub-pages show a back link to the dashboard. */
  back?: boolean;
  title?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  /** Bottom-fixed bar (C-2 quick actions). */
  bottomBar?: ReactNode;
}

/** PRD 3.2: fixed top bar with the GCash logo + "Ayala Malls Loyalty"; mobile column 360–430px. */
export function AppShell({ back, title, headerAction, children, bottomBar }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-surface-0">
      <header className="sticky top-0 z-20 focus-on-dark bg-header text-white shadow-e1">
        <div className="flex h-14 items-center gap-2 px-3">
          {back && (
            <Link to="/dashboard" aria-label="Back to home" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/12">
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          )}
          <GCashLogo tone="white" className={`h-7 shrink-0 ${back ? '' : 'ml-1'}`} />
          {/* min-w-0 + leading-tight: at 360px the label wraps to two lines instead of being cut off */}
          <span className="min-w-0 border-l border-white/30 pl-2.5 text-sm leading-tight font-semibold">Ayala Malls Loyalty</span>
          <div className="ml-auto flex shrink-0 items-center">
            <ThemeToggle />
            {headerAction}
          </div>
        </div>
      </header>
      <main className={`flex-1 px-4 pt-4 ${bottomBar ? 'pb-28' : 'pb-8'}`}>
        {title && <h1 className="mb-4 font-display text-2xl font-extrabold">{title}</h1>}
        {children}
      </main>
      {bottomBar && (
        <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-line bg-surface-1/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
          {bottomBar}
        </nav>
      )}
    </div>
  );
}
