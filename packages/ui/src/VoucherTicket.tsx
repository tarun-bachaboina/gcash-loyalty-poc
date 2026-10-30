import { CircleCheck, Clock, QrCode, Ticket, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Button } from './Button';
import { formatPeso } from './format';
import { SpacePanel } from './SpacePanel';

export type VoucherTicketStatus = 'active' | 'used' | 'expired';

interface VoucherTicketProps {
  title: string;
  voucherId: string;
  /** Where to present it, e.g. "Ayala Malls Cinema". */
  merchantName: string;
  discountAmount: number;
  validUntil: string; // YYYY-MM-DD
  status: VoucherTicketStatus;
  redeemedAt?: string; // YYYY-MM-DD HH:mm
  redeemedStore?: string;
  icon?: LucideIcon;
  onViewQr?: () => void;
  /** Play the stamp animation (when a voucher flips to used while on screen). */
  animateStamp?: boolean;
}

// Height of the space stub; the perforation and side notches sit on this line.
const TOP = 112;
const NOTCH = 12;

const notchMask = [
  `radial-gradient(circle ${NOTCH}px at 0 ${TOP}px, #0000 98%, #000) left / 51% 100% no-repeat`,
  `radial-gradient(circle ${NOTCH}px at 100% ${TOP}px, #0000 98%, #000) right / 51% 100% no-repeat`,
].join(', ');

const STATUS: Record<VoucherTicketStatus, { label: string; className: string; Icon: LucideIcon }> = {
  active: { label: 'Active', className: 'bg-success-100 text-success-700', Icon: CircleCheck },
  used: { label: 'Redeemed', className: 'bg-surface-2 text-text-2', Icon: CircleCheck },
  expired: { label: 'Expired', className: 'bg-danger-100 text-danger-700', Icon: Clock },
};

/** Boarding-pass voucher: space stub with holo strip on top, light working half below. */
export function VoucherTicket({
  title,
  voucherId,
  merchantName,
  discountAmount,
  validUntil,
  status,
  redeemedAt,
  redeemedStore,
  icon: Icon = Ticket,
  onViewQr,
  animateStamp = false,
}: VoucherTicketProps) {
  const s = STATUS[status];
  const muted = status !== 'active';

  return (
    // drop-shadow (not box-shadow) so the elevation follows the notched outline
    <div style={{ filter: 'drop-shadow(0 1px 2px rgb(1 36 92 / .1)) drop-shadow(0 8px 18px rgb(1 36 92 / .12))' }}>
      <article
        aria-label={`${title}, ${s.label}`}
        className="overflow-hidden rounded-card bg-surface-1"
        style={{ WebkitMask: notchMask, mask: notchMask } as CSSProperties}
      >
        <SpacePanel tone={muted ? 'brand' : 'gold'} edge={false} drift={false} grid={false} className={muted ? 'grayscale' : ''} style={{ height: TOP }}>
          {/* Stub strip: gold while the voucher is live */}
          <div aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${muted ? 'bg-on-space-muted/40' : 'bg-gold-500'}`} />
          <div className="flex h-full items-center gap-3 pr-4 pl-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-card bg-white/10">
              <Icon className="size-6 text-white" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-display text-lg leading-tight font-extrabold tracking-tight text-on-space">{title}</h3>
              <p className="mt-0.5 truncate text-xs text-on-space-muted">Use at {merchantName}</p>
            </div>
            <p className={`font-display text-3xl font-extrabold tracking-tight tabular ${muted ? 'text-on-space-muted' : 'text-gold-300'}`}>
              {formatPeso(discountAmount).replace('.00', '')}
            </p>
          </div>
        </SpacePanel>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5 pb-4 text-text-1">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-text-2">Code</p>
            <p className="font-mono text-sm font-semibold tracking-wide">{voucherId}</p>
            <p className={`text-xs ${status === 'expired' ? 'font-semibold text-danger-700' : 'text-text-2'}`}>
              {status === 'expired' ? `Expired on ${validUntil}` : status === 'used' ? `Used at ${redeemedStore ?? merchantName}` : `Valid until ${validUntil}`}
            </p>
          </div>
          {status === 'used' && redeemedAt ? (
            // A used ticket carries a "Redeemed" stamp in place of the status pill
            <motion.div
              initial={animateStamp ? { opacity: 0, scale: 1.6, rotate: -8 } : false}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="rounded-md border-2 border-success-600 px-2 py-0.5 text-center text-success-700"
            >
              <span className="block text-xs font-extrabold tracking-wider uppercase">Redeemed</span>
              <span className="block text-[0.65rem] font-semibold">{redeemedAt}</span>
            </motion.div>
          ) : (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.className}`}>
              <s.Icon className="size-3.5" aria-hidden />
              {s.label}
            </span>
          )}
          {status === 'active' && onViewQr && (
            <Button onClick={onViewQr} fullWidth icon={<QrCode className="size-4" aria-hidden />}>
              View Voucher QR Code
            </Button>
          )}
        </div>
      </article>
    </div>
  );
}
