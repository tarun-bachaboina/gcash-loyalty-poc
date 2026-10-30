import { manilaDate, type AnalyticsKpis, type MerchantAnalytics, type MerchantSaleRow, type Sale } from '@gcash/shared';
import type { Store } from '../store';
import { shiftDate, todayIn } from './campaigns';
import { findMerchant } from './loyalty';

const r2 = (n: number) => Math.round(n * 100) / 100;
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function kpis(store: Store, merchantId: string, sales: Sale[], dates: Set<string>): AnalyticsKpis {
  const member = sales.filter((s) => s.userId);
  const nonMember = sales.filter((s) => !s.userId);
  const sum = (xs: Sale[], f: (s: Sale) => number) => r2(xs.reduce((n, s) => n + f(s), 0));
  // Vouchers redeemed here are funded by this store ("the store that burns the points pays")
  const redeems = store.state.transactions.filter((t) => t.type === 'REDEEM' && t.merchantId === merchantId && dates.has(manilaDate(t.timestamp)));
  const voucherDiscounts = r2(
    redeems.reduce((n, t) => {
      const sale = t.billId ? sales.find((s) => s.billId === t.billId) : undefined;
      const v = store.state.vouchers.find((x) => x.voucherId === t.voucherId);
      // On a POS bill the applied discount may be capped at the bill; spread it over that bill's vouchers
      return n + (sale ? sale.discount / Math.max(1, sale.voucherIds.length) : (v?.discountAmount ?? 0));
    }, 0),
  );
  return {
    memberRevenue: sum(member, (s) => s.net),
    nonMemberRevenue: sum(nonMember, (s) => s.net),
    memberBills: member.length,
    nonMemberBills: nonMember.length,
    uniqueMembers: new Set(member.map((s) => s.userId)).size,
    avgMemberBill: member.length ? r2(sum(member, (s) => s.net) / member.length) : 0,
    avgNonMemberBill: nonMember.length ? r2(sum(nonMember, (s) => s.net) / nonMember.length) : 0,
    basePoints: sales.reduce((n, s) => n + s.basePoints, 0),
    bonusPoints: sales.reduce((n, s) => n + s.bonusPoints, 0),
    voucherDiscounts,
    voucherRedemptions: redeems.length,
  };
}

/** Merchant analytics for the last `days` days (Asia/Manila), with the previous period for comparison. */
export function merchantAnalytics(store: Store, merchantId: string, daysIn: unknown): MerchantAnalytics {
  findMerchant(store, merchantId);
  const days = [7, 30, 90].includes(Number(daysIn)) ? Number(daysIn) : 30;
  const to = todayIn(store);
  const from = shiftDate(to, -(days - 1));
  const dateList = Array.from({ length: days }, (_, i) => shiftDate(from, i));
  const current = new Set(dateList);
  const previous = new Set(Array.from({ length: days }, (_, i) => shiftDate(from, i - days)));

  const mine = store.state.sales.filter((s) => s.merchantId === merchantId);
  const inPeriod = mine.filter((s) => current.has(manilaDate(s.timestamp)));
  const inPrevious = mine.filter((s) => previous.has(manilaDate(s.timestamp)));

  const daily = dateList.map((date) => {
    const day = inPeriod.filter((s) => manilaDate(s.timestamp) === date);
    return {
      date,
      memberRevenue: r2(day.filter((s) => s.userId).reduce((n, s) => n + s.net, 0)),
      nonMemberRevenue: r2(day.filter((s) => !s.userId).reduce((n, s) => n + s.net, 0)),
      bills: day.length,
      basePoints: day.reduce((n, s) => n + s.basePoints, 0),
      bonusPoints: day.reduce((n, s) => n + s.bonusPoints, 0),
    };
  });

  // Campaigns that overlap the period
  const campaigns = store.state.campaigns
    .filter((c) => c.merchantId === merchantId && (c.status === 'APPROVED' || c.status === 'ENDED') && c.startDate <= to && c.endDate >= from)
    .map((c) => {
      const bills = inPeriod.filter((s) => s.campaignIds.includes(c.campaignId));
      const revenue = r2(bills.reduce((n, s) => n + s.net, 0));
      const bonusPoints = bills.reduce((n, s) => n + (s.campaignPoints?.[c.campaignId] ?? 0), 0);
      const beforeFrom = shiftDate(c.startDate, -14);
      const before = mine.filter((s) => s.userId && manilaDate(s.timestamp) >= beforeFrom && manilaDate(s.timestamp) < c.startDate);
      return {
        campaignId: c.campaignId,
        name: c.name,
        type: c.type,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        bills: bills.length,
        revenue,
        bonusPoints,
        revenuePerBonusPoint: bonusPoints ? r2(revenue / bonusPoints) : 0,
        avgBillDuring: bills.length ? r2(revenue / bills.length) : 0,
        avgBillBefore: before.length ? r2(before.reduce((n, s) => n + s.net, 0) / before.length) : 0,
      };
    });

  // Vouchers redeemed here, by reward
  const byReward = new Map<string, { rewardId: string; title: string; count: number; discount: number }>();
  for (const t of store.state.transactions) {
    if (t.type !== 'REDEEM' || t.merchantId !== merchantId || !current.has(manilaDate(t.timestamp))) continue;
    const v = store.state.vouchers.find((x) => x.voucherId === t.voucherId);
    if (!v) continue;
    const sale = t.billId ? inPeriod.find((s) => s.billId === t.billId) : undefined;
    const amount = sale ? sale.discount / Math.max(1, sale.voucherIds.length) : v.discountAmount;
    const row = byReward.get(v.rewardId) ?? { rewardId: v.rewardId, title: v.title, count: 0, discount: 0 };
    row.count += 1;
    row.discount = r2(row.discount + amount);
    byReward.set(v.rewardId, row);
  }

  // Top products by revenue in the period; flag those targeted by a campaign
  const targeted = store.state.campaigns.filter((c) => c.merchantId === merchantId && c.type === 'PRODUCT_MULTIPLIER' && (c.status === 'APPROVED' || c.status === 'ENDED'));
  const products = new Map<string, { sku: string; name: string; qty: number; revenue: number; campaignTagged: boolean }>();
  for (const s of inPeriod) {
    for (const l of s.lines) {
      const row = products.get(l.sku) ?? {
        sku: l.sku,
        name: l.name,
        qty: 0,
        revenue: 0,
        campaignTagged: targeted.some((c) => (c.productTag && l.tags.includes(c.productTag)) || c.productCategory === l.category),
      };
      row.qty += l.qty;
      row.revenue = r2(row.revenue + l.unitPrice * l.qty);
      products.set(l.sku, row);
    }
  }

  // New vs returning members: "new" = first-ever bill at this store falls in the period
  const firstSeen = new Map<string, string>();
  for (const s of mine) if (s.userId && (!firstSeen.has(s.userId) || s.timestamp < firstSeen.get(s.userId)!)) firstSeen.set(s.userId, s.timestamp);
  const periodMembers = new Set(inPeriod.filter((s) => s.userId).map((s) => s.userId!));
  const newMembers = [...periodMembers].filter((u) => current.has(manilaDate(firstSeen.get(u)!))).length;

  // Busy hours: bills by weekday × hour (Asia/Manila)
  const heat = new Map<string, number>();
  for (const s of inPeriod) {
    const parts = Object.fromEntries(hourFmt.formatToParts(new Date(s.timestamp)).map((p) => [p.type, p.value]));
    const key = `${DOW.indexOf(parts.weekday)}|${Number(parts.hour)}`;
    heat.set(key, (heat.get(key) ?? 0) + 1);
  }

  return {
    period: { from, to, days },
    kpis: { current: kpis(store, merchantId, inPeriod, current), previous: kpis(store, merchantId, inPrevious, previous) },
    daily,
    campaigns,
    vouchers: [...byReward.values()].sort((a, b) => b.discount - a.discount),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty).slice(0, 8),
    customerMix: { newMembers, returningMembers: periodMembers.size - newMembers },
    heatmap: [...heat.entries()].map(([k, bills]) => {
      const [dow, hour] = k.split('|').map(Number);
      return { dow, day: DOW[dow], hour, bills };
    }),
  };
}

/** Sales ledger for the merchant portal "Transactions" page. */
export function merchantSales(store: Store, merchantId: string, fromIn?: unknown, toIn?: unknown): MerchantSaleRow[] {
  findMerchant(store, merchantId);
  const to = typeof toIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toIn) ? toIn : todayIn(store);
  const from = typeof fromIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromIn) ? fromIn : to;
  const users = new Map(store.state.users.map((u) => [u.userId, u.name]));
  return store.state.sales
    .filter((s) => s.merchantId === merchantId && manilaDate(s.timestamp) >= from && manilaDate(s.timestamp) <= to)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((s) => ({ ...s, customerName: s.userId ? (users.get(s.userId) ?? s.userId) : null }));
}
