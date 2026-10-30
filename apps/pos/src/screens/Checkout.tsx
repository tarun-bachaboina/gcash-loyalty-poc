import { apiRequest, ApiRequestError, type CheckoutResponse, type Quote, type ValidateResponse } from '@gcash/shared';
import { Button, Coin, ErrorState, formatPeso, formatPoints, InlineError, Skeleton } from '@gcash/ui';
import { AlertTriangle, ArrowLeft, Camera, Crown, Loader2, ScanLine, TicketCheck, UserRound, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CameraScanner } from '../app/CameraScanner';
import { Shell } from '../app/Shell';
import { useTerminal } from '../app/session';

/** One-tap member scans for the counter (same payload as their member QR). */
const QUICK_MEMBERS = [
  { label: 'Juan Dela Cruz', payload: 'GCASH-MEMBER-USR-001' },
  { label: 'Maria Santos', payload: 'GCASH-MEMBER-USR-002' },
];

/** POS checkout: scan member → vouchers applied → points preview → complete purchase. */
export default function Checkout() {
  const { cartId = '' } = useParams();
  const { terminal } = useTerminal();
  const navigate = useNavigate();
  const [member, setMember] = useState<string | null>(null);
  /** undefined = let the API pre-select the best voucher */
  const [voucherIds, setVoucherIds] = useState<string[] | undefined>(undefined);
  const [quote, setQuote] = useState<Quote>();
  const [loadError, setLoadError] = useState<ApiRequestError | Error>();
  const [loading, setLoading] = useState(true);
  const [memberError, setMemberError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiRequest<{ data: Quote }>('/pos/quote', { body: { cartId, ...(member ? { member } : {}), ...(voucherIds ? { voucherIds } : {}) } });
      setQuote(data);
      setLoadError(undefined);
    } catch (err) {
      if (member && err instanceof ApiRequestError && err.code === 'USER_NOT_FOUND') {
        // Bad scan: keep the cart, ask for the member again
        setMemberError(err.message);
        setMember(null);
        setVoucherIds(undefined);
      } else setLoadError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [cartId, member, voucherIds]);

  useEffect(() => {
    void load();
  }, [load]);

  function scan(payload: string) {
    const value = payload.trim();
    if (!value) return setMemberError('Scan the member QR, or type the member ID or mobile number.');
    setMemberError(undefined);
    setSubmitError(undefined);
    setVoucherIds(undefined);
    setMember(value);
  }

  function clearMember() {
    setMember(null);
    setVoucherIds(undefined);
    setMemberError(undefined);
    setSubmitError(undefined);
  }

  function toggleVoucher(id: string) {
    if (!quote) return;
    const current = quote.vouchers.filter((v) => v.selected).map((v) => v.voucherId);
    setVoucherIds(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function complete() {
    if (!quote) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const res = await apiRequest<CheckoutResponse>('/pos/checkout', {
        body: {
          cartId,
          ...(member ? { member, voucherIds: quote.vouchers.filter((v) => v.selected).map((v) => v.voucherId) } : {}),
          cashier: terminal?.cashierName,
        },
      });
      navigate('/receipt', { state: res, replace: true });
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : 'Could not complete the purchase. Try again.');
      if (err instanceof ApiRequestError && err.code === 'VOUCHER_UNUSABLE') {
        setVoucherIds(undefined);
        void load();
      }
      setSubmitting(false);
    }
  }

  const paidAlready = loadError instanceof ApiRequestError && loadError.code === 'CART_PAID';

  return (
    <Shell>
      <Link to="/carts" className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 text-sm font-bold text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Back to carts
      </Link>

      {loadError && !quote ? (
        paidAlready ? (
          <ErrorState message="This cart has already been paid. Pick another cart." />
        ) : (
          <ErrorState message={loadError.message} onRetry={() => void load()} />
        )
      ) : !quote ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-busy aria-label="Loading cart">
          <Skeleton className="h-96 rounded-hero" />
          <Skeleton className="h-96 rounded-hero" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <CartPanel quote={quote} />

          <div className="flex flex-col gap-4">
            {quote.member ? (
              <MemberCard quote={quote} onChange={clearMember} />
            ) : (
              <MemberScan onScan={scan} error={memberError} merchantId={terminal?.merchantId ?? ''} onVoucher={(userId, voucherId) => (setMember(userId), setVoucherIds([voucherId]), setMemberError(undefined))} />
            )}
            {quote.member && <VoucherPanel quote={quote} onToggle={toggleVoucher} />}
            <Summary quote={quote} />

            {submitError && <InlineError>{submitError}</InlineError>}
            <Button size="lg" fullWidth onClick={complete} disabled={submitting || loading} icon={submitting ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : undefined}>
              {submitting ? 'Completing…' : `${quote.member ? 'Complete purchase' : 'Complete without member'} · ${formatPeso(quote.net)}`}
            </Button>
            {!quote.member && <p className="-mt-2 text-center text-xs text-text-2">No member scanned: no points will be earned and no vouchers applied.</p>}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Panel({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CartPanel({ quote }: { quote: Quote }) {
  return (
    <Panel title="Items" icon={<TicketCheck className="size-5 text-brand" aria-hidden />} aside={<span className="font-mono text-xs text-text-2">{quote.cartId}</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-text-2">
            <tr>
              <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
              <th scope="col" className="py-2 px-2 text-right font-semibold">Qty</th>
              <th scope="col" className="py-2 px-2 text-right font-semibold">Price</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {quote.lines.map((l) => {
              const cmp = l.campaignId ? quote.campaigns.find((c) => c.campaignId === l.campaignId) : undefined;
              return (
                <tr key={l.sku}>
                  <td className="py-3 pr-2">
                    <span className="font-semibold">{l.name}</span>
                    <span className="block font-mono text-xs text-text-2">{l.sku}</span>
                    {cmp && l.multiplier > 1 && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-promo-100 px-2 py-0.5 text-xs font-bold text-promo-700">
                        <Zap className="size-3" aria-hidden />
                        {l.multiplier}× {cmp.name}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right tabular">{l.qty}</td>
                  <td className="py-3 px-2 text-right tabular">{formatPeso(l.unitPrice)}</td>
                  <td className="py-3 pl-2 text-right font-semibold tabular">{formatPeso(l.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line">
              <th scope="row" colSpan={3} className="pt-3 text-right font-semibold text-text-2">
                Subtotal
              </th>
              <td className="pt-3 pl-2 text-right font-display text-lg font-extrabold tabular">{formatPeso(quote.subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function MemberScan({ onScan, error, merchantId, onVoucher }: { onScan: (v: string) => void; error?: string; merchantId: string; onVoucher: (userId: string, voucherId: string) => void }) {
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [camera, setCamera] = useState(false);

  /** Any scan (camera, barcode scanner or typed) routes by payload: a voucher QR goes to the voucher lookup. */
  function route(raw: string) {
    const text = raw.trim();
    if (/^GCASH-VOUCHER-/i.test(text) || /^VOUCH-/i.test(text)) {
      setCode(text);
      void lookUpVoucher(text);
    } else onScan(text);
  }

  async function lookUpVoucher(voucherCode: string) {
    if (!voucherCode.trim()) return setCodeError('Scan or type the voucher code.');
    setChecking(true);
    setCodeError(undefined);
    try {
      const res = await apiRequest<ValidateResponse>('/merchant/burn/validate', { body: { voucherCode: voucherCode.trim(), merchantId } });
      if (res.status === 'ACTIVE' && res.voucher) onVoucher(res.voucher.userId, res.voucher.voucherId);
      else if (res.status === 'REDEEMED') setCodeError(`Already used${res.redeemedMerchantName ? ` at ${res.redeemedMerchantName}` : ''}.`);
      else if (res.reason === 'WRONG_STORE') setCodeError(`Not valid here: only at ${res.validAtMerchantName}.`);
      else if (res.reason === 'EXPIRED') setCodeError(`Expired on ${res.voucher?.validUntil}.`);
      else setCodeError('No voucher matches this code.');
    } catch (err) {
      setCodeError(err instanceof ApiRequestError ? err.message : 'Could not check the voucher.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel title="Member" icon={<UserRound className="size-5 text-brand" aria-hidden />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          route(value);
        }}
        className="flex gap-2"
      >
        <label htmlFor="member" className="sr-only">
          Member QR, ID or mobile number
        </label>
        <input
          id="member"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Scan member QR, or type ID / mobile"
          autoComplete="off"
          autoFocus
          aria-invalid={!!error}
          className={`min-h-12 min-w-0 flex-1 rounded-chip bg-surface-1 px-3 font-mono ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${error ? 'ring-danger-500' : 'ring-line'}`}
        />
        <Button type="submit" icon={<ScanLine className="size-4" aria-hidden />} className="min-h-12">
          Scan
        </Button>
      </form>
      <Button fullWidth variant="secondary" className="mt-2" onClick={() => setCamera(true)} icon={<Camera className="size-4" aria-hidden />}>
        Scan QR with camera
      </Button>
      <CameraScanner
        open={camera}
        onClose={() => setCamera(false)}
        onResult={(text) => {
          setCamera(false);
          route(text);
        }}
      />
      {error && (
        <div className="mt-2">
          <InlineError>{error}</InlineError>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_MEMBERS.map((m) => (
          <Button key={m.payload} variant="ghost" onClick={() => onScan(m.payload)} icon={<ScanLine className="size-4" aria-hidden />}>
            Quick scan · {m.label}
          </Button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookUpVoucher(code);
        }}
        className="mt-4 border-t border-line pt-4"
      >
        <label htmlFor="voucher-code" className="text-xs font-semibold text-text-2">
          Customer only has a voucher QR? Scan it above, or type its code.
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="voucher-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="VOUCH-…"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-chip bg-surface-1 px-3 font-mono text-sm uppercase ring-1 ring-line outline-none placeholder:normal-case focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Button type="submit" variant="secondary" disabled={checking} icon={checking ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : undefined}>
            Look up
          </Button>
        </div>
        {codeError && <p className="mt-1.5 text-xs font-semibold text-danger-700">{codeError}</p>}
      </form>
    </Panel>
  );
}

function MemberCard({ quote, onChange }: { quote: Quote; onChange: () => void }) {
  const m = quote.member!;
  return (
    <Panel
      title="Member"
      icon={<UserRound className="size-5 text-brand" aria-hidden />}
      aside={
        <button type="button" onClick={onChange} className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-brand hover:bg-brand-soft">
          <X className="size-4" aria-hidden />
          Change
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand">{m.name.charAt(0)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold">
            {m.name}
            {m.tier === 'VIP' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-700">
                <Crown className="size-3" aria-hidden /> VIP
              </span>
            ) : (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-text-2">Member</span>
            )}
          </p>
          <p className="font-mono text-xs text-text-2">{m.userId}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular">
          <Coin size={18} />
          {formatPoints(m.pointsBalance)} PTS
        </span>
      </div>
    </Panel>
  );
}

function VoucherPanel({ quote, onToggle }: { quote: Quote; onToggle: (id: string) => void }) {
  return (
    <Panel title="Vouchers" icon={<TicketCheck className="size-5 text-brand" aria-hidden />}>
      {quote.vouchers.length === 0 ? (
        <p className="text-sm text-text-2">No saved vouchers. Points will still be earned on this bill.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {quote.vouchers.map((v) => (
            <li key={v.voucherId}>
              <label
                className={`flex min-h-12 items-center gap-3 rounded-card px-3 py-2 ring-1 ${
                  v.unusableReason ? 'cursor-not-allowed bg-surface-2 ring-line' : v.selected ? 'cursor-pointer bg-brand-soft ring-brand' : 'cursor-pointer ring-line hover:bg-surface-2'
                }`}
              >
                <input type="checkbox" checked={v.selected} disabled={!!v.unusableReason} onChange={() => onToggle(v.voucherId)} className="size-5 accent-[var(--brand)]" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${v.unusableReason ? 'text-text-2' : ''}`}>{v.title}</span>
                  <span className={`block text-xs ${v.unusableReason ? 'font-semibold text-danger-700' : 'text-text-2'}`}>{v.unusableReason ?? <span className="font-mono">{v.voucherId}</span>}</span>
                </span>
                <span className={`text-sm font-bold tabular ${v.unusableReason ? 'text-text-2' : ''}`}>−{formatPeso(v.discountAmount)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Summary({ quote }: { quote: Quote }) {
  return (
    <Panel title="Summary" icon={<Coin size={20} />}>
      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal">{formatPeso(quote.subtotal)}</Row>
        {quote.discount > 0 && <Row label="Voucher discount">−{formatPeso(quote.discount)}</Row>}
      </dl>
      <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
        <span className="font-semibold">Total to pay</span>
        <span className="font-display text-3xl font-extrabold tabular">{formatPeso(quote.net)}</span>
      </div>
      {quote.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {quote.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-chip bg-surface-2 px-3 py-2 text-xs font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-promo-700" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
      {quote.member ? (
        <div className="mt-4 rounded-card bg-gold-100 p-3" aria-live="polite">
          <p className="text-xs font-bold text-gold-700">Points to earn</p>
          <dl className="mt-2 space-y-1 text-sm">
            <Row label={`Base (${formatPeso(quote.net)} ÷ ₱100)`}>{formatPoints(quote.basePoints)}</Row>
            {quote.campaigns.map((c) => (
              <Row
                key={c.campaignId}
                label={
                  <span className="inline-flex items-center gap-1 text-promo-700">
                    <Zap className="size-3.5" aria-hidden />
                    {c.name}
                  </span>
                }
              >
                +{formatPoints(c.bonusPoints)}
              </Row>
            ))}
          </dl>
          <p className="mt-2 flex items-center justify-between border-t border-gold-300 pt-2">
            <span className="font-bold">Total</span>
            <span className="inline-flex items-center gap-1.5 font-display text-xl font-extrabold tabular">
              <Coin size={20} />
              {formatPoints(quote.totalPoints)} PTS
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-card bg-surface-2 p-3 text-sm text-text-2">Scan the member QR to earn points and use their vouchers.</p>
      )}
    </Panel>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-2">{label}</dt>
      <dd className="font-semibold tabular">{children}</dd>
    </div>
  );
}
