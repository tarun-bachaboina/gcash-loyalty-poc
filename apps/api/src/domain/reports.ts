import { manilaDate, PROGRAM, type AuditRow, type Dashboard, type HistoryEntry, type Journal, type JournalEntry, type Transaction } from '@gcash/shared';
import { displayStatus, todayIn } from './campaigns';
import type { Store } from '../store';
import { findMerchant, findUser, voucherView } from './loyalty';

// Ties (same timestamp) fall back to the global sequence number in the id, e.g. TXN-CLAIM-9003 → 9003
const seqOf = (t: Transaction) => Number(t.transactionId.split('-').at(-1));
const newestFirst = (a: Transaction, b: Transaction) => b.timestamp.localeCompare(a.timestamp) || seqOf(b) - seqOf(a);

function lookups(store: Store) {
  const merchant = (id: string | null) => (id ? (store.state.merchants.find((m) => m.merchantId === id)?.name ?? id) : null);
  const voucher = (id: string | null) => (id ? store.state.vouchers.find((v) => v.voucherId === id) : undefined);
  const user = (id: string) => store.state.users.find((u) => u.userId === id);
  return { merchant, voucher, user };
}

export function historyFor(store: Store, userId: string): HistoryEntry[] {
  findUser(store, userId);
  const { merchant, voucher } = lookups(store);
  const campaignName = new Map(store.state.campaigns.map((c) => [c.campaignId, c.name]));
  return store.state.transactions
    .filter((t) => t.userId === userId)
    .sort(newestFirst)
    .map((t) => {
      const merchantName = merchant(t.merchantId);
      const title = voucher(t.voucherId)?.title ?? 'voucher';
      const description =
        t.type === 'EARN' ? `Earned at ${merchantName}` : t.type === 'CLAIM' ? `Redeemed ${title}` : `Used ${title} at ${merchantName}`;
      return { ...t, merchantName, description, ...(t.campaignIds?.length ? { campaignNames: t.campaignIds.map((id) => campaignName.get(id) ?? id) } : {}) };
    });
}

export function journalFor(store: Store, merchantId: string): Journal {
  findMerchant(store, merchantId);
  const today = manilaDate(store.nowIso());
  const { voucher, user } = lookups(store);
  const entries: JournalEntry[] = store.state.transactions
    .filter((t) => t.merchantId === merchantId && (t.type === 'EARN' || t.type === 'REDEEM') && manilaDate(t.timestamp) === today)
    .sort(newestFirst)
    .map((t) => ({
      transactionId: t.transactionId,
      timestamp: t.timestamp,
      type: t.type as 'EARN' | 'REDEEM',
      customerName: user(t.userId)?.name ?? t.userId,
      userId: t.userId,
      grossAmount: t.grossAmount,
      pointsIssued: t.type === 'EARN' ? t.pointsAmount : 0,
      discountApplied: t.type === 'REDEEM' ? (voucher(t.voucherId)?.discountAmount ?? 0) : 0,
      voucherId: t.voucherId,
      status: 'Completed',
    }));
  const earns = entries.filter((e) => e.type === 'EARN');
  const redeems = entries.filter((e) => e.type === 'REDEEM');
  return {
    date: today,
    entries,
    totals: {
      earnCount: earns.length,
      pointsIssued: earns.reduce((s, e) => s + e.pointsIssued, 0),
      redeemCount: redeems.length,
      discountValue: redeems.reduce((s, e) => s + e.discountApplied, 0),
    },
  };
}

/** ₱ discount each REDEEM gave: the share of its POS bill's discount, or the face value for a manual (M-4) redemption. */
function redeemValue(store: Store, t: Transaction) {
  const sale = t.billId ? store.state.sales.find((s) => s.billId === t.billId) : undefined;
  if (sale) return sale.discount / Math.max(1, sale.voucherIds.length);
  return store.state.vouchers.find((v) => v.voucherId === t.voucherId)?.discountAmount ?? 0;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function dashboard(store: Store): Dashboard {
  const txns = store.state.transactions;
  const active = store.state.vouchers.map((v) => voucherView(store, v)).filter((v) => v.status === 'ACTIVE');
  const today = todayIn(store);
  const shown = store.state.campaigns.map((c) => displayStatus(c, today));
  const redeems = txns.filter((t) => t.type === 'REDEEM');
  return {
    program: { spendPerPoint: PROGRAM.spendPerPoint, pointValue: PROGRAM.pointValue },
    campaigns: {
      live: shown.filter((s) => s === 'LIVE').length,
      scheduled: shown.filter((s) => s === 'SCHEDULED').length,
      bonusPointsIssued: store.state.campaigns.reduce((n, c) => n + c.bonusPointsIssued, 0),
    },
    pendingApprovals: {
      campaigns: store.state.campaigns.filter((c) => c.status === 'PENDING').length,
      rewards: store.state.rewards.filter((r) => r.status === 'PENDING').length,
    },
    voucherDiscountsFunded: r2(redeems.reduce((n, t) => n + redeemValue(store, t), 0)),
    totalPointsIssued: txns.filter((t) => t.type === 'EARN').reduce((s, t) => s + t.pointsAmount, 0),
    totalPointsRedeemed: txns.filter((t) => t.type === 'CLAIM').reduce((s, t) => s - t.pointsAmount, 0),
    activeVouchers: { count: active.length, value: active.reduce((s, v) => s + v.discountAmount, 0) },
    activeMerchantCount: store.state.merchants.length,
    merchants: store.state.merchants.map((m) => {
      const mine = txns.filter((t) => t.merchantId === m.merchantId);
      const earns = mine.filter((t) => t.type === 'EARN');
      const sales = store.state.sales.filter((s) => s.merchantId === m.merchantId);
      // Sales = every POS bill (members and non-members) plus manual M-3 earns that have no bill
      const manual = earns.filter((t) => !t.billId);
      return {
        merchantId: m.merchantId,
        name: m.name,
        totalSales: r2(sales.reduce((s, b) => s + b.net, 0) + manual.reduce((s, t) => s + (t.grossAmount ?? 0), 0)),
        pointsIssued: earns.reduce((s, t) => s + t.pointsAmount, 0),
        vouchersRedeemed: mine.filter((t) => t.type === 'REDEEM').length,
        active: true,
        bills: sales.length + manual.length,
        bonusPoints: earns.reduce((s, t) => s + (t.bonusPoints ?? 0), 0),
        discountsFunded: r2(mine.filter((t) => t.type === 'REDEEM').reduce((n, t) => n + redeemValue(store, t), 0)),
        liveCampaigns: store.state.campaigns.filter((c) => c.merchantId === m.merchantId && displayStatus(c, today) === 'LIVE').length,
      };
    }),
  };
}

export function auditLedger(store: Store): AuditRow[] {
  const { merchant, voucher, user } = lookups(store);
  const campaignName = new Map(store.state.campaigns.map((c) => [c.campaignId, c.name]));
  return [...store.state.transactions].sort(newestFirst).map((t) => ({
    ...t,
    merchantName: merchant(t.merchantId),
    customerName: user(t.userId)?.name ?? t.userId,
    voucherValue: voucher(t.voucherId)?.discountAmount ?? null,
    campaignNames: (t.campaignIds ?? []).map((id) => campaignName.get(id) ?? id),
  }));
}
