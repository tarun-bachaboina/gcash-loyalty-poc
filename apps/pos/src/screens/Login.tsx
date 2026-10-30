import { branchLabel } from '@gcash/shared';
import { Button, ErrorState, GCashLogo, Select, Skeleton, ThemeToggle } from '@gcash/ui';
import { MonitorSmartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useTerminal } from '../app/session';

export default function Login() {
  const { terminal, merchants, merchantsError, reloadMerchants, open } = useTerminal();
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [touched, setTouched] = useState(false);

  if (terminal && merchants?.some((m) => m.merchantId === terminal.merchantId)) return <Navigate to="/carts" replace />;

  const branchMissing = touched && !merchantId;
  const cashierMissing = touched && !cashierName.trim();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!merchantId || !cashierName.trim()) return;
    open({ merchantId, cashierName: cashierName.trim() });
    navigate('/carts', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="focus-on-dark bg-header text-white shadow-e2">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5">
          <GCashLogo tone="white" />
          <span className="border-l border-white/30 pl-3 text-sm font-semibold">POS Checkout</span>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-hero bg-surface-1 p-6 shadow-e2 ring-1 ring-line sm:p-8">
          <div className="flex items-center gap-3">
            <GCashLogo className="h-9" />
            <span className="border-l border-line pl-3 font-display text-xl font-extrabold">POS Checkout</span>
          </div>
          <p className="mt-2 text-sm text-text-2">Ayala Mall Manila Bay · Cashier checkout</p>

          {merchantsError && !merchants ? (
            <div className="mt-6">
              <ErrorState message={merchantsError.message} onRetry={() => void reloadMerchants()} />
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5">
              <div>
                <label htmlFor="branch" className="text-sm font-bold">
                  Select Store Branch
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
                    Choose the store you're working at.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cashier" className="text-sm font-bold">
                  Cashier PIN / Name
                </label>
                <input
                  id="cashier"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Cashier 001"
                  autoComplete="off"
                  aria-invalid={cashierMissing}
                  aria-describedby="cashier-help"
                  className={`mt-1.5 min-h-12 w-full rounded-chip bg-surface-1 px-3 text-base ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    cashierMissing ? 'ring-danger-500' : 'ring-line'
                  }`}
                />
                <p id="cashier-help" className={`mt-1 text-xs ${cashierMissing ? 'font-semibold text-danger-700' : 'text-text-2'}`}>
                  {cashierMissing ? 'Enter your cashier name or PIN.' : 'Shown on receipts.'}
                </p>
              </div>

              <Button type="submit" size="lg" fullWidth disabled={!merchants} icon={<MonitorSmartphone className="size-5" aria-hidden />}>
                Open Terminal
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
