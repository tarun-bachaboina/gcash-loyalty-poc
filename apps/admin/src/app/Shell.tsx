import { apiData, type Dashboard } from '@gcash/shared';
import { GCashLogo, ThemeToggle, useAsync } from '@gcash/ui';
import { ClipboardCheck, Gift, LayoutDashboard, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';

// v2: A-2 Loyalty Rules is retired (fixed programme values); Approvals is new.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/approvals', label: 'Approvals', Icon: ClipboardCheck },
  { to: '/rewards', label: 'Mall Rewards', Icon: Gift },
  { to: '/audit', label: 'Audit Ledger', Icon: ScrollText },
];

/** Pending campaigns + rewards, for the Approvals badge. Refreshes on every navigation (and when `bump` changes). */
function usePendingCount(bump?: unknown) {
  const { pathname } = useLocation();
  const q = useAsync(() => apiData<Dashboard>('/admin/dashboard'), [pathname, bump]);
  return q.data ? q.data.pendingApprovals.campaigns + q.data.pendingApprovals.rewards : 0;
}

interface ShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Change it after an approval decision so the nav badge refreshes */
  pendingKey?: unknown;
}

/** PRD 5.2: enterprise workspace navigation with GCash logo + "Ayala Malls Admin Console" on slate. */
export function Shell({ title, description, actions, children, pendingKey }: ShellProps) {
  const pending = usePendingCount(pendingKey);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="focus-on-dark sticky top-0 z-20 bg-header text-white shadow-e2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
          <div className="flex items-center gap-3">
            <GCashLogo tone="white" />
            <span className="border-l border-white/30 pl-3 text-sm font-semibold whitespace-nowrap">Ayala Malls Admin Console</span>
          </div>
          <nav aria-label="Console" className="flex flex-wrap items-center gap-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-chip px-3 text-sm font-semibold transition-colors duration-150 ${
                    isActive ? 'bg-white/12 text-white' : 'text-on-chrome-muted hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {to === '/approvals' && pending > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-header tabular-nums" aria-label={`${pending} waiting`}>
                    {pending}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-on-chrome-muted lg:inline">Ayala Mall Manila Bay</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-text-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

/** Shared table chrome for the console's dense data tables. */
export const table = {
  wrap: 'overflow-x-auto rounded-card bg-surface-1 shadow-e1 ring-1 ring-line',
  table: 'w-full text-left text-sm',
  thead: 'border-b border-line bg-surface-2 text-xs text-text-2',
  th: 'px-4 py-3 font-semibold whitespace-nowrap',
  td: 'px-4 py-3',
  num: 'px-4 py-3 text-right tabular whitespace-nowrap',
  row: 'border-b border-line last:border-0 hover:bg-surface-2/60',
};
