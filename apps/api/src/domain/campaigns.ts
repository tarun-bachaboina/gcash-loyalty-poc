import { CAMPAIGN_MULTIPLIERS, describeCampaign, manilaDate, PROGRAM, type Campaign, type CampaignDisplayStatus, type CampaignEstimate, type CampaignView, type CreateCampaignRequest } from '@gcash/shared';
import type { Store } from '../store';
import { badRequest, conflict, notFound } from './errors';
import { findMerchant } from './loyalty';

const TYPES = ['BILL_MULTIPLIER', 'PRODUCT_MULTIPLIER', 'FLAT_BONUS'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const todayIn = (store: Store) => manilaDate(store.nowIso());

/** Shopper/merchant-facing status: APPROVED becomes SCHEDULED / LIVE / ENDED from its dates and budget. */
export function displayStatus(c: Campaign, today: string): CampaignDisplayStatus {
  if (c.status !== 'APPROVED') return c.status;
  if (today < c.startDate) return 'SCHEDULED';
  if (today > c.endDate) return 'ENDED';
  if (c.budgetPoints !== undefined && c.bonusPointsIssued >= c.budgetPoints) return 'ENDED';
  return 'LIVE';
}

export function campaignView(store: Store, c: Campaign, today = todayIn(store)): CampaignView {
  const merchantName = store.state.merchants.find((m) => m.merchantId === c.merchantId)?.name ?? c.merchantId;
  return { ...c, displayStatus: displayStatus(c, today), merchantName, mechanics: describeCampaign(c, merchantName) };
}

/** Campaigns that apply to a bill at this store on this date. */
export const liveCampaigns = (store: Store, merchantId: string, date: string) =>
  store.state.campaigns.filter((c) => c.merchantId === merchantId && displayStatus(c, date) === 'LIVE');

function findCampaign(store: Store, id: string) {
  const c = store.state.campaigns.find((x) => x.campaignId === id);
  if (!c) throw notFound('CAMPAIGN_NOT_FOUND', `No campaign found for "${id}".`);
  return c;
}

const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

export function createCampaign(store: Store, body: Partial<CreateCampaignRequest>): CampaignView {
  const merchant = findMerchant(store, String(body.merchantId ?? ''));
  const name = String(body.name ?? '').trim();
  const terms = String(body.terms ?? '').trim();
  const type = body.type as Campaign['type'];
  if (!name) throw badRequest('INVALID_CAMPAIGN', 'Give the campaign a name.');
  if (!TYPES.includes(type)) throw badRequest('INVALID_CAMPAIGN', 'Choose a campaign type.');

  const c: Campaign = {
    campaignId: '',
    merchantId: merchant.merchantId,
    name,
    type,
    startDate: String(body.startDate ?? ''),
    endDate: String(body.endDate ?? ''),
    terms,
    status: 'PENDING',
    submittedAt: store.nowIso(),
    bonusPointsIssued: 0,
  };

  if (type !== 'FLAT_BONUS') {
    const m = num(body.multiplier);
    if (!CAMPAIGN_MULTIPLIERS.includes(m as (typeof CAMPAIGN_MULTIPLIERS)[number])) throw badRequest('INVALID_CAMPAIGN', 'Choose a multiplier: 1.5×, 2× or 3×.');
    c.multiplier = m as number;
  }
  if (type === 'BILL_MULTIPLIER' || type === 'FLAT_BONUS') {
    const min = num(body.minSpend);
    if (!(typeof min === 'number' && Number.isFinite(min) && min > 0)) throw badRequest('INVALID_CAMPAIGN', 'Set the minimum bill amount (₱).');
    c.minSpend = min;
  }
  if (type === 'PRODUCT_MULTIPLIER') {
    const tag = String(body.productTag ?? '').trim() || undefined;
    const category = String(body.productCategory ?? '').trim() || undefined;
    const products = store.state.products.filter((p) => p.merchantId === merchant.merchantId);
    const matches = products.some((p) => (tag && p.tags.includes(tag)) || (category && p.category === category));
    if (!(tag || category) || !matches) throw badRequest('INVALID_CAMPAIGN', 'Pick a product or product category from your catalogue.');
    if (tag) c.productTag = tag;
    else c.productCategory = category;
  }
  if (type === 'FLAT_BONUS') {
    const bonus = num(body.flatBonus);
    if (!posInt(bonus)) throw badRequest('INVALID_CAMPAIGN', 'Set the bonus points (a whole number, 1 or more).');
    c.flatBonus = bonus;
  }
  if (body.budgetPoints !== undefined && body.budgetPoints !== null && String(body.budgetPoints) !== '') {
    const budget = num(body.budgetPoints);
    if (!posInt(budget)) throw badRequest('INVALID_CAMPAIGN', 'The bonus points budget must be a whole number above 0.');
    c.budgetPoints = budget;
  }

  const today = todayIn(store);
  if (!DATE.test(c.startDate) || !DATE.test(c.endDate)) throw badRequest('INVALID_CAMPAIGN', 'Choose valid start and end dates.');
  if (c.endDate < today) throw badRequest('INVALID_CAMPAIGN', "The campaign would already be over: pick dates that aren't in the past.");
  if (c.startDate < today) throw badRequest('INVALID_CAMPAIGN', "The start date can't be in the past.");
  if (c.endDate < c.startDate) throw badRequest('INVALID_CAMPAIGN', 'The end date must be on or after the start date.');
  if (!terms) throw badRequest('INVALID_CAMPAIGN', 'Add the terms & conditions shoppers will see.');

  c.campaignId = `CMP-${++store.state.seq.campaign}`;
  store.state.campaigns.push(c);
  store.save();
  return campaignView(store, c, today);
}

const newestFirst = (a: Campaign, b: Campaign) => b.submittedAt.localeCompare(a.submittedAt) || b.campaignId.localeCompare(a.campaignId);

export function merchantCampaigns(store: Store, merchantId: string) {
  findMerchant(store, merchantId);
  const today = todayIn(store);
  const sales = store.state.sales.filter((s) => s.merchantId === merchantId && s.campaignIds.length);
  return store.state.campaigns
    .filter((c) => c.merchantId === merchantId)
    .sort(newestFirst)
    .map((c) => {
      const bills = sales.filter((s) => s.campaignIds.includes(c.campaignId));
      const revenue = Math.round(bills.reduce((n, s) => n + s.net, 0) * 100) / 100;
      return { ...campaignView(store, c, today), stats: { bills: bills.length, revenue } };
    });
}

/**
 * Admin review aid: replay the campaign on the store's member bills from the last 30 days (same rules as checkout,
 * ignoring other campaigns), then scale to the campaign's length and cap by its budget.
 */
export function estimateCampaign(store: Store, c: Campaign, today = todayIn(store)): CampaignEstimate {
  const from = shiftDate(today, -30);
  const bills = store.state.sales.filter((s) => s.merchantId === c.merchantId && s.userId && manilaDate(s.timestamp) >= from && manilaDate(s.timestamp) < today);
  let qualifyingBills = 0;
  let bonusPoints30d = 0;
  for (const s of bills) {
    let pts = 0;
    if (c.type === 'FLAT_BONUS') pts = s.net >= (c.minSpend ?? 0) ? (c.flatBonus ?? 0) : 0;
    else if (c.type === 'BILL_MULTIPLIER') pts = s.net >= (c.minSpend ?? 0) ? Math.floor((s.net * ((c.multiplier ?? 1) - 1)) / PROGRAM.spendPerPoint) : 0;
    else {
      const ratio = s.subtotal > 0 ? s.net / s.subtotal : 0;
      const matched = s.lines.filter((l) => (c.productTag && l.tags.includes(c.productTag)) || (c.productCategory && l.category === c.productCategory));
      if (matched.length) pts = Math.floor((matched.reduce((n, l) => n + l.unitPrice * l.qty, 0) * ratio * ((c.multiplier ?? 1) - 1)) / PROGRAM.spendPerPoint);
    }
    if (pts > 0) {
      qualifyingBills += 1;
      bonusPoints30d += pts;
    }
  }
  const days = Math.round((Date.parse(`${c.endDate}T00:00:00Z`) - Date.parse(`${c.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  const projected = Math.round((bonusPoints30d / 30) * days);
  return { qualifyingBills, memberBills: bills.length, bonusPoints30d, projectedBonusPoints: c.budgetPoints === undefined ? projected : Math.min(projected, c.budgetPoints) };
}

/** Admin tabs: PENDING, APPROVED (= live or scheduled), REJECTED, ENDED, WITHDRAWN, or all. Each carries a cost estimate. */
export function adminCampaigns(store: Store, status?: string) {
  const today = todayIn(store);
  const views = store.state.campaigns
    .slice()
    .sort(newestFirst)
    .map((c) => ({ ...campaignView(store, c, today), estimate: estimateCampaign(store, c, today) }));
  if (!status || status === 'ALL') return views;
  if (status === 'APPROVED') return views.filter((v) => v.displayStatus === 'LIVE' || v.displayStatus === 'SCHEDULED');
  return views.filter((v) => v.displayStatus === status);
}

export function decideCampaign(store: Store, id: string, decision: 'approve' | 'reject', reason?: unknown): CampaignView {
  const c = findCampaign(store, id);
  if (c.status !== 'PENDING') throw conflict('NOT_PENDING', `${c.name} has already been ${c.status.toLowerCase()}.`);
  if (decision === 'reject') {
    const why = String(reason ?? '').trim();
    if (!why) throw badRequest('REASON_REQUIRED', 'Tell the merchant why the campaign is rejected.');
    c.status = 'REJECTED';
    c.rejectReason = why;
  } else {
    c.status = 'APPROVED';
  }
  c.decidedAt = store.nowIso();
  store.save();
  return campaignView(store, c);
}

export function withdrawCampaign(store: Store, id: string): CampaignView {
  const c = findCampaign(store, id);
  if (c.status !== 'PENDING') throw conflict('NOT_PENDING', 'Only pending campaigns can be withdrawn. End a live campaign instead.');
  c.status = 'WITHDRAWN';
  c.decidedAt = store.nowIso();
  store.save();
  return campaignView(store, c);
}

export function endCampaign(store: Store, id: string, by: 'MERCHANT' | 'ADMIN'): CampaignView {
  const c = findCampaign(store, id);
  const shown = displayStatus(c, todayIn(store));
  if (shown !== 'LIVE' && shown !== 'SCHEDULED') throw conflict('NOT_ACTIVE', 'Only live or scheduled campaigns can be ended.');
  c.status = 'ENDED';
  c.endedReason = by;
  c.endedAt = store.nowIso();
  store.save();
  return campaignView(store, c);
}

/** Customer "Promos": live, then upcoming, then those ended in the last 30 days. Never pending/rejected/withdrawn. */
export function customerPromos(store: Store) {
  const today = todayIn(store);
  const cutoff = shiftDate(today, -30);
  const rank: Partial<Record<CampaignDisplayStatus, number>> = { LIVE: 0, SCHEDULED: 1, ENDED: 2 };
  return store.state.campaigns
    .filter((c) => c.status === 'APPROVED' || c.status === 'ENDED')
    .map((c) => campaignView(store, c, today))
    .filter((v) => v.displayStatus !== 'ENDED' || (v.endedAt ? manilaDate(v.endedAt) : v.endDate) >= cutoff)
    .sort((a, b) => rank[a.displayStatus]! - rank[b.displayStatus]! || (a.displayStatus === 'ENDED' ? b.endDate.localeCompare(a.endDate) : a.startDate.localeCompare(b.startDate)));
}

export function shiftDate(yyyyMmDd: string, days: number) {
  const t = new Date(`${yyyyMmDd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
