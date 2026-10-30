import { apiData, type Program, type User } from '@gcash/shared';
import { useAsync } from '@gcash/ui';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

const USER_KEY = 'gcash:customer:userId';

function readStored() {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

interface SessionValue {
  userId: string | null;
  signIn: (userId: string) => void;
  signOut: () => void;
  profile: User | undefined;
  program: Program | undefined;
  profileError: Error | undefined;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Mocked session (PRD §1.1): the selected userId lives in localStorage; profile is fetched from the API. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readStored);

  const signIn = useCallback((id: string) => {
    try {
      localStorage.setItem(USER_KEY, id);
    } catch {
      /* session falls back to memory only */
    }
    setUserId(id);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    setUserId(null);
  }, []);

  const profileQ = useAsync(() => (userId ? apiData<User>(`/customer/profile?userId=${encodeURIComponent(userId)}`) : Promise.resolve(undefined)), [userId]);
  const programQ = useAsync(() => apiData<Program>('/customer/program'), []);

  // Points can be awarded at a store while the app sits in the background: refresh on return.
  const { reload } = profileQ;
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reload]);

  return (
    <SessionContext.Provider
      value={{
        userId,
        signIn,
        signOut,
        // Never surface the previous user's profile while the new one loads
        profile: profileQ.data?.userId === userId ? profileQ.data : undefined,
        program: programQ.data,
        profileError: profileQ.error,
        profileLoading: profileQ.loading,
        // Also retry the program values if they failed to load (e.g. after an outage)
        refreshProfile: async () => {
          await Promise.all([reload(), programQ.data ? undefined : programQ.reload()]);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Routes behind the mock login. A stale stored userId (e.g. after a demo reset) sends you back to login. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { userId, profileError, signOut } = useSession();
  const location = useLocation();
  const unknownUser = profileError && 'code' in profileError && profileError.code === 'USER_NOT_FOUND';
  useEffect(() => {
    if (unknownUser) signOut();
  }, [unknownUser, signOut]);
  if (!userId || unknownUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
