import type { CampaignDisplayStatus, RewardStatus } from '@gcash/shared';
import { CircleCheck, CircleDashed, CircleOff, CirclePause, CircleX, Clock, Radio, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Status pills for campaigns and rewards (merchant portal + admin console). Colour always pairs with an icon + label.
export type PillTone = 'success' | 'brand' | 'neutral' | 'danger' | 'promo';

const TONE: Record<PillTone, string> = {
  success: 'bg-success-100 text-success-700',
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-2 text-text-2',
  danger: 'bg-danger-100 text-danger-700',
  promo: 'bg-promo-100 text-promo-700',
};

export function Pill({ tone, icon: Icon, children }: { tone: PillTone; icon: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TONE[tone]}`}>
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

const CAMPAIGN_PILL: Record<CampaignDisplayStatus, [PillTone, LucideIcon, string]> = {
  PENDING: ['brand', Clock, 'Pending approval'],
  SCHEDULED: ['brand', CircleDashed, 'Scheduled'],
  LIVE: ['success', Radio, 'Live'],
  ENDED: ['neutral', CircleOff, 'Ended'],
  REJECTED: ['danger', CircleX, 'Rejected'],
  WITHDRAWN: ['neutral', CircleOff, 'Withdrawn'],
};

export function CampaignPill({ status }: { status: CampaignDisplayStatus }) {
  const [tone, icon, label] = CAMPAIGN_PILL[status];
  return (
    <Pill tone={tone} icon={icon}>
      {label}
    </Pill>
  );
}

const REWARD_PILL: Record<RewardStatus | 'EXPIRED', [PillTone, LucideIcon, string]> = {
  PENDING: ['brand', Clock, 'Pending approval'],
  ACTIVE: ['success', CircleCheck, 'Active'],
  PAUSED: ['neutral', CirclePause, 'Paused'],
  REJECTED: ['danger', CircleX, 'Rejected'],
  WITHDRAWN: ['neutral', CircleOff, 'Withdrawn'],
  EXPIRED: ['neutral', CircleOff, 'Expired'],
};

export function RewardPill({ status }: { status: RewardStatus | 'EXPIRED' }) {
  const [tone, icon, label] = REWARD_PILL[status];
  return (
    <Pill tone={tone} icon={icon}>
      {label}
    </Pill>
  );
}

