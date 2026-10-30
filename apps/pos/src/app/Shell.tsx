import { apiRequest, branchLabel } from '@gcash/shared';
import { GCashLogo, ThemeToggle } from '@gcash/ui';
import { LogOut, ReceiptText, ShoppingCart, Store } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useTerminal } from './session';

/** Polls the API so the header can show Online / Offline. */
function useOnline(intervalMs = 15000) {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      apiRequest('/health')
        .then(() => alive && setOnline(true))
        .catch(() => alive && setOnline(false));
    void check();
    const id = setInterval(check, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return online;
}

/** POS chrome: navy header with GCash logo, "POS", store pill, cashier, nav and terminal status. */
export function Shell({ children }: { children: ReactNode }) {
  const { terminal, merchant, close } = useTerminal();
  const navigate = useNavigate();
  const online = useOnline();
  const nav = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150 ${
      isActive ? 'bg-white/12 text-white' : 'text-on-chrome-muted hover:bg-white/8 hover:text-white'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="focus-on-dark sticky top-0 z-20 bg-header text-white shadow-e2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <GCashLogo tone="white" />
          <span className="border-l border-white/30 pl-3 text-sm font-semibold whitespace-nowrap">POS Checkout</span>
          {merchant && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-sm font-semibold">
              <Store className="size-4 text-wave-2" aria-hidden />
              {branchLabel(merchant)}
            </span>
          )}
          <span role="status" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${online === false ? 'text-on-space-danger' : 'text-on-chrome-muted'}`}>
            <span className={`size-2 rounded-full ${online === false ? 'bg-on-space-danger' : online ? 'bg-on-space-success' : 'bg-on-chrome-muted'}`} aria-hidden />
            {online === false ? 'Offline' : online ? 'Online' : 'Connecting…'}
            {terminal && <span className="hidden md:inline"> · {terminal.cashierName}</span>}
          </span>
          <nav aria-label="POS" className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NavLink to="/carts" className={nav}>
              <ShoppingCart className="size-4" aria-hidden />
              Carts
            </NavLink>
            <NavLink to="/sales" className={nav}>
              <ReceiptText className="size-4" aria-hidden />
              Today's bills
            </NavLink>
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/login');
              }}
              className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-on-chrome-muted hover:bg-white/8 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Close terminal</span>
              <span className="sr-only sm:hidden">Close terminal</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
