import { apiData, humanMemberId, memberQrPayload, type CampaignView, type Reward, type User } from '@gcash/shared';
import { Button, CATEGORY_ICON, Dialog, ErrorState, PointsChip, ProgressRing, SpacePanel, useAsync } from '@gcash/ui';
import { ChevronRight, Gift, History, QrCode, RotateCw, Ticket, Users, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { PromoCard, PromoDetail } from '../app/promo';
import { useSession } from '../app/session';
import { useMerchants } from '../app/useMerchants';

const lastSeenKey = (userId: string) => `gcash:customer:lastBalance:${userId}`;
// The QR is always dark-on-white so scanners read it in either theme: GCash text-primary.
const QR_INK = '#0A2757';

/** Balance the user last saw, so a higher balance counts up on arrival. Tracked per user. */
function useLastSeenBalance(user: User | undefined) {
  const [seen, setSeen] = useState<{ userId: string; from: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    let stored: number | null = null;
    try {
      const raw = localStorage.getItem(lastSeenKey(user.userId));
      stored = raw === null ? null : Number(raw);
    } catch {
      /* no storage: just show the balance */
    }
    setSeen((prev) =>
      prev?.userId === user.userId ? prev : { userId: user.userId, from: stored !== null && Number.isFinite(stored) ? stored : user.pointsBalance },
    );
    try {
      localStorage.setItem(lastSeenKey(user.userId), String(user.pointsBalance));
    } catch {
      /* ignore */
    }
  }, [user]);
  return user && seen?.userId === user.userId ? seen.from : null;
}

export default function Dashboard() {
  const { profile, program, profileError, profileLoading, refreshProfile, signOut } = useSession();
  const navigate = useNavigate();
  const rewards = useAsync(() => apiData<Reward[]>('/customer/rewards'), []);
  const promos = useAsync(() => apiData<CampaignView[]>('/customer/promos'), []);
  const [qrOpen, setQrOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [promo, setPromo] = useState<CampaignView | null>(null);
  const { byId } = useMerchants();
  const from = useLastSeenBalance(profile);
  const live = (promos.data ?? []).filter((c) => c.displayStatus === 'LIVE');

  function switchUser() {
    setSwitchOpen(false);
    signOut();
    navigate('/login');
  }

  return (
    <AppShell
      headerAction={
        <button type="button" onClick={() => setSwitchOpen(true)} aria-label="Switch user" title="Switch user" className="grid size-11 place-items-center rounded-full hover:bg-white/12">
          <Users className="size-5" aria-hidden />
        </button>
      }
      bottomBar={<QuickActions />}
    >
      {profileError && !profile ? (
        <ErrorState message={profileError.message} onRetry={() => void Promise.all([refreshProfile(), rewards.reload()])} />
      ) : !profile || from === null ? (
        <HeroSkeleton />
      ) : (
        <>
          <BalanceHero
            user={profile}
            from={from}
            pointValue={program?.pointMonetaryValue ?? 1}
            mallName={program?.mallName ?? 'Ayala Mall Manila Bay'}
            rewards={rewards}
            refreshing={profileLoading}
          />
          <MemberQrCard user={profile} onShow={() => setQrOpen(true)} />
          {live.length > 0 && <LiveNow promos={live} onOpen={setPromo} />}
          <PromoDetail c={promo} merchant={promo ? byId.get(promo.merchantId) : undefined} onClose={() => setPromo(null)} />
          <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title="Show this to the cashier" description="The cashier scans it to add points for this purchase.">
            <QrBlock payload={memberQrPayload(profile.userId)} size={248} label={humanMemberId(profile)} />
          </Dialog>
        </>
      )}
      <Dialog
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        title="Switch user?"
        description="You'll go back to the user picker. Your points stay on this account."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setSwitchOpen(false)}>
              Cancel
            </Button>
            <Button fullWidth onClick={switchUser}>
              Switch user
            </Button>
          </div>
        }
      />
    </AppShell>
  );
}

type RewardsState = { data?: Reward[]; error?: Error | null; loading?: boolean; reload: () => unknown };

function BalanceHero({ user, from, pointValue, mallName, rewards, refreshing }: { user: User; from: number; pointValue: number; mallName: string; rewards: RewardsState; refreshing: boolean }) {
  const gained = user.pointsBalance - from;
  const target = nextTarget(user.pointsBalance, rewards.data);
  const fmt = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SpacePanel tone="gold" className="rounded-hero p-5" aria-busy={refreshing}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-display text-lg font-extrabold tracking-tight">{user.name}</h1>
        <TierBadge tier={user.tier} />
      </div>

      <div className="mt-4">
        <p>
          <span className="sr-only">Current points balance: </span>
          <PointsChip points={user.pointsBalance} size="xl" onSpace animate={gained !== 0} from={from} announce />
        </p>
        <p className="mt-2 text-sm font-semibold text-on-space tabular">Worth ₱{fmt(user.pointsBalance * pointValue)} in rewards</p>
        <p className="mt-0.5 text-xs text-on-space-muted">
          1 Point = ₱{fmt(pointValue)} Value at {mallName}
        </p>
        {gained > 0 && (
          <p className="mt-3 inline-flex items-center rounded-full bg-on-space-success/15 px-2.5 py-1 text-xs font-bold text-on-space-success">
            +{gained.toLocaleString('en-PH')} PTS since your last visit
          </p>
        )}
      </div>

      <div className="mt-5 min-h-[76px]">
        {rewards.error && !rewards.data ? (
          <div className="flex items-center justify-between gap-3 rounded-card bg-white/8 p-3 ring-1 ring-white/12">
            <p className="text-sm text-on-space">Couldn't load rewards.</p>
            <Button variant="inverse" onClick={() => void rewards.reload()} icon={<RotateCw className="size-4" aria-hidden />}>
              Retry
            </Button>
          </div>
        ) : !rewards.data ? (
          <div aria-hidden className="h-[76px] rounded-card bg-white/8 motion-safe:animate-pulse" />
        ) : (
          target && (
            <Link to="/catalog" className="flex items-center gap-2 rounded-card bg-white/8 p-3 ring-1 ring-white/12 transition-colors duration-150 hover:bg-white/12">
              <ProgressRing value={target.value} max={target.max} size={52} stroke={5} onSpace label={target.label} caption={target.caption} className="min-w-0 flex-1">
                <target.Icon className="size-5 text-on-space" aria-hidden />
              </ProgressRing>
              <ChevronRight className="size-5 shrink-0 text-on-space-muted" aria-hidden />
            </Link>
          )
        )}
      </div>
    </SpacePanel>
  );
}

/**
 * What the balance can do. If anything is claimable, lead with that (and the most valuable reward in reach);
 * the next out-of-reach reward becomes the caption. Otherwise, progress to the cheapest reward still out of reach.
 */
function nextTarget(balance: number, rewards?: Reward[]) {
  const available = (rewards ?? []).filter((r) => r.stockQuantity > 0).sort((a, b) => a.pointsRequired - b.pointsRequired);
  if (!available.length) return null;
  const claimable = available.filter((r) => r.pointsRequired <= balance);
  const next = available.find((r) => r.pointsRequired > balance);
  const toNext = next ? `${(next.pointsRequired - balance).toLocaleString('en-PH')} pts to ${next.title}` : undefined;

  if (claimable.length) {
    const best = claimable[claimable.length - 1];
    const n = claimable.length;
    return {
      value: next ? balance : 1,
      max: next ? next.pointsRequired : 1,
      label: n === 1 ? `You can claim ${best.title} now` : `You can claim ${n} rewards now`,
      caption: n === 1 ? toNext : `Top pick: ${best.title}`,
      Icon: Gift,
    };
  }
  return { value: balance, max: next!.pointsRequired, label: toNext!, caption: undefined, Icon: CATEGORY_ICON[next!.category] };
}

function TierBadge({ tier }: { tier: User['tier'] }) {
  return tier === 'VIP' ? (
    <span className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-bold text-gold-300 ring-1 ring-gold-300/60">VIP</span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-on-space ring-1 ring-white/15">Member</span>
  );
}

/** v2: live store promos, so the next visit feels worth more. A working surface, not a second hero. */
function LiveNow({ promos, onOpen }: { promos: CampaignView[]; onOpen: (c: CampaignView) => void }) {
  return (
    <section aria-labelledby="live-now" className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="live-now" className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
          <Zap className="size-4 text-promo-700" aria-hidden />
          Live now: extra points
        </h2>
        <Link to="/promos" className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-sm font-bold text-brand hover:bg-brand-soft">
          All promos
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {promos.map((c) => (
          <li key={c.campaignId} className="w-60 shrink-0 snap-start">
            <PromoCard c={c} onOpen={() => onOpen(c)} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** PRD C-2: the QR is prominently displayed, on a calm working surface (the balance is the hero). */
function MemberQrCard({ user, onShow }: { user: User; onShow: () => void }) {
  return (
    <section aria-labelledby="member-qr" className="mt-4 rounded-card bg-surface-1 p-4 shadow-e1 ring-1 ring-line">
      <h2 id="member-qr" className="text-base font-extrabold tracking-tight">
        Your member QR
      </h2>
      <p className="text-xs text-text-2">One QR earns points at every participating store.</p>
      <div className="mt-3 flex justify-center">
        <QrBlock payload={memberQrPayload(user.userId)} size={176} label={humanMemberId(user)} />
      </div>
      <Button fullWidth className="mt-4" onClick={onShow} icon={<QrCode className="size-5" aria-hidden />}>
        Show QR to Cashier to Earn Points
      </Button>
    </section>
  );
}

/** QR always on white so scanners read it in dark mode too. */
function QrBlock({ payload, size, label }: { payload: string; size: number; label: string }) {
  return (
    <figure className="flex flex-col items-center">
      <div className="rounded-card bg-white p-3 ring-1 ring-line">
        <QRCodeSVG value={payload} size={size} level="M" bgColor="#FFFFFF" fgColor={QR_INK} title={`Member QR code ${payload}`} />
      </div>
      <figcaption className="mt-2 font-mono text-sm font-semibold tracking-wider">{label}</figcaption>
    </figure>
  );
}

function QuickActions() {
  const items = [
    { to: '/catalog', label: 'Browse Rewards', Icon: Gift },
    { to: '/vouchers', label: 'My Vouchers', Icon: Ticket },
    { to: '/promos', label: 'Promos', Icon: Zap },
    { to: '/history', label: 'Activity History', Icon: History },
  ];
  return (
    // Icons sit on one line; labels centre under them and wrap to at most two balanced lines.
    <ul className="grid grid-cols-4 gap-1">
      {items.map(({ to, label, Icon }) => (
        <li key={to} className="flex">
          <Link to={to} className="flex min-h-14 w-full flex-col items-center justify-start gap-1 rounded-card px-1 py-2 text-center text-xs leading-tight font-bold text-text-1 transition-colors duration-150 hover:bg-brand-soft hover:text-brand">
            <Icon className="size-5 shrink-0 text-brand" aria-hidden />
            <span className="text-balance">{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HeroSkeleton() {
  return (
    <div aria-busy aria-label="Loading your balance">
      <SpacePanel drift={false} className="rounded-hero p-5">
        <div className="h-6 w-40 rounded bg-white/15 motion-safe:animate-pulse" />
        <div className="mt-5 h-12 w-36 rounded bg-white/15 motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-48 rounded bg-white/10 motion-safe:animate-pulse" />
        <div className="mt-5 h-[76px] rounded-card bg-white/8 motion-safe:animate-pulse" />
      </SpacePanel>
      <div className="mt-4 h-[372px] rounded-card bg-surface-2 motion-safe:animate-pulse" />
    </div>
  );
}
