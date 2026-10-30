import { apiData, type CampaignView } from '@gcash/shared';
import { Button, EmptyState, ErrorState, Skeleton, useAsync } from '@gcash/ui';
import { Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { PromoCard, PromoDetail } from '../app/promo';
import { useMerchants } from '../app/useMerchants';

/**
 * v2 Promos: store campaigns shoppers can earn bonus points on. Everyday UI with momentum:
 * "my next visit to H&M earns more, and I know exactly until when."
 */
export default function Promos() {
  const navigate = useNavigate();
  const promos = useAsync(() => apiData<CampaignView[]>('/customer/promos'), []);
  const { byId } = useMerchants();
  const [open, setOpen] = useState<CampaignView | null>(null);

  const all = promos.data ?? [];
  const sections = [
    { id: 'live', title: 'Live now', items: all.filter((c) => c.displayStatus === 'LIVE') },
    { id: 'soon', title: 'Coming soon', items: all.filter((c) => c.displayStatus === 'SCHEDULED') },
    { id: 'ended', title: 'Recently ended', items: all.filter((c) => c.displayStatus === 'ENDED') },
  ].filter((s) => s.items.length);

  return (
    <AppShell back title="Promos">
      <p className="-mt-2 mb-4 text-sm text-text-2">Extra points at participating stores. Show your member QR when you pay and the bonus is added automatically.</p>
      {promos.error && !promos.data ? (
        <ErrorState message={promos.error.message} onRetry={() => void promos.reload()} />
      ) : !promos.data ? (
        <div className="flex flex-col gap-3" aria-busy aria-label="Loading promos">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon={Zap} title="No promos right now" body="Stores add new bonus-point promos often. Meanwhile, every ₱100 you spend still earns 1 point." action={<Button onClick={() => navigate('/catalog')}>Browse Rewards</Button>} />
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={`promos-${s.id}`}>
              <h2 id={`promos-${s.id}`} className="text-xs font-bold mb-2 text-text-2">
                {s.title} · {s.items.length}
              </h2>
              <ul className="flex flex-col gap-3">
                {s.items.map((c) => (
                  <li key={c.campaignId}>
                    <PromoCard c={c} onOpen={() => setOpen(c)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <PromoDetail c={open} merchant={open ? byId.get(open.merchantId) : undefined} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
