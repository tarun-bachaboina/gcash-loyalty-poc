import { apiData, apiRequest, ApiRequestError, type Cart } from '@gcash/shared';
import { Button, EmptyState, ErrorState, formatPeso, InlineError, Skeleton, useAsync } from '@gcash/ui';
import { Loader2, RotateCcw, ShoppingCart, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Shell } from '../app/Shell';
import { useTerminal } from '../app/session';

export type CartRow = Cart & { subtotal: number; eligibleCampaigns: { campaignId: string; name: string }[] };

/** POS: open carts for this store. Badges show live campaigns a member would get on the cart. */
export default function Carts() {
  const { terminal } = useTerminal();
  const navigate = useNavigate();
  const merchantId = terminal?.merchantId ?? '';
  const carts = useAsync(() => apiData<CartRow[]>(`/pos/carts?merchantId=${encodeURIComponent(merchantId)}`), [merchantId]);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string>();

  async function reset() {
    setResetting(true);
    setError(undefined);
    try {
      await apiRequest('/pos/carts/reset', { body: { merchantId } });
      await carts.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load new carts.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Open carts</h1>
          <p className="text-sm text-text-2">Pick the customer's cart to start checkout.</p>
        </div>
        <Button variant="secondary" onClick={reset} disabled={resetting} icon={resetting ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}>
          Load new carts
        </Button>
      </div>
      {error && (
        <div className="mb-4">
          <InlineError>{error}</InlineError>
        </div>
      )}

      {carts.error && !carts.data ? (
        <ErrorState message={carts.error.message} onRetry={() => void carts.reload()} />
      ) : !carts.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading carts">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-hero" />
          ))}
        </div>
      ) : carts.data.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="All carts are paid" body="Load new carts for the next customer." action={<Button onClick={reset}>Load new carts</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {carts.data.map((c) => {
            const items = c.lines.reduce((n, l) => n + l.qty, 0);
            return (
              <li key={c.cartId}>
                <article className="flex h-full flex-col rounded-hero bg-surface-1 p-5 shadow-e1 ring-1 ring-line transition duration-150 hover:shadow-e2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg leading-tight font-bold">{c.label}</h2>
                      <p className="font-mono text-xs text-text-2">{c.cartId}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-text-2">
                      {items} item{items === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="mt-3 flex-1 space-y-0.5 text-sm text-text-2">
                    {c.lines.slice(0, 3).map((l) => (
                      <li key={l.sku} className="truncate">
                        {l.qty}× {l.name}
                      </li>
                    ))}
                    {c.lines.length > 3 && <li>+{c.lines.length - 3} more</li>}
                  </ul>
                  {c.eligibleCampaigns.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.eligibleCampaigns.map((cmp) => (
                        <span key={cmp.campaignId} className="inline-flex items-center gap-1 rounded-full bg-promo-100 px-2.5 py-0.5 text-xs font-bold text-promo-700">
                          <Zap className="size-3.5" aria-hidden />
                          {cmp.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
                    <p className="font-display text-2xl font-extrabold tabular">{formatPeso(c.subtotal)}</p>
                    <Button onClick={() => navigate(`/checkout/${c.cartId}`)}>Check out</Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
