import { branchLabel } from '@gcash/shared';
import { Button, ErrorState, GCashLogo, Select, Skeleton, ThemeToggle } from '@gcash/ui';
import { LayoutDashboard } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useManager } from '../app/session';

export default function Login() {
  const { manager, merchants, merchantsError, reloadMerchants, signIn } = useManager();
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState('');
  const [managerName, setManagerName] = useState('');
  const [touched, setTouched] = useState(false);

  if (manager && merchants?.some((m) => m.merchantId === manager.merchantId)) return <Navigate to="/overview" replace />;

  const branchMissing = touched && !merchantId;
  const nameMissing = touched && !managerName.trim();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!merchantId || !managerName.trim()) return;
    signIn({ merchantId, managerName: managerName.trim() });
    navigate('/overview', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="focus-on-dark bg-header text-white shadow-e2">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5">
          <GCashLogo tone="white" />
          <span className="border-l border-white/30 pl-3 text-sm font-semibold">Merchant Portal</span>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-hero bg-surface-1 p-6 shadow-e2 ring-1 ring-line sm:p-8">
          <div className="flex items-center gap-3">
            <GCashLogo className="h-9" />
            <span className="border-l border-line pl-3 font-display text-xl font-extrabold">Merchant Portal</span>
          </div>
          <p className="mt-2 text-sm text-text-2">Ayala Mall Manila Bay · Store manager back office</p>

          {merchantsError && !merchants ? (
            <div className="mt-6">
              <ErrorState message={merchantsError.message} onRetry={() => void reloadMerchants()} />
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5">
              <div>
                <label htmlFor="branch" className="text-sm font-bold">
                  Your store
                </label>
                {merchants ? (
                  <Select
                    id="branch"
                    size="lg"
                    className="mt-1.5"
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    invalid={branchMissing}
                    aria-describedby={branchMissing ? 'branch-error' : undefined}
                  >
                    <option value="" disabled>
                      Choose your store…
                    </option>
                    {merchants.map((m, i) => (
                      <option key={m.merchantId} value={m.merchantId}>
                        {i + 1}. {branchLabel(m)} ({m.merchantId})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Skeleton className="mt-1.5 h-12" />
                )}
                {branchMissing && (
                  <p id="branch-error" className="mt-1 text-xs font-semibold text-danger-700">
                    Choose the store you manage.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="manager" className="text-sm font-bold">
                  Manager name / PIN
                </label>
                <input
                  id="manager"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Store manager"
                  autoComplete="off"
                  aria-invalid={nameMissing}
                  aria-describedby="manager-help"
                  className={`mt-1.5 min-h-12 w-full rounded-chip bg-surface-1 px-3 text-base ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    nameMissing ? 'ring-danger-500' : 'ring-line'
                  }`}
                />
                <p id="manager-help" className={`mt-1 text-xs ${nameMissing ? 'font-semibold text-danger-700' : 'text-text-2'}`}>
                  {nameMissing ? 'Enter your name or PIN.' : 'Cashiers check out at the POS.'}
                </p>
              </div>

              <Button type="submit" size="lg" fullWidth disabled={!merchants} icon={<LayoutDashboard className="size-5" aria-hidden />}>
                Sign in
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
