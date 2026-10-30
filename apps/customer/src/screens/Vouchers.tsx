import { apiData, type Voucher } from '@gcash/shared';
import { Button, Dialog, EmptyState, ErrorState, formatManilaDateTime, RewardMoment, Skeleton, Tabs, useAsync, VoucherTicket, type TabItem } from '@gcash/ui';
import { Car, CircleCheck, Film, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { useSession } from '../app/session';
import { redeemAt, useMerchants } from '../app/useMerchants';

type Tab = 'active' | 'past';

interface ClaimedState {
  claimed: Voucher;
  pointsUsed: number;
  newBalance: number;
}

const ICON_BY_PREFIX: Record<string, LucideIcon> = { CINEMA: Film, PARK: Car, FOOD: UtensilsCrossed, RETAIL: ShoppingBag };
const voucherIcon = (v: Voucher) => ICON_BY_PREFIX[v.voucherId.split('-')[1]] ?? Ticket;

export default function Vouchers() {
  const { userId } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const vouchers = useAsync(() => apiData<Voucher[]>(`/customer/vouchers?userId=${encodeURIComponent(userId ?? '')}`), [userId]);
  const { byId } = useMerchants();
  const [tab, setTab] = useState<Tab>('active');
  const [qrFor, setQrFor] = useState<Voucher | null>(null);
  const claimState = location.state as ClaimedState | null;
  const [moment, setMoment] = useState<ClaimedState | null>(claimState?.claimed ? claimState : null);

  const all = vouchers.data ?? [];
  const active = all.filter((v) => v.status === 'ACTIVE').sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  const past = all
    .filter((v) => v.status !== 'ACTIVE')
    .sort((a, b) => (b.redeemedAt ?? b.claimedAt).localeCompare(a.redeemedAt ?? a.claimedAt));
  const shown = tab === 'active' ? active : past;
  const tabs: TabItem<Tab>[] = [
    { id: 'active', label: 'Active Vouchers', count: vouchers.data ? active.length : undefined },
    { id: 'past', label: 'Redeemed / Expired', count: vouchers.data ? past.length : undefined },
  ];

  function closeMoment() {
    setMoment(null);
    // Drop the router state so a refresh doesn't look like a fresh claim
    navigate('.', { replace: true, state: null });
  }

  function ticket(v: Voucher, onViewQr?: () => void) {
    return (
      <VoucherTicket
        title={v.title}
        voucherId={v.voucherId}
        merchantName={redeemAt(v, byId)}
        discountAmount={v.discountAmount}
        validUntil={v.validUntil}
        status={v.status === 'ACTIVE' ? 'active' : v.status === 'REDEEMED' ? 'used' : 'expired'}
        redeemedAt={v.redeemedAt ? formatManilaDateTime(v.redeemedAt) : undefined}
        redeemedStore={v.redeemedMerchantId ? byId.get(v.redeemedMerchantId)?.name : undefined}
        icon={voucherIcon(v)}
        onViewQr={onViewQr}
      />
    );
  }

  return (
    <AppShell back title="My Vouchers">
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Voucher status" className="mb-4" />

      <div role="tabpanel" aria-label={tab === 'active' ? 'Active Vouchers' : 'Redeemed or expired vouchers'}>
        {vouchers.error && !vouchers.data ? (
          <ErrorState message={vouchers.error.message} onRetry={() => void vouchers.reload()} />
        ) : !vouchers.data ? (
          <div className="flex flex-col gap-4" aria-busy aria-label="Loading vouchers">
            <Skeleton className="h-56 rounded-card" />
            <Skeleton className="h-56 rounded-card" />
          </div>
        ) : shown.length === 0 ? (
          tab === 'active' ? (
            <EmptyState
              icon={Ticket}
              title="No active vouchers yet"
              body="Claim a reward with your points and it lands here, ready to show at the counter."
              action={<Button onClick={() => navigate('/catalog')}>Browse Rewards</Button>}
            />
          ) : (
            <EmptyState icon={CircleCheck} title="Nothing here yet" body="Vouchers you've used or that have expired will show up here." />
          )
        ) : (
          <ul className="flex flex-col gap-4">
            {shown.map((v) => (
              <li key={v.voucherId}>
                {ticket(v, () => setQrFor(v))}
                {v.termsText && v.status === 'ACTIVE' && <p className="mt-1.5 px-1 text-xs text-text-2">{v.termsText}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* C-4 Voucher Detail Modal */}
      <Dialog open={!!qrFor} onClose={() => setQrFor(null)} title={qrFor?.title ?? ''}>
        {qrFor && (
          <div className="flex flex-col items-center text-center">
            <div className="rounded-card bg-white p-3 ring-1 ring-line">
              <QRCodeSVG value={qrFor.voucherCode} size={232} level="M" bgColor="#FFFFFF" fgColor="#0A2757" title={`Voucher QR code ${qrFor.voucherCode}`} />
            </div>
            <p className="mt-2 font-mono text-sm font-semibold tracking-wider">{qrFor.voucherId}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 text-xs font-bold text-success-700">
              <CircleCheck className="size-3.5" aria-hidden />
              Active
            </span>
            <p className="mt-4 text-sm">
              Present this QR code to the cashier at <strong>{redeemAt(qrFor, byId)}</strong> to apply discount.
            </p>
            <p className="mt-1 text-xs text-text-2">{qrFor.termsText ?? `Valid until ${qrFor.validUntil}`}</p>
          </div>
        )}
      </Dialog>

      {/* The claim flow's one reward moment (T3) */}
      {moment && (
        <RewardMoment
          open
          onClose={closeMoment}
          celebrationKey={`claim:${moment.claimed.voucherId}`}
          object={<div className="w-full text-left">{ticket(moment.claimed)}</div>}
          title="Voucher claimed!"
          message={`${moment.claimed.title} is now in My Vouchers. ${moment.pointsUsed.toLocaleString('en-PH')} PTS used · New balance ${moment.newBalance.toLocaleString('en-PH')} PTS.`}
          primaryAction={{
            label: 'View Voucher QR Code',
            onClick: () => {
              const v = moment.claimed;
              closeMoment();
              setTab('active');
              setQrFor(v);
            },
          }}
          secondaryAction={{ label: 'Done', onClick: closeMoment }}
        />
      )}
    </AppShell>
  );
}
