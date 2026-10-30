import { apiData, apiRequest, ApiRequestError, type ClaimResponse, type Reward, type RewardCategory } from '@gcash/shared';
import { Button, Dialog, EmptyState, ErrorState, InlineError, PointsChip, RewardTile, Skeleton, Tabs, useAsync, type TabItem } from '@gcash/ui';
import { Gift, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { useSession } from '../app/session';
import { sponsorLine, useMerchants } from '../app/useMerchants';

type Filter = 'all' | 'cinema' | 'parking' | 'food' | 'retail';

// PRD C-3 filter tabs → reward categories, plus a Retail tab for store rewards (CLAUDE.md decision 5)
// Tab order follows key order: Retail sits right after All Rewards (user request)
const FILTERS: Record<Filter, { label: string; category?: RewardCategory }> = {
  all: { label: 'All Rewards' },
  retail: { label: 'Retail', category: 'Retail' },
  cinema: { label: 'Cinema', category: 'Entertainment' },
  parking: { label: 'Parking', category: 'Parking' },
  food: { label: 'Food & Dining', category: 'Food & Dining' },
};

export default function Catalog() {
  const { userId, profile, refreshProfile } = useSession();
  const navigate = useNavigate();
  const rewards = useAsync(() => apiData<Reward[]>('/customer/rewards'), []);
  const { byId } = useMerchants();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Reward | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string>();

  const balance = profile?.pointsBalance ?? 0;
  // The balance can drop while the sheet is open (points spent elsewhere): never show a negative remainder
  const shortBy = selected ? Math.max(0, selected.pointsRequired - balance) : 0;
  const list = (rewards.data ?? [])
    .filter((r) => !FILTERS[filter].category || r.category === FILTERS[filter].category)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);

  const tabs: TabItem<Filter>[] = (Object.keys(FILTERS) as Filter[]).map((id) => ({ id, label: FILTERS[id].label }));

  function openClaim(r: Reward) {
    setClaimError(undefined);
    setSelected(r);
  }

  async function confirmClaim() {
    if (!selected || !userId) return;
    setClaiming(true);
    setClaimError(undefined);
    try {
      const res = await apiRequest<ClaimResponse>('/customer/vouchers/claim', { body: { userId, rewardId: selected.rewardId } });
      await refreshProfile();
      // PRD C-3: on success navigate to My Vouchers, where the claim moment plays
      navigate('/vouchers', { state: { claimed: res.voucher, pointsUsed: selected.pointsRequired, newBalance: res.newPointsBalance } });
    } catch (err) {
      setClaimError(err instanceof ApiRequestError ? err.message : 'Could not claim this voucher. Try again.');
      if (err instanceof ApiRequestError && ['INSUFFICIENT_POINTS', 'OUT_OF_STOCK', 'REWARD_UNAVAILABLE'].includes(err.code)) {
        void refreshProfile();
        void rewards.reload();
      }
      setClaiming(false);
    }
  }

  return (
    <AppShell back title="Mall Rewards Catalog">
      <div className="mb-4 flex items-center justify-between rounded-card bg-surface-1 px-4 py-3 ring-1 ring-line">
        <span className="text-sm font-semibold text-text-2">Your balance</span>
        {profile ? <PointsChip points={balance} size="md" /> : <Skeleton className="h-5 w-20" />}
      </div>

      <Tabs tabs={tabs} value={filter} onChange={setFilter} label="Filter rewards" className="mb-4" />

      <div role="tabpanel" aria-label={FILTERS[filter].label}>
        {rewards.error && !rewards.data ? (
          <ErrorState message={rewards.error.message} onRetry={() => void rewards.reload()} />
        ) : !rewards.data ? (
          <div className="grid grid-cols-2 gap-3" aria-busy aria-label="Loading rewards">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-card" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={`No ${filter === 'all' ? '' : `${FILTERS[filter].label} `}rewards right now`}
            body={filter === 'all' ? 'The mall team is stocking new rewards. Check back soon.' : 'Check All Rewards for other treats you can claim.'}
            action={filter !== 'all' ? <Button variant="secondary" onClick={() => setFilter('all')}>See All Rewards</Button> : undefined}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {list.map((r) => (
              <li key={r.rewardId} className="flex">
                <div className="w-full">
                  <RewardTile
                    title={r.title}
                    sponsor={sponsorLine(r, byId)}
                    category={r.category}
                    pointsRequired={r.pointsRequired}
                    balance={balance}
                    soldOut={r.stockQuantity < 1}
                    onClaim={() => openClaim(r)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        busy={claiming}
        title="Claim this voucher?"
        description="Points are deducted now. The voucher appears in My Vouchers."
        footer={
          <>
            <Button size="lg" onClick={confirmClaim} disabled={claiming || shortBy > 0} icon={claiming ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : undefined}>
              {claiming ? 'Claiming…' : 'Confirm Claim'}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={claiming}>
              Cancel
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <dl className="divide-y divide-line rounded-card bg-surface-2 px-4">
              <Row label="Reward">
                <span className="text-right font-bold">{selected.title}</span>
              </Row>
              {selected.termsText && (
                <Row label="Terms">
                  <span className="block max-w-56 text-right text-xs text-text-2">{selected.termsText}</span>
                </Row>
              )}
              <Row label="Points cost">
                <PointsChip points={selected.pointsRequired} size="sm" tone="burn" />
              </Row>
              <Row label="New remaining balance">
                {shortBy > 0 ? (
                  <span className="text-sm font-bold text-danger-700">Need {shortBy.toLocaleString('en-PH')} more points</span>
                ) : (
                  <PointsChip points={balance - selected.pointsRequired} size="sm" />
                )}
              </Row>
            </dl>
            {claimError && (
              <div className="mt-3">
                <InlineError>{claimError}</InlineError>
              </div>
            )}
          </>
        )}
      </Dialog>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
