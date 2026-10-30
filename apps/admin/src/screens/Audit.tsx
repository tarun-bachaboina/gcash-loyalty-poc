import { apiData, BRANCH_LABEL, manilaDate, type AuditRow } from '@gcash/shared';
import { Button, Dialog, EmptyState, ErrorState, formatManilaDateTime, formatPeso, formatPoints, Skeleton, useAsync } from '@gcash/ui';
import { ChevronLeft, ChevronRight, Download, Eye, RefreshCw, Search, SearchX, X, Zap } from 'lucide-react';
import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import { Shell, table } from '../app/Shell';
import { downloadText, toCsv } from '../lib/csv';

const TYPE_LABEL: Record<AuditRow['type'], string> = { EARN: 'Earn', CLAIM: 'Voucher Claim', REDEEM: 'Voucher Redemption' };
const TYPE_CLS: Record<AuditRow['type'], string> = {
  EARN: 'bg-success-100 text-success-700',
  CLAIM: 'bg-gold-100 text-gold-700',
  REDEEM: 'bg-brand-soft text-brand',
};

const branch = (r: AuditRow) => (r.merchantId ? (BRANCH_LABEL[r.merchantId] ?? r.merchantName ?? r.merchantId) : 'Rewards catalog');

const PAGE = 50;

function valueText(r: AuditRow) {
  if (r.type === 'EARN') return `+${formatPoints(r.pointsAmount)} PTS`;
  if (r.type === 'CLAIM') return `−${formatPoints(-r.pointsAmount)} PTS · ${formatPeso(r.voucherValue ?? 0)} voucher`;
  return `${formatPeso(r.voucherValue ?? 0)} voucher`;
}

/** PRD A-4: Global Audit Ledger (filterable, CSV export). */
export default function Audit() {
  const q = useAsync(() => apiData<AuditRow[]>('/admin/audit'), []);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [page, setPage] = useState(0);
  const { reload } = q;
  // A new search starts from the first page
  useEffect(() => setPage(0), [deferred]);

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  const all = q.data ?? [];
  const needle = deferred.trim().toLowerCase();
  // PRD: filter by Customer ID, Merchant Name or Transaction ID (customer name too, for convenience)
  const rows = needle
    ? all.filter((r) =>
        [r.transactionId, r.userId, r.customerName, r.merchantName ?? '', branch(r), r.voucherId ?? '', r.billId ?? '', ...r.campaignNames].some((v) => v.toLowerCase().includes(needle)),
      )
    : all;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * PAGE, current * PAGE + PAGE);

  function exportCsv() {
    const header = ['Transaction ID', 'Date & Time (Asia/Manila)', 'Merchant Branch', 'Merchant ID', 'Customer Name', 'Customer ID', 'Transaction Type', 'Gross Sales (PHP)', 'Points', 'Base Points', 'Bonus Points', 'Campaigns', 'Bill ID', 'Voucher ID', 'Voucher Value (PHP)'];
    const body = rows.map((r) => [
      r.transactionId,
      formatManilaDateTime(r.timestamp),
      branch(r),
      r.merchantId,
      r.customerName,
      r.userId,
      TYPE_LABEL[r.type],
      r.grossAmount?.toFixed(2),
      r.pointsAmount,
      r.basePoints,
      r.bonusPoints,
      r.campaignNames.join('; '),
      r.billId,
      r.voucherId,
      r.voucherValue?.toFixed(2),
    ]);
    downloadText(`gcash-ayala-audit-${manilaDate(new Date().toISOString())}${needle ? '-filtered' : ''}.csv`, toCsv([header, ...body]));
  }

  return (
    <Shell
      title="Global Audit Ledger"
      description="Every earn, voucher claim and voucher redemption across Ayala Mall Manila Bay."
      actions={
        <>
          <Button variant="secondary" onClick={() => void reload()} disabled={q.loading} icon={<RefreshCw className={`size-4 ${q.loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden />}>
            Refresh
          </Button>
          <Button onClick={exportCsv} disabled={!rows.length} icon={<Download className="size-4" aria-hidden />}>
            Export Audit CSV
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xl min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-2" aria-hidden />
          <label htmlFor="audit-search" className="sr-only">
            Search the audit ledger
          </label>
          <input
            id="audit-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer ID, merchant (H&M, Samsung…), transaction or bill ID, campaign"
            className="min-h-11 w-full rounded-chip bg-surface-1 pr-10 pl-9 ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-text-2 hover:bg-surface-2">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {q.data && (
          <p className="text-sm text-text-2" aria-live="polite">
            {formatPoints(rows.length)} of {formatPoints(all.length)} transactions{rows.length > PAGE && (
              <>
                {' '}· showing <strong className="text-text-1">{formatPoints(current * PAGE + 1)}–{formatPoints(Math.min(rows.length, (current + 1) * PAGE))}</strong>
              </>
            )}
          </p>
        )}
      </div>

      {q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={() => void reload()} />
      ) : !q.data ? (
        <Skeleton className="h-96 rounded-card" />
      ) : all.length === 0 ? (
        <EmptyState icon={SearchX} title="No transactions yet" body="Earns, voucher claims and redemptions appear here as soon as they happen at any store." />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title={`Nothing matches “${deferred.trim()}”`} body="Try a customer ID like USR-001, a merchant name like H&M, or a transaction ID like TXN-EARN-9002." action={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>} />
      ) : (
        <div className={table.wrap}>
          <table className={`${table.table} min-w-[1100px]`}>
            <caption className="sr-only">Audit ledger, newest first</caption>
            <thead className={table.thead}>
              <tr>
                <th scope="col" className={table.th}>Transaction ID</th>
                <th scope="col" className={table.th}>Date & Time</th>
                <th scope="col" className={table.th}>Merchant Branch</th>
                <th scope="col" className={table.th}>Customer Name</th>
                <th scope="col" className={table.th}>Transaction Type</th>
                <th scope="col" className={`${table.th} text-right`}>Gross Sales (₱)</th>
                <th scope="col" className={`${table.th} text-right`}>Points / Voucher Value</th>
                <th scope="col" className={table.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.transactionId} className={table.row}>
                  <td className={`${table.td} font-mono text-xs font-semibold whitespace-nowrap`}>
                    {r.transactionId}
                    {r.billId && <span className="block font-normal text-text-2">{r.billId}</span>}
                  </td>
                  <td className={`${table.td} whitespace-nowrap tabular`}>
                    <time dateTime={r.timestamp}>{formatManilaDateTime(r.timestamp)}</time>
                  </td>
                  <td className={`${table.td} min-w-36`}>{branch(r)}</td>
                  <td className={`${table.td} whitespace-nowrap`}>
                    <span className="font-semibold">{r.customerName}</span>
                    <span className="block font-mono text-xs text-text-2">{r.userId}</span>
                  </td>
                  <td className={table.td}>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TYPE_CLS[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                  </td>
                  <td className={table.num}>{r.grossAmount !== null ? formatPeso(r.grossAmount) : '—'}</td>
                  <td className={`${table.num} font-semibold ${r.type === 'EARN' ? 'text-success-700' : r.type === 'CLAIM' ? 'text-danger-700' : ''}`}>
                    {valueText(r)}
                    {!!r.bonusPoints && (
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-xs font-bold whitespace-normal text-promo-700">
                        <Zap className="size-3" aria-hidden />
                        incl. +{formatPoints(r.bonusPoints)} {r.campaignNames.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className={table.td}>
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDetail(r)} aria-label={`View ${r.transactionId}`} icon={<Eye className="size-4" aria-hidden />}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <nav aria-label="Ledger pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-sm">
              <Button variant="ghost" onClick={() => setPage(current - 1)} disabled={current === 0} icon={<ChevronLeft className="size-4" aria-hidden />}>
                Newer
              </Button>
              <span className="text-text-2 tabular">
                Page {current + 1} of {pages}
              </span>
              <Button variant="ghost" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
                Older
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </nav>
          )}
        </div>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.transactionId ?? ''} description={detail ? TYPE_LABEL[detail.type] : undefined}>
        {detail && (
          <dl className="divide-y divide-line rounded-card bg-surface-2 px-4 text-sm">
            <Row label="Date & time (Asia/Manila)">{formatManilaDateTime(detail.timestamp)}</Row>
            <Row label="Merchant branch">
              {branch(detail)}
              {detail.merchantId && <span className="block font-mono text-xs text-text-2">{detail.merchantId}</span>}
            </Row>
            <Row label="Customer">
              {detail.customerName}
              <span className="block font-mono text-xs text-text-2">{detail.userId}</span>
            </Row>
            <Row label="Gross sales">{detail.grossAmount !== null ? formatPeso(detail.grossAmount) : '—'}</Row>
            <Row label="Points">{detail.pointsAmount > 0 ? `+${formatPoints(detail.pointsAmount)}` : detail.pointsAmount < 0 ? `−${formatPoints(-detail.pointsAmount)}` : '0'} PTS</Row>
            {!!detail.bonusPoints && (
              <Row label="Points breakdown">
                {formatPoints(detail.basePoints ?? 0)} base + {formatPoints(detail.bonusPoints)} bonus
                <span className="block text-xs font-normal text-text-2">{detail.campaignNames.join(', ')}</span>
              </Row>
            )}
            {detail.billId && (
              <Row label="POS bill">
                <span className="font-mono">{detail.billId}</span>
              </Row>
            )}
            <Row label="Voucher">{detail.voucherId ? <span className="font-mono">{detail.voucherId}</span> : '—'}</Row>
            <Row label="Voucher value">{detail.voucherValue !== null ? formatPeso(detail.voucherValue) : '—'}</Row>
            <Row label="Status">Completed</Row>
          </dl>
        )}
      </Dialog>
    </Shell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-text-2">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
