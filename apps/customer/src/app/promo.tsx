import { manilaDate, type CampaignView, type Merchant } from '@gcash/shared';
import { Dialog, formatPoints } from '@gcash/ui';
import { CalendarDays, MapPin, QrCode, Zap } from 'lucide-react';

const dayFmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2× points" / "+20 pts": the promo's headline perk. */
export const perk = (c: CampaignView) => (c.multiplier ? `${c.multiplier}× points` : `+${formatPoints(c.flatBonus ?? 0)} pts`);

/** Last day the promo ran (ended early → the day it was ended). */
const lastDay = (c: CampaignView) => (c.endedAt ? manilaDate(c.endedAt) : c.endDate);

/** "Until Nov 29" / "Starts Nov 5" / "Ended Oct 4" */
export function when(c: CampaignView) {
  if (c.displayStatus === 'SCHEDULED') return `Starts ${dayFmt(c.startDate)}`;
  if (c.displayStatus === 'ENDED') return `Ended ${dayFmt(lastDay(c))}`;
  return `Until ${dayFmt(c.endDate)}`;
}

export function PromoBadge({ c }: { c: CampaignView }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-promo-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-promo-700">
      <Zap className="size-3.5" aria-hidden />
      {perk(c)}
    </span>
  );
}

/** A promo as a tappable card. Ended promos are greyed out but still readable. */
export function PromoCard({ c, onOpen, compact }: { c: CampaignView; onOpen: () => void; compact?: boolean }) {
  const ended = c.displayStatus === 'ENDED';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${c.name} at ${c.merchantName}: ${perk(c)}, ${when(c)}`}
      className={`flex h-full w-full flex-col items-start gap-1.5 rounded-card bg-surface-1 p-4 text-left shadow-e1 ring-1 ring-line transition duration-150 hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-brand ${ended ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <PromoBadge c={c} />
        <span className={`text-xs font-semibold ${c.displayStatus === 'LIVE' ? 'text-success-700' : 'text-text-2'}`}>{when(c)}</span>
      </div>
      <p className="mt-1 font-display text-base leading-tight font-bold">{c.name}</p>
      <p className="text-xs font-semibold text-text-2">{c.merchantName}</p>
      {!compact && <p className="text-sm text-text-2">{c.mechanics}</p>}
    </button>
  );
}

/** Promo details: mechanics, store, valid from/until, T&Cs, and how to get the bonus. */
export function PromoDetail({ c, merchant, onClose }: { c: CampaignView | null; merchant?: Merchant; onClose: () => void }) {
  return (
    <Dialog open={!!c} onClose={onClose} title={c?.name ?? ''} description={c ? `${c.merchantName}${merchant?.location ? ` · ${merchant.location}` : ''}` : undefined}>
      {c && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PromoBadge c={c} />
            {c.displayStatus === 'LIVE' && <span className="rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-bold text-success-700">Live now</span>}
            {c.displayStatus === 'SCHEDULED' && <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Coming soon</span>}
            {c.displayStatus === 'ENDED' && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-text-2">Ended</span>}
          </div>
          <p className="font-display text-lg leading-snug font-bold">{c.mechanics}</p>
          <dl className="divide-y divide-line rounded-card bg-surface-2 px-4 text-sm">
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-text-2">
                <CalendarDays className="size-4" aria-hidden />
                Valid
              </dt>
              <dd className="text-right font-semibold">
                {dayFmt(c.startDate)} – {dayFmt(c.displayStatus === 'ENDED' ? lastDay(c) : c.endDate)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-text-2">
                <MapPin className="size-4" aria-hidden />
                Where
              </dt>
              <dd className="text-right font-semibold">{c.merchantName}{merchant?.location ? <span className="block text-xs font-normal text-text-2">{merchant.location}</span> : null}</dd>
            </div>
          </dl>
          {c.displayStatus === 'ENDED' ? (
            <p className="text-sm text-text-2">This promo ended on {dayFmt(lastDay(c))}. Keep an eye on Promos for the next one.</p>
          ) : (
            <p className="flex gap-2 rounded-card bg-brand-soft px-3 py-2.5 text-sm text-brand">
              <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden />
              {c.displayStatus === 'SCHEDULED' ? `From ${dayFmt(c.startDate)}, show` : 'Show'} your member QR at the {c.merchantName} counter. The bonus is added automatically.
            </p>
          )}
          <section>
            <h3 className="text-sm font-bold">Terms & conditions</h3>
            <p className="mt-1 text-sm whitespace-pre-line text-text-2">{c.terms}</p>
          </section>
        </div>
      )}
    </Dialog>
  );
}
