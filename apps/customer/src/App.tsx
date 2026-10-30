import { GCashLogo } from '@gcash/ui';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireSession, SessionProvider } from './app/session';
import Catalog from './screens/Catalog';
import Dashboard from './screens/Dashboard';
import History from './screens/History';
import Login from './screens/Login';
import Promos from './screens/Promos';
import Vouchers from './screens/Vouchers';

const Playground = lazy(() => import('./playground/Playground'));

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireSession><Dashboard /></RequireSession>} />
        <Route path="/catalog" element={<RequireSession><Catalog /></RequireSession>} />
        <Route path="/vouchers" element={<RequireSession><Vouchers /></RequireSession>} />
        <Route path="/history" element={<RequireSession><History /></RequireSession>} />
        <Route path="/promos" element={<RequireSession><Promos /></RequireSession>} />
        <Route
          path="/playground"
          element={
            <>
              <header className="sticky top-0 z-20 flex h-14 items-center gap-3 focus-on-dark bg-header px-4 text-white shadow-e1">
                <GCashLogo tone="white" />
                <span className="border-l border-white/30 pl-3 text-sm font-semibold">Ayala Malls Loyalty</span>
              </header>
              <main className="p-4">
                <Suspense>
                  <Playground />
                </Suspense>
              </main>
            </>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </SessionProvider>
  );
}
