import { apiData, apiRequest, ApiRequestError, MOBILE_PATTERN, type User } from '@gcash/shared';
import { Button, GCashLogo, InlineError, PointsChip, SpacePanel, useAsync } from '@gcash/ui';
import { Loader2, Smartphone } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { useSession } from '../app/session';

// PRD C-1 test users
const TEST_USERS = [
  { userId: 'USR-001', name: 'Juan Dela Cruz', mobileNumber: '09171112222' },
  { userId: 'USR-002', name: 'Maria Santos', mobileNumber: '09183334444' },
] as const;

type Choice = (typeof TEST_USERS)[number]['userId'] | 'custom';

const prettyMobile = (m: string) => `${m.slice(0, 4)} ${m.slice(4, 7)} ${m.slice(7)}`;

export default function Login() {
  const { userId, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [choice, setChoice] = useState<Choice>(userId === 'USR-002' ? 'USR-002' : 'USR-001');
  const [mobile, setMobile] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  // Live balances for the test users; the list still works if this fails.
  const balances = useAsync(
    () => Promise.all(TEST_USERS.map((u) => apiData<User>(`/customer/profile?userId=${u.userId}`).catch(() => undefined))),
    [],
  );

  const mobileValid = MOBILE_PATTERN.test(mobile);
  const showMobileError = choice === 'custom' && touched && !mobileValid;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (choice === 'custom' && !mobileValid) {
      setTouched(true);
      return;
    }
    const mobileNumber = choice === 'custom' ? mobile : TEST_USERS.find((u) => u.userId === choice)!.mobileNumber;
    setSubmitting(true);
    try {
      const { data } = await apiRequest<{ data: User }>('/customer/login', { body: { mobileNumber } });
      signIn(data.userId);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not sign in. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      {/* C-1 GCash logo banner (the screen's one hero zone) */}
      <SpacePanel className="rounded-hero px-5 py-7 text-center">
        <GCashLogo tone="white" className="mx-auto h-12" />
        <p className="mt-3 font-display text-2xl font-extrabold">Ayala Malls Loyalty</p>
        <p className="mt-1 text-sm text-on-space-muted">Earn points at Ayala Mall Manila Bay. Spend them on cinema, parking and food court treats.</p>
      </SpacePanel>

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <fieldset>
          <legend className="font-display text-lg font-bold">Choose your account</legend>
          <p className="mt-0.5 text-sm text-text-2">Pick a saved GCash account, or sign in with your mobile number.</p>

          <div className="mt-3 flex flex-col gap-2.5">
            {TEST_USERS.map((u, i) => {
              const balance = balances.data?.[i]?.pointsBalance;
              return (
                <ChoiceCard key={u.userId} checked={choice === u.userId} onSelect={() => setChoice(u.userId)} value={u.userId}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{u.name}</span>
                    <span className="block font-mono text-xs text-text-2">{prettyMobile(u.mobileNumber)}</span>
                  </span>
                  {balance !== undefined ? <PointsChip points={balance} size="sm" /> : balances.loading ? <span className="h-4 w-14 rounded bg-surface-2 motion-safe:animate-pulse" aria-hidden /> : null}
                </ChoiceCard>
              );
            })}

            <ChoiceCard checked={choice === 'custom'} onSelect={() => setChoice('custom')} value="custom">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-bold">
                  <Smartphone className="size-4 text-brand" aria-hidden />
                  Use another mobile number
                </span>
                <span className="block text-xs text-text-2">New numbers start a fresh member account.</span>
              </span>
            </ChoiceCard>

            {choice === 'custom' && (
              <div>
                <label htmlFor="mobile" className="text-sm font-semibold">
                  Mobile number
                </label>
                <input
                  id="mobile"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setTouched(true)}
                  aria-invalid={showMobileError}
                  aria-describedby="mobile-help"
                  autoFocus
                  className={`mt-1 min-h-12 w-full rounded-chip bg-surface-1 px-3 font-mono text-base tracking-wider ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    showMobileError ? 'ring-danger-500' : 'ring-line'
                  }`}
                />
                <p id="mobile-help" className={`mt-1 text-xs ${showMobileError ? 'font-semibold text-danger-700' : 'text-text-2'}`}>
                  Mobile number must be 11 digits starting with 09.
                </p>
              </div>
            )}
          </div>
        </fieldset>

        {error && (
          <div className="mt-4">
            <InlineError>{error}</InlineError>
          </div>
        )}

        <Button type="submit" size="lg" fullWidth className="mt-6" disabled={submitting} icon={submitting ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : undefined}>
          {submitting ? 'Signing in…' : 'Continue as Selected User'}
        </Button>
      </form>
    </AppShell>
  );
}

function ChoiceCard({ checked, onSelect, value, children }: { checked: boolean; onSelect: () => void; value: string; children: ReactNode }) {
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-card bg-surface-1 px-4 py-3 transition duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand ${
        checked ? 'ring-2 ring-brand' : 'ring-1 ring-line hover:ring-text-2'
      }`}
    >
      <input type="radio" name="test-user" value={value} checked={checked} onChange={onSelect} className="size-5 accent-[var(--brand)]" />
      {children}
    </label>
  );
}
