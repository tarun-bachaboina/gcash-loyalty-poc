import { apiData, type Merchant } from '@gcash/shared';
import { useAsync } from '@gcash/ui';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';

const KEY = 'gcash:pos:terminal';

export interface Terminal {
  merchantId: string;
  cashierName: string;
}

function readStored(): Terminal | null {
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? (JSON.parse(raw) as Terminal) : null;
    return t?.merchantId && t.cashierName ? t : null;
  } catch {
    return null;
  }
}

interface TerminalValue {
  terminal: Terminal | null;
  merchant: Merchant | undefined;
  merchants: Merchant[] | undefined;
  merchantsError: Error | undefined;
  reloadMerchants: () => Promise<void>;
  open: (t: Terminal) => void;
  close: () => void;
}

const TerminalContext = createContext<TerminalValue | null>(null);

/** Mocked cashier session (PRD §1.1): selected branch + cashier name in localStorage. */
export function TerminalProvider({ children }: { children: ReactNode }) {
  const [terminal, setTerminal] = useState<Terminal | null>(readStored);
  const merchantsQ = useAsync(() => apiData<Merchant[]>('/merchant/list'), []);

  const open = useCallback((t: Terminal) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* memory only */
    }
    setTerminal(t);
  }, []);

  const close = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setTerminal(null);
  }, []);

  const merchant = merchantsQ.data?.find((m) => m.merchantId === terminal?.merchantId);

  return (
    <TerminalContext.Provider
      value={{ terminal, merchant, merchants: merchantsQ.data, merchantsError: merchantsQ.error, reloadMerchants: merchantsQ.reload, open, close }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used inside TerminalProvider');
  return ctx;
}

/** Terminal screens need an open terminal; an unknown branch (e.g. after a reset) goes back to M-1. */
export function RequireTerminal({ children }: { children: ReactNode }) {
  const { terminal, merchants } = useTerminal();
  const unknownBranch = merchants && terminal && !merchants.some((m) => m.merchantId === terminal.merchantId);
  if (!terminal || unknownBranch) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
