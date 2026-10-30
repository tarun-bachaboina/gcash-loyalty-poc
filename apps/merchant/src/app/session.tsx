import { apiData, type Merchant } from '@gcash/shared';
import { useAsync } from '@gcash/ui';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';

const KEY = 'gcash:merchant:manager';

export interface Manager {
  merchantId: string;
  managerName: string;
}

function readStored(): Manager | null {
  try {
    const raw = localStorage.getItem(KEY);
    const m = raw ? (JSON.parse(raw) as Manager) : null;
    return m?.merchantId && m.managerName ? m : null;
  } catch {
    return null;
  }
}

interface ManagerValue {
  manager: Manager | null;
  merchant: Merchant | undefined;
  merchants: Merchant[] | undefined;
  merchantsError: Error | undefined;
  reloadMerchants: () => Promise<void>;
  signIn: (m: Manager) => void;
  signOut: () => void;
}

const ManagerContext = createContext<ManagerValue | null>(null);

/** Mocked store-manager session (v2 portal): store + manager name in localStorage. */
export function ManagerProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<Manager | null>(readStored);
  const merchantsQ = useAsync(() => apiData<Merchant[]>('/merchant/list'), []);

  const signIn = useCallback((m: Manager) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(m));
    } catch {
      /* memory only */
    }
    setManager(m);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setManager(null);
  }, []);

  const merchant = merchantsQ.data?.find((m) => m.merchantId === manager?.merchantId);

  return (
    <ManagerContext.Provider
      value={{ manager, merchant, merchants: merchantsQ.data, merchantsError: merchantsQ.error, reloadMerchants: merchantsQ.reload, signIn, signOut }}
    >
      {children}
    </ManagerContext.Provider>
  );
}

export function useManager() {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManager must be used inside ManagerProvider');
  return ctx;
}

/** Portal screens need a signed-in manager; an unknown store (e.g. after a reset) goes back to login. */
export function RequireManager({ children }: { children: ReactNode }) {
  const { manager, merchants } = useManager();
  const unknownStore = merchants && manager && !merchants.some((m) => m.merchantId === manager.merchantId);
  if (!manager || unknownStore) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
