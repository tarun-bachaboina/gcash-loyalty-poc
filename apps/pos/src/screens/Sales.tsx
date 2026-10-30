import { apiData, type Sale } from '@gcash/shared';
import { Button, EmptyState, ErrorState, formatManilaDateTime, formatPeso, formatPoints, Skeleton, useAsync } from '@gcash/ui';
import { ReceiptText, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Shell } from '../app/Shell';
import { useTerminal } from '../app/session';

type SaleRow = Sale & { customerName: string | null };

/** Today's bills at this store (Asia/Manila). */
export default function Sales() {
  const { terminal } = useTerminal();
  const navigate = useNavigate();
  const merchantId = terminal?.merchantId ?? '';
  const sales = useAsync(() => apiData<SaleRow[]>(`/merchant/transactions?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const rows = sales.data ?? [];
  const revenue = rows.reduce((n, s) => n + s.net, 0);
  const points = rows.reduce((n, s) => n + s.basePoints + s.bonusPoints, 0);

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Today's bills</h1>
          {sales.data && (
            <p className="text-sm text-text-2">
              {rows.length} bill{rows.length === 1 ? '' : 's'} · {formatPeso(revenue)} collected · {formatPoints(points)} points issued
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => void sales.reload()} disabled={sales.loading} icon={<RefreshCw className={`size-4 ${sales.loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden />}>
          Refresh
        </Button>
      </div>
      {sales.error && !sales.data ? (
        <ErrorState message={sales.error.message} onRetry={() => void sales.reload()} />
      ) : !sales.data ? (
        <Skeleton className="h-64 rounded-hero" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No bills yet today" body="Completed checkouts at this store appear here." action={<Button onClick={() => navigate('/carts')}>Go to carts</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-hero bg-surface-1 shadow-e1 ring-1 ring-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-xs text-text-2">
              <tr>
                {['Time', 'Bill', 'Customer', 'Items', 'Subtotal', 'Discount', 'Paid', 'Points'].map((h, i) => (
                  <th key={h} scope="col" className={`px-4 py-3 font-semibold ${i >= 4 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.billId} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3 whitespace-nowrap tabular">{formatManilaDateTime(s.timestamp).slice(11)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{s.billId}</td>
                  <td className="px-4 py-3">{s.customerName ?? <span className="text-text-2">Non-member</span>}</td>
                  <td className="px-4 py-3 text-text-2">{s.lines.reduce((n, l) => n + l.qty, 0)}</td>
                  <td className="px-4 py-3 text-right tabular">{formatPeso(s.subtotal)}</td>
                  <td className="px-4 py-3 text-right tabular">{s.discount ? `−${formatPeso(s.discount)}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular">{formatPeso(s.net)}</td>
                  <td className="px-4 py-3 text-right tabular">{s.userId ? `+${formatPoints(s.basePoints + s.bonusPoints)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
