import { branchLabel, type CheckoutResponse } from '@gcash/shared';
import { Button, Coin, formatManilaDateTime, formatPeso, formatPoints, SpacePanel } from '@gcash/ui';
import { CircleCheck, ReceiptText, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Shell } from '../app/Shell';
import { useTerminal } from '../app/session';

/** POS receipt after "Complete purchase". Counter-mode T1 confirmation: check pops, no confetti. */
export default function Receipt() {
  const location = useLocation();
  const navigate = useNavigate();
  const { merchant } = useTerminal();
  const res = location.state as CheckoutResponse | null;
  const nextRef = useRef<HTMLButtonElement>(null);
  // Ready for the next customer on Enter, without scrolling the confirmation out of view
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), []);
  if (!res?.sale) return <Navigate to="/carts" replace />;
  const { sale, quote } = res;
  const applied = quote.vouchers.filter((v) => v.selected);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <SpacePanel drift={false} role="status" aria-live="polite" className="flex flex-col items-center rounded-hero px-6 py-8 text-center">
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="grid size-20 place-items-center rounded-full bg-on-space-success/15 ring-1 ring-on-space-success/40"
          >
            <CircleCheck className="size-12 text-on-space-success" aria-hidden />
          </motion.span>
          <p className="mt-4 font-display text-2xl font-extrabold text-white">Payment complete</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-white tabular">{formatPeso(sale.net)}</p>
          {quote.member && res.newPointsBalance !== null && (
            <p className="mt-3 inline-flex items-center gap-2 text-base font-bold">
              <Coin size={22} />
              <span className="text-gold-300">+{formatPoints(sale.basePoints + sale.bonusPoints)} PTS</span>
              <span className="text-on-space-muted">to {quote.member.name} · new balance {formatPoints(res.newPointsBalance)} PTS</span>
            </p>
          )}
          <p className="mt-3 text-xs font-bold text-on-space-muted">Bill</p>
          <p className="font-mono text-lg font-semibold tracking-wider text-white">{sale.billId}</p>
        </SpacePanel>

        <section aria-label="Receipt" className="mt-4 rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line">
          <div className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="font-bold">{merchant ? branchLabel(merchant) : sale.merchantId}</p>
              <p className="text-text-2">
                {formatManilaDateTime(sale.timestamp)} · {sale.cashier}
              </p>
            </div>
            <ReceiptText className="size-6 text-text-2" aria-hidden />
          </div>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-line">
              {quote.lines.map((l) => (
                <tr key={l.sku}>
                  <td className="py-2">
                    {l.qty}× {l.name}
                    {l.multiplier > 1 && <span className="ml-2 text-xs font-bold text-promo-700">{l.multiplier}× pts</span>}
                  </td>
                  <td className="py-2 text-right tabular">{formatPeso(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-2">Subtotal</dt>
              <dd className="tabular">{formatPeso(sale.subtotal)}</dd>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-text-2">Voucher discount · {applied.map((v) => v.title).join(', ')}</dt>
                <dd className="tabular">−{formatPeso(sale.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>Total paid</dt>
              <dd className="tabular">{formatPeso(sale.net)}</dd>
            </div>
          </dl>
          {quote.member ? (
            <dl className="mt-4 space-y-1 rounded-card bg-gold-100 p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-2">Base points</dt>
                <dd className="font-semibold tabular">{formatPoints(sale.basePoints)}</dd>
              </div>
              {quote.campaigns.map((c) => (
                <div key={c.campaignId} className="flex justify-between">
                  <dt className="inline-flex items-center gap-1 text-promo-700">
                    <Zap className="size-3.5" aria-hidden />
                    {c.name}
                  </dt>
                  <dd className="font-semibold tabular">+{formatPoints(c.bonusPoints)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-gold-300 pt-1.5 font-bold">
                <dt>Points earned</dt>
                <dd className="tabular">{formatPoints(sale.basePoints + sale.bonusPoints)} PTS</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 rounded-card bg-surface-2 p-3 text-sm text-text-2">No member on this bill: no points earned.</p>
          )}
        </section>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button ref={nextRef} size="lg" fullWidth onClick={() => navigate('/carts')}>
            Next customer
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/sales')}>
            Today's bills
          </Button>
        </div>
      </div>
    </Shell>
  );
}
