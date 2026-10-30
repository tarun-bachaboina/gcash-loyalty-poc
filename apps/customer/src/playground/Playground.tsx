import {
  Button,
  Coin,
  PointsChip,
  ProgressRing,
  RewardMoment,
  RewardTile,
  SpacePanel,
  TierCard,
  useMotionPref,
  VoucherTicket,
  type MotionPref,
  type RewardBeat,
} from '@gcash/ui';
import { Car, Film, Gift, History, RotateCcw, Ticket } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

// Dev-only component playground. URL params for deterministic screenshots:
// ?theme=light|dark  &motion=reduce|full  &moment=earn|claim|tier  &beat=buildup|reveal|payoff|settled
type Theme = 'system' | 'light' | 'dark';
type MomentId = 'earn' | 'claim' | 'tier';

const BALANCE = 125;

export default function Playground() {
  const [params] = useSearchParams();
  const { pref, setPref, reduced } = useMotionPref();
  const [theme, setTheme] = useState<Theme>((params.get('theme') as Theme) ?? 'system');
  const [moment, setMoment] = useState<MomentId | null>((params.get('moment') as MomentId) ?? null);
  const [replay, setReplay] = useState(0);
  const beat = (params.get('beat') as RewardBeat) ?? undefined;

  useEffect(() => {
    const m = params.get('motion') as MotionPref | null;
    if (m) setPref(m);
  }, [params, setPref]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-4 border-b border-line bg-surface-0/95 px-4 py-3 backdrop-blur">
        <h1 className="mr-auto font-display text-xl font-extrabold">Component playground</h1>
        <Segmented label="Theme" value={theme} options={['system', 'light', 'dark']} onChange={setTheme} />
        <Segmented label="Motion" value={pref} options={['system', 'reduce', 'full']} onChange={setPref} />
        <span className="text-xs text-text-2">{reduced ? 'Reduced motion on' : 'Full motion'}</span>
      </div>

      <Section title="Hero composition" note="How the C-2 dashboard hero will look: one SpacePanel hero zone, everything else stays a calm working surface.">
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,400px)_minmax(0,460px)]">
          <SpacePanel tone="gold" className="rounded-hero p-5">
            <p className="text-xs font-bold text-wave-2">Ayala Mall Manila Bay</p>
            <p className="mt-1 font-display text-xl font-bold">Hi, Juan</p>
            <div className="mt-4">
              <PointsChip key={`h${replay}`} points={BALANCE} size="xl" onSpace animate announce />
              <p className="mt-1 text-xs text-on-space-muted">1 Point = ₱1.00 Value at Ayala Mall Manila Bay</p>
            </div>
            <div className="mt-5 rounded-card bg-white/8 ring-1 ring-white/12 p-3">
              <ProgressRing key={`hr${replay}`} value={BALANCE} max={150} size={72} stroke={6} onSpace label="25 pts to Ayala Parking ₱150 Discount">
                <Car className="size-6 text-white" aria-hidden />
              </ProgressRing>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                [Gift, 'Browse Rewards'],
                [Ticket, 'My Vouchers'],
                [History, 'Activity History'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Gift;
                return (
                  <button key={label as string} type="button" className="flex min-h-11 flex-col items-center gap-1.5 rounded-card bg-white/8 ring-1 ring-white/12 px-1 py-3 text-xs font-bold text-white transition duration-150 hover:bg-white/12">
                    <I className="size-5" aria-hidden />
                    {label as string}
                  </button>
                );
              })}
            </div>
          </SpacePanel>
          <TierCard name="Juan Dela Cruz" tier="Member" memberId="USR-001-09171112222" progress={{ value: BALANCE, target: 1000, nextTier: 'VIP' }} />
        </div>
      </Section>

      <Section title="Tokens" note="GCash brand mapped onto the skill's roles. Gold is reserved for points and rewards.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
          {[
            ['brand', 'bg-brand'],
            ['accent', 'bg-accent'],
            ['space-900', 'bg-space-900'],
            ['navy', 'bg-navy'],
            ['console', 'bg-console'],
            ['gold-500', 'bg-gold-500'],
            ['success-500', 'bg-success-500'],
            ['danger-500', 'bg-danger-500'],
            ['promo-500', 'bg-promo-500'],
            ['surface-0', 'bg-surface-0'],
            ['surface-1', 'bg-surface-1'],
            ['surface-2', 'bg-surface-2'],
            ['brand-soft', 'bg-brand-soft'],
            ['gold-100', 'bg-gold-100'],
            ['success-100', 'bg-success-100'],
            ['danger-100', 'bg-danger-100'],
            ['promo-100', 'bg-promo-100'],
          ].map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-chip ring-1 ring-line">
              <div className={`h-12 ${cls}`} />
              <p className="bg-surface-1 px-2 py-1 font-mono text-[0.7rem]">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="PointsChip + CountUp" note="Display face, tabular figures. Earn is green with +, burn is red with − (PRD C-5).">
        <div className="flex flex-wrap items-end gap-6 rounded-card bg-surface-1 p-5 shadow-e1">
          <PointsChip points={50} size="sm" />
          <PointsChip points={125} size="md" />
          <PointsChip points={1250} size="lg" />
          <PointsChip points={50} size="md" tone="earn" />
          <PointsChip points={50} size="md" tone="burn" />
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-card bg-surface-1 p-5 shadow-e1">
          <PointsChip key={replay} points={BALANCE} size="xl" animate announce />
          <ReplayButton onClick={() => setReplay((n) => n + 1)} />
        </div>
      </Section>

      <Section title="ProgressRing" note="Always paired with text naming the target.">
        <div className="flex flex-wrap gap-8 rounded-card bg-surface-1 p-5 shadow-e1">
          <ProgressRing key={`a${replay}`} value={BALANCE} max={150} label="25 pts to Ayala Parking ₱150 Discount">
            <Car className="size-8 text-brand" aria-hidden />
          </ProgressRing>
          <ProgressRing key={`b${replay}`} value={50} max={50} label="You can claim Ayala Cinema ₱50 Off Ticket">
            <Film className="size-8 text-brand" aria-hidden />
          </ProgressRing>
        </div>
      </Section>

      <Section title="RewardTile" note={`Balance ${BALANCE} PTS. Affordable · almost (within 20%) · locked. Labels per PRD C-3.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <RewardTile title="Ayala Cinema ₱50 Off Ticket" sponsor="Ayala Malls Cinema" category="Entertainment" pointsRequired={50} balance={BALANCE} onClaim={() => setMoment('claim')} />
          <RewardTile title="Ayala Parking ₱150 Discount" sponsor="Ayala Malls Parking" category="Parking" pointsRequired={150} balance={BALANCE} />
          <RewardTile title="Food Court ₱500 Feast Token" sponsor="Ayala Malls Food Court" category="Food & Dining" pointsRequired={500} balance={BALANCE} />
        </div>
      </Section>

      <Section title="VoucherTicket" note="Active · used (stamp) · expired (muted + reason). Labels per PRD C-4.">
        <div className="grid gap-5 md:grid-cols-3">
          <VoucherTicket title="₱50 Cinema Voucher" voucherId="VOUCH-CINEMA-8821" merchantName="Ayala Malls Cinema" discountAmount={50} validUntil="2026-12-31" status="active" icon={Film} />
          <VoucherTicket key={`u${replay}`} title="₱100 Parking Voucher" voucherId="VOUCH-PARK-4407" merchantName="Ayala Malls Parking" discountAmount={100} validUntil="2026-12-31" status="used" redeemedAt="2026-10-28 15:00" redeemedStore="Ayala Malls Parking" icon={Car} animateStamp />
          <VoucherTicket title="₱50 Cinema Voucher" voucherId="VOUCH-CINEMA-1290" merchantName="Ayala Malls Cinema" discountAmount={50} validUntil="2026-09-30" status="expired" icon={Film} />
        </div>
      </Section>

      <Section title="TierCard" note="Move the pointer over a card for tilt + sheen (off under reduced motion).">
        <div className="grid gap-6 md:grid-cols-2 lg:max-w-4xl">
          <TierCard name="Juan Dela Cruz" tier="Member" memberId="USR-001-09171112222" progress={{ value: BALANCE, target: 1000, nextTier: 'VIP' }} />
          <TierCard name="Maria Santos" tier="VIP" memberId="USR-002-09183334444" />
        </div>
      </Section>

      <Section title="RewardMoment" note="Build-up → reveal → payoff → settle. Tap anywhere to skip. Reduced motion shows the settled state with a fade.">
        <div className="flex flex-wrap gap-3">
          <DemoButton onClick={() => setMoment('earn')}>Points earned</DemoButton>
          <DemoButton onClick={() => setMoment('claim')}>Voucher claimed</DemoButton>
          <DemoButton onClick={() => setMoment('tier')}>Tier upgrade</DemoButton>
        </div>
      </Section>

      <RewardMoment
        open={moment === 'earn'}
        onClose={() => setMoment(null)}
        initialBeat={beat}
        object={<Coin size={88} />}
        points={{ value: 50, tone: 'earn' }}
        title="You earned 50 points!"
        message="At H&M · ₱5,000.00 spent. 25 pts to your Ayala Parking ₱150 Discount."
        primaryAction={{ label: 'Browse Rewards', onClick: () => setMoment(null) }}
        secondaryAction={{ label: 'Activity History', onClick: () => setMoment(null) }}
      />
      <RewardMoment
        open={moment === 'claim'}
        onClose={() => setMoment(null)}
        initialBeat={beat}
        object={
          <div className="text-left">
            <VoucherTicket title="₱50 Cinema Voucher" voucherId="VOUCH-CINEMA-8821" merchantName="Ayala Malls Cinema" discountAmount={50} validUntil="2026-12-31" status="active" icon={Film} />
          </div>
        }
        title="Voucher claimed!"
        message="Ayala Cinema ₱50 Off Ticket is now in My Vouchers. 50 PTS used · New balance 75 PTS."
        primaryAction={{ label: 'Go to My Vouchers', onClick: () => setMoment(null) }}
        secondaryAction={{ label: 'Keep browsing', onClick: () => setMoment(null) }}
      />
      <RewardMoment
        open={moment === 'tier'}
        onClose={() => setMoment(null)}
        initialBeat={beat}
        object={<TierCard name="Juan Dela Cruz" tier="VIP" memberId="USR-001-09171112222" sweep />}
        title="Welcome to VIP"
        message="You've earned 1,000 lifetime points at Ayala Mall Manila Bay."
        primaryAction={{ label: 'Back to Home', onClick: () => setMoment(null) }}
      />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mb-3 text-sm text-text-2">{note}</p>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1 rounded-full bg-surface-2 p-1 text-xs font-bold">
      <span className="px-2 text-text-2">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-8 rounded-full px-3 capitalize transition-colors duration-150 ${value === o ? 'bg-brand text-on-brand' : 'text-text-1 hover:bg-surface-1'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function DemoButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button onClick={onClick}>{children}</Button>;
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} icon={<RotateCcw className="size-4" aria-hidden />}>
      Replay
    </Button>
  );
}

