import { describeCampaign, manilaDate, PROGRAM, type Campaign, type Cart, type CartLine, type Quote, type QuoteCampaign, type QuoteVoucher, type Sale, type User, type Voucher } from '@gcash/shared';
import { makeCarts, storeCode } from '../seed';
import type { Store } from '../store';
import { liveCampaigns } from './campaigns';
import { conflict, notFound } from './errors';
import { findMerchant, logTxn, resolveMember, tierFor, voucherProblem } from './loyalty';

const r2 = (n: number) => Math.round(n * 100) / 100;
/** The most a voucher can take off this bill under its "max % of bill" term */
const capOf = (v: Voucher, subtotal: number) => Math.min(v.discountAmount, v.maxBillPercent ? (subtotal * v.maxBillPercent) / 100 : Infinity);
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Pure calculation
// ---------------------------------------------------------------------------

export interface QuoteInput {
  cartId: string;
  merchantId: string;
  merchantName: string;
  lines: CartLine[];
  member: User | null;
  /** The member's ACTIVE vouchers with why each can't be used here (null = usable) */
  vouchers: { voucher: Voucher; problem: string | null }[];
  /** Explicit selection; undefined = auto-select the best usable voucher */
  selectedIds?: string[];
  campaigns: Campaign[];
}

/**
 * Prices a bill. Points are earned on the net amount paid (after vouchers): base = floor(net / ₱100).
 * Campaign bonus: per line, the highest live multiplier wins (bill-threshold or product match, no stacking),
 * bonus = floor(Σ lineNet × (m − 1) / ₱100) per campaign; the largest qualifying flat bonus is added on top;
 * each campaign is capped by its remaining bonus budget. Vouchers are capped at the subtotal (excess forfeited).
 */
export function computeQuote(input: QuoteInput): Quote {
  const { lines, member } = input;
  const warnings: string[] = [];
  const subtotal = r2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));

  // Vouchers: members only
  const usable = member ? input.vouchers.filter((v) => !v.problem) : [];
  let selected: Voucher[];
  if (!member) selected = [];
  else if (input.selectedIds) {
    selected = usable.filter((v) => input.selectedIds!.includes(v.voucher.voucherId)).map((v) => v.voucher);
    for (const v of input.vouchers) if (v.problem && input.selectedIds.includes(v.voucher.voucherId)) warnings.push(`${v.voucher.title} can't be used here: ${v.problem}.`);
  } else {
    // Best single voucher: the most usable value; ties go to the smaller voucher (less forfeited)
    const sorted = usable.map((v) => v.voucher).sort((a, b) => capOf(b, subtotal) - capOf(a, subtotal) || a.discountAmount - b.discountAmount);
    selected = sorted.length ? [sorted[0]] : [];
  }
  // Each voucher covers at most its T&C share of the bill; together they can't exceed the bill
  let left = subtotal;
  let discount = 0;
  for (const v of selected) {
    const applied = r2(Math.min(capOf(v, subtotal), left));
    if (v.maxBillPercent && v.maxBillPercent < 100 && v.discountAmount > applied) {
      warnings.push(`${v.title} covers at most ${v.maxBillPercent}% of the bill: ${peso(applied)} applied.`);
    }
    discount = r2(discount + applied);
    left = r2(left - applied);
  }
  const voucherTotal = selected.reduce((s, v) => s + v.discountAmount, 0);
  const forfeited = r2(voucherTotal - discount);
  if (forfeited > 0) warnings.push(`${peso(forfeited)} of the voucher value will be forfeited because it exceeds what this bill allows.`);
  const net = r2(subtotal - discount);
  const ratio = subtotal > 0 ? net / subtotal : 0;

  // Campaigns: members only
  const campaigns = member ? input.campaigns : [];
  const multipliers = campaigns.filter((c) => c.type !== 'FLAT_BONUS');
  const bonusRaw = new Map<string, number>();
  const outLines = lines.map((l) => {
    const lineTotal = r2(l.unitPrice * l.qty);
    const lineNet = lineTotal * ratio;
    let best: Campaign | undefined;
    for (const c of multipliers) {
      const applies =
        c.type === 'BILL_MULTIPLIER'
          ? net >= (c.minSpend ?? 0)
          : (c.productTag && l.tags.includes(c.productTag)) || (c.productCategory && l.category === c.productCategory);
      if (applies && (!best || (c.multiplier ?? 1) > (best.multiplier ?? 1))) best = c;
    }
    if (best) bonusRaw.set(best.campaignId, (bonusRaw.get(best.campaignId) ?? 0) + lineNet * ((best.multiplier ?? 1) - 1));
    return { ...l, lineTotal, multiplier: best?.multiplier ?? 1, ...(best ? { campaignId: best.campaignId } : {}) };
  });

  const remaining = (c: Campaign) => (c.budgetPoints === undefined ? Infinity : Math.max(0, c.budgetPoints - c.bonusPointsIssued));
  const quoteCampaigns: QuoteCampaign[] = [];
  for (const c of multipliers) {
    const pts = Math.min(Math.floor((bonusRaw.get(c.campaignId) ?? 0) / PROGRAM.spendPerPoint), remaining(c));
    if (pts > 0) quoteCampaigns.push({ campaignId: c.campaignId, name: c.name, type: c.type, mechanics: describeCampaign(c, input.merchantName), bonusPoints: pts });
  }
  const flat = campaigns
    .filter((c) => c.type === 'FLAT_BONUS' && net >= (c.minSpend ?? 0))
    .sort((a, b) => (b.flatBonus ?? 0) - (a.flatBonus ?? 0))[0];
  if (flat) {
    const pts = Math.min(flat.flatBonus ?? 0, remaining(flat));
    if (pts > 0) quoteCampaigns.push({ campaignId: flat.campaignId, name: flat.name, type: flat.type, mechanics: describeCampaign(flat, input.merchantName), bonusPoints: pts });
  }

  const basePoints = member ? Math.floor(net / PROGRAM.spendPerPoint) : 0;
  const bonusPoints = quoteCampaigns.reduce((s, c) => s + c.bonusPoints, 0);
  const vouchers: QuoteVoucher[] = member
    ? input.vouchers.map(({ voucher: v, problem }) => ({
        voucherId: v.voucherId,
        title: v.title,
        discountAmount: v.discountAmount,
        selected: selected.includes(v),
        ...(problem ? { unusableReason: problem } : {}),
      }))
    : [];

  return {
    cartId: input.cartId,
    merchantId: input.merchantId,
    member: member ? { userId: member.userId, name: member.name, tier: member.tier, pointsBalance: member.pointsBalance } : null,
    lines: outLines,
    subtotal,
    vouchers,
    discount,
    forfeited,
    net,
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    campaigns: quoteCampaigns,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Store-backed operations
// ---------------------------------------------------------------------------

/** Open carts, each with its subtotal and the live campaigns a member would get on it (POS hint badges). */
export function cartsFor(store: Store, merchantId: string) {
  const merchant = findMerchant(store, merchantId);
  const live = liveCampaigns(store, merchantId, manilaDate(store.nowIso()));
  const anyMember = { userId: '', name: '', mobileNumber: '', tier: 'Member', pointsBalance: 0, lifetimePoints: 0, createdAt: '' } as User;
  return store.state.carts
    .filter((c) => c.merchantId === merchantId && c.status === 'OPEN')
    .map((c) => {
      const q = computeQuote({ cartId: c.cartId, merchantId, merchantName: merchant.name, lines: c.lines, member: anyMember, vouchers: [], campaigns: live });
      return { ...c, subtotal: q.subtotal, eligibleCampaigns: q.campaigns.map(({ campaignId, name }) => ({ campaignId, name })) };
    });
}

/** Replace a store's open demo carts with a fresh set (paid carts stay for the record). */
export function resetCarts(store: Store, merchantId: string) {
  findMerchant(store, merchantId);
  store.state.carts = store.state.carts.filter((c) => !(c.merchantId === merchantId && c.status === 'OPEN'));
  store.state.carts.push(...makeCarts(store.state, merchantId, store.nowIso()));
  store.save();
  return cartsFor(store, merchantId);
}

function findCart(store: Store, cartId: unknown): Cart {
  const cart = store.state.carts.find((c) => c.cartId === cartId);
  if (!cart) throw notFound('CART_NOT_FOUND', `No cart found for "${cartId}".`);
  return cart;
}

/** A member's ACTIVE vouchers, each with the reason it can't be used at this store (null = usable). */
export function memberVouchers(store: Store, user: User, merchantId: string) {
  return store.state.vouchers
    .filter((v) => v.userId === user.userId && v.status === 'ACTIVE')
    .map((voucher) => ({ voucher, problem: voucherProblem(store, voucher, merchantId) }))
    .filter((v) => !v.problem?.startsWith('Expired'));
}

interface PriceArgs {
  merchantId: string;
  lines: CartLine[];
  cartId?: string;
  member?: unknown;
  voucherIds?: unknown;
  at?: string;
}

function price(store: Store, a: PriceArgs) {
  const merchant = findMerchant(store, a.merchantId);
  const member = a.member !== undefined && a.member !== null && String(a.member).trim() !== '' ? resolveMember(store, String(a.member)) : null;
  const date = manilaDate(a.at ?? store.nowIso());
  const selectedIds = Array.isArray(a.voucherIds) ? a.voucherIds.map(String) : undefined;
  const subtotal = a.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  // Minimum order (T&C) is checked against the bill before vouchers
  const vouchers = member
    ? memberVouchers(store, member, merchant.merchantId).map((v) =>
        !v.problem && v.voucher.minSpend && subtotal < v.voucher.minSpend ? { ...v, problem: `Minimum order ${peso(v.voucher.minSpend)}` } : v,
      )
    : [];
  const quote = computeQuote({
    cartId: a.cartId ?? '',
    merchantId: merchant.merchantId,
    merchantName: merchant.name,
    lines: a.lines,
    member,
    vouchers,
    selectedIds,
    campaigns: liveCampaigns(store, merchant.merchantId, date),
  });
  return { merchant, member, quote, selectedIds };
}

export function quoteCart(store: Store, body: { cartId?: unknown; member?: unknown; voucherIds?: unknown }) {
  const cart = findCart(store, body.cartId);
  if (cart.status !== 'OPEN') throw conflict('CART_PAID', 'This cart has already been paid. Pick another cart.');
  return price(store, { merchantId: cart.merchantId, lines: cart.lines, cartId: cart.cartId, member: body.member, voucherIds: body.voucherIds }).quote;
}

/**
 * Completes a purchase: records the sale, redeems the applied vouchers (funded by this store) and credits
 * base + campaign points to the member. Used by the POS checkout and by the generated history.
 */
export function recordSale(store: Store, a: PriceArgs & { cashier: string; rng?: () => number }) {
  const { merchant, member, quote, selectedIds } = price(store, a);
  if (selectedIds && member) {
    const unusable = selectedIds.filter((id) => !quote.vouchers.some((v) => v.voucherId === id && v.selected));
    if (unusable.length) throw conflict('VOUCHER_UNUSABLE', `Voucher ${unusable.join(', ')} can't be used on this bill anymore. Re-scan the member to refresh.`);
  }
  const at = a.at ?? store.nowIso();
  const billId = `BILL-${storeCode(merchant.merchantId)}-${++store.state.seq.sale}`;
  const appliedVouchers = quote.vouchers.filter((v) => v.selected).map((v) => v.voucherId);

  for (const id of appliedVouchers) {
    const v = store.state.vouchers.find((x) => x.voucherId === id)!;
    v.status = 'REDEEMED';
    v.redeemedAt = at;
    v.redeemedMerchantId = merchant.merchantId;
    logTxn(store, { type: 'REDEEM', userId: v.userId, merchantId: merchant.merchantId, grossAmount: null, pointsAmount: 0, voucherId: id, billId }, at);
  }

  let earnTransactionId: string | null = null;
  if (member && quote.totalPoints > 0) {
    member.pointsBalance += quote.totalPoints;
    member.lifetimePoints += quote.totalPoints;
    member.tier = tierFor(member.lifetimePoints);
    const txn = logTxn(
      store,
      {
        type: 'EARN',
        userId: member.userId,
        merchantId: merchant.merchantId,
        grossAmount: quote.net,
        pointsAmount: quote.totalPoints,
        voucherId: null,
        billId,
        basePoints: quote.basePoints,
        bonusPoints: quote.bonusPoints,
        campaignIds: quote.campaigns.map((c) => c.campaignId),
      },
      at,
    );
    earnTransactionId = txn.transactionId;
  }

  for (const qc of quote.campaigns) {
    const c = store.state.campaigns.find((x) => x.campaignId === qc.campaignId)!;
    c.bonusPointsIssued += qc.bonusPoints;
    if (c.budgetPoints !== undefined && c.bonusPointsIssued >= c.budgetPoints) {
      c.status = 'ENDED';
      c.endedReason = 'BUDGET';
      c.endedAt = at;
    }
  }

  const sale: Sale = {
    billId,
    merchantId: merchant.merchantId,
    ...(a.cartId ? { cartId: a.cartId } : {}),
    userId: member?.userId ?? null,
    lines: a.lines,
    subtotal: quote.subtotal,
    discount: quote.discount,
    net: quote.net,
    voucherIds: appliedVouchers,
    basePoints: quote.basePoints,
    bonusPoints: quote.bonusPoints,
    campaignIds: quote.campaigns.map((c) => c.campaignId),
    campaignPoints: Object.fromEntries(quote.campaigns.map((c) => [c.campaignId, c.bonusPoints])),
    cashier: a.cashier,
    timestamp: at,
  };
  store.state.sales.push(sale);
  return { sale, quote: { ...quote, member: quote.member && member ? { ...quote.member, pointsBalance: member.pointsBalance } : quote.member }, earnTransactionId, newPointsBalance: member ? member.pointsBalance : null };
}

export function checkoutCart(store: Store, body: { cartId?: unknown; member?: unknown; voucherIds?: unknown; cashier?: unknown }) {
  const cart = findCart(store, body.cartId);
  if (cart.status !== 'OPEN') throw conflict('CART_PAID', 'This cart has already been paid. Pick another cart.');
  const result = recordSale(store, {
    merchantId: cart.merchantId,
    lines: cart.lines,
    cartId: cart.cartId,
    member: body.member,
    voucherIds: body.voucherIds,
    cashier: String(body.cashier ?? '').trim() || 'Cashier',
  });
  cart.status = 'PAID';
  cart.billId = result.sale.billId;
  store.save();
  return { success: true as const, ...result };
}
