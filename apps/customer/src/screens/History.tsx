import { apiData, type HistoryEntry } from '@gcash/shared';
import { Button, EmptyState, ErrorState, formatManilaDateTime, formatPeso, PointsChip, Skeleton, useAsync } from '@gcash/ui';
import { CircleCheck, History as HistoryIcon, ShoppingBag, Ticket, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AppShell } from '../app/AppShell';
import { useSession } from '../app/session';

const ROW_ICON = {
  EARN: { Icon: ShoppingBag, className: 'bg-success-100 text-success-700' },
  CLAIM: { Icon: Ticket, className: 'bg-danger-100 text-danger-700' },
  REDEEM: { Icon: CircleCheck, className: 'bg-surface-2 text-text-2' },
} as const;

export default function History() {
  const { userId } = useSession();
  const navigate = useNavigate();
  const history = useAsync(() => apiData<HistoryEntry[]>(`/customer/history?userId=${encodeURIComponent(userId ?? '')}`), [userId]);

  return (
    <AppShell back title="Activity History">
      {history.error && !history.data ? (
        <ErrorState message={history.error.message} onRetry={() => void history.reload()} />
      ) : !history.data ? (
        <div className="flex flex-col gap-2" aria-busy aria-label="Loading activity">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-card" />
          ))}
        </div>
      ) : history.data.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No activity yet"
          body="Your first points are one purchase away. Show your member QR at any participating store."
          action={<Button onClick={() => navigate('/dashboard')}>Show my member QR</Button>}
        />
      ) : (
        <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-card bg-surface-1 ring-1 ring-line" aria-label="Transactions, newest first">
          {history.data.map((t) => (
            <Row key={t.transactionId} t={t} />
          ))}
        </ol>
      )}
    </AppShell>
  );
}

function Row({ t }: { t: HistoryEntry }) {
  const { Icon, className } = ROW_ICON[t.type];
  const when = formatManilaDateTime(t.timestamp);
  // PRD C-5: earn rows lead with the merchant; burn rows with the action
  const title = t.type === 'EARN' ? (t.merchantName ?? 'Purchase') : t.description;
  const detail = t.type === 'EARN' && t.grossAmount !== null ? `Spend ${formatPeso(t.grossAmount)} · ${when}` : when;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full ${className}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{title}</p>
        <p className="mt-0.5 text-xs text-text-2">
          <time dateTime={t.timestamp}>{detail}</time>
        </p>
        {t.type === 'EARN' && !!t.bonusPoints && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-promo-100 px-2 py-0.5 text-xs font-bold text-promo-700">
            <Zap className="size-3" aria-hidden />
            incl. +{t.bonusPoints.toLocaleString('en-PH')} bonus{t.campaignNames?.length ? ` · ${t.campaignNames.join(', ')}` : ''}
          </p>
        )}
      </div>
      {t.type === 'REDEEM' ? (
        <span className="mt-1 shrink-0 text-xs font-semibold text-text-2">Voucher used</span>
      ) : (
        <PointsChip points={t.pointsAmount} size="sm" tone={t.type === 'EARN' ? 'earn' : 'burn'} className="mt-1 shrink-0" />
      )}
    </li>
  );
}
