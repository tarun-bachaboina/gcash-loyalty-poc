import { branchLabel } from '@gcash/shared';
import { GCashLogo, ThemeToggle } from '@gcash/ui';
import { ExternalLink, Gift, LayoutDashboard, LogOut, Megaphone, ReceiptText, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useManager } from './session';

const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
];

/** Navy header (PRD §4.2 chrome) for the store manager's back office. */
export function Shell({ children }: { children: ReactNode }) {
  const { manager, merchant, signOut } = useManager();
  const navigate = useNavigate();

  function leave() {
    signOut();
    navigate('/login');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150 ${
      isActive ? 'bg-white/12 text-white' : 'text-on-chrome-muted hover:bg-white/8 hover:text-white'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="focus-on-dark sticky top-0 z-20 bg-header text-white shadow-e2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <GCashLogo tone="white" />
          <span className="border-l border-white/30 pl-3 text-sm font-semibold whitespace-nowrap">Merchant Portal</span>
          {merchant && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-sm font-semibold">
              <Store className="size-4 text-wave-2" aria-hidden />
              {branchLabel(merchant)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <a href={import.meta.env.DEV ? 'http://localhost:5176/pos/' : '/pos/'} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-on-chrome-muted hover:bg-white/8 hover:text-white">
              Open POS
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <button type="button" onClick={leave} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-on-chrome-muted hover:bg-white/8 hover:text-white" title={manager ? `Signed in as ${manager.managerName}` : undefined}>
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
        <nav aria-label="Portal" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
