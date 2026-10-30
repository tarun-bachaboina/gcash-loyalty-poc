import {
  anyStoreLabel,
  manilaDate,
  PROGRAM,
  rewardTerms,
  storesForCategory,
  MOBILE_PATTERN,
  VIP_THRESHOLD,
  voucherQrPayload,
  type Merchant,
  type RewardCategory,
  type Tier,
  type Transaction,
  type TransactionType,
  type User,
  type ValidateResponse,
  type Voucher,
} from '@gcash/shared';
import type { Store } from '../store';
import { badRequest, conflict, notFound } from './errors';

export const tierFor = (lifetimePoints: number): Tier => (lifetimePoints >= VIP_THRESHOLD ? 'VIP' : 'Member');

export function findUser(store: Store, userId: string): User {
  const user = store.state.users.find((u) => u.userId === userId);
  if (!user) throw notFound('USER_NOT_FOUND', `No member found for "${userId}".`);
  return user;
}

export function findMerchant(store: Store, merchantId: string): Merchant {
  const merchant = store.state.merchants.find((m) => m.merchantId === merchantId);
  if (!merchant) throw notFound('MERCHANT_NOT_FOUND', `No store branch found for "${merchantId}".`);
  return merchant;
}

/** Accepts GCASH-MEMBER-USR-001, USR-001-09171112222, USR-001 or a mobile number (PRD M-3 "QR or ID"). */
export function resolveMember(store: Store, identifier: string): User {
  const raw = String(identifier ?? '').trim().toUpperCase();
  if (MOBILE_PATTERN.test(raw)) {
    const byMobile = store.state.users.find((u) => u.mobileNumber === raw);
    if (!byMobile) throw notFound('USER_NOT_FOUND', `No member found for ${raw}.`);
    return byMobile;
  }
  const match = raw.match(/^(?:GCASH-MEMBER-)?(USR-\d+)(?:-09\d{9})?$/);
  if (!match) throw notFound('USER_NOT_FOUND', `"${identifier}" is not a valid member QR or ID.`);
  return findUser(store, match[1]);
}

export function loginByMobile(store: Store, mobileNumber: unknown): { user: User; created: boolean } {
  const mobile = String(mobileNumber ?? '').trim();
  if (!MOBILE_PATTERN.test(mobile)) throw badRequest('INVALID_MOBILE', 'Mobile number must be 11 digits starting with 09.');
  const existing = store.state.users.find((u) => u.mobileNumber === mobile);
  if (existing) return { user: existing, created: false };

  const seq = ++store.state.seq.user;
  const user: User = {
    userId: `USR-${String(seq).padStart(3, '0')}`,
    name: `GCash User ••${mobile.slice(-4)}`,
    mobileNumber: mobile,
    tier: 'Member',
    pointsBalance: 0,
    lifetimePoints: 0,
    createdAt: store.nowIso(),
  };
  store.state.users.push(user);
  store.save();
  return { user, created: true };
}

function nextTxnId(store: Store, type: TransactionType) {
  return `TXN-${type}-${++store.state.seq.txn}`;
}

/** Append a ledger entry. `at` overrides the timestamp (used by the generated history). */
export function logTxn(store: Store, txn: Omit<Transaction, 'transactionId' | 'timestamp'>, at?: string): Transaction {
  const full: Transaction = { transactionId: nextTxnId(store, txn.type), timestamp: at ?? store.nowIso(), ...txn };
  store.state.transactions.push(full);
  return full;
}

// ---- Earn (PRD §6.2 POST /merchant/earn) ----

export function earnPoints(store: Store, input: { merchantId: unknown; userId: unknown; grossAmount: unknown }) {
  const gross = typeof input.grossAmount === 'string' ? Number(input.grossAmount) : input.grossAmount;
  if (typeof gross !== 'number' || !Number.isFinite(gross) || gross <= 0) {
    throw badRequest('INVALID_AMOUNT', 'Gross sales amount must be a positive number.');
  }
  const merchant = findMerchant(store, String(input.merchantId ?? ''));
  const user = resolveMember(store, String(input.userId ?? ''));
  const ratio = PROGRAM.spendPerPoint;
  const points = Math.floor(gross / ratio);
  if (points < 1) throw badRequest('BELOW_MINIMUM_SPEND', `Minimum spend is ₱${ratio} to earn 1 point.`);

  user.pointsBalance += points;
  user.lifetimePoints += points;
  user.tier = tierFor(user.lifetimePoints);
  const txn = logTxn(store, { type: 'EARN', userId: user.userId, merchantId: merchant.merchantId, grossAmount: round2(gross), pointsAmount: points, voucherId: null });
  store.save();
  return { success: true as const, transactionId: txn.transactionId, pointsAwarded: points, updatedCustomerBalance: user.pointsBalance, customerName: user.name };
}

// ---- Claim (PRD §6.2 POST /customer/vouchers/claim) ----

const VOUCHER_PREFIX: Record<RewardCategory, string> = { Entertainment: 'CINEMA', Parking: 'PARK', 'Food & Dining': 'FOOD', Retail: 'RETAIL' };

function newVoucherId(store: Store, category: RewardCategory, rng: () => number = store.random) {
  const taken = new Set(store.state.vouchers.map((v) => v.voucherId));
  for (let i = 0; i < 50; i++) {
    const id = `VOUCH-${VOUCHER_PREFIX[category]}-${1000 + Math.floor(rng() * 9000)}`;
    if (!taken.has(id)) return id;
  }
  // Practically unreachable for a POC; fall back to a sequential suffix
  return `VOUCH-${VOUCHER_PREFIX[category]}-${10000 + store.state.vouchers.length}`;
}

export const isPastDate = (store: Store, yyyyMmDd: string) => manilaDate(store.nowIso()) > yyyyMmDd;

/** `opts` lets the generated history claim at a past time with its own deterministic random source. */
export function claimVoucher(store: Store, input: { userId: unknown; rewardId: unknown }, opts: { at?: string; rng?: () => number } = {}) {
  const user = findUser(store, String(input.userId ?? ''));
  const reward = store.state.rewards.find((r) => r.rewardId === input.rewardId);
  if (!reward) throw notFound('REWARD_NOT_FOUND', 'That reward is no longer in the catalog.');
  if (reward.status !== 'ACTIVE' || isPastDate(store, reward.validUntil)) throw conflict('REWARD_UNAVAILABLE', `${reward.title} is not available right now.`);
  if (reward.stockQuantity < 1) throw conflict('OUT_OF_STOCK', `${reward.title} is out of stock.`);
  if (user.pointsBalance < reward.pointsRequired) {
    throw conflict('INSUFFICIENT_POINTS', `You need ${reward.pointsRequired - user.pointsBalance} more points for ${reward.title}.`);
  }

  user.pointsBalance -= reward.pointsRequired;
  reward.stockQuantity -= 1;
  const voucherId = newVoucherId(store, reward.category, opts.rng);
  const voucher: Voucher = {
    voucherId,
    rewardId: reward.rewardId,
    userId: user.userId,
    voucherCode: voucherQrPayload(voucherId),
    discountAmount: reward.discountAmount,
    status: 'ACTIVE',
    claimedAt: opts.at ?? store.nowIso(),
    redeemedAt: null,
    redeemedMerchantId: null,
    title: reward.title,
    validUntil: reward.validUntil,
    merchantId: reward.merchantId,
    category: reward.category,
    ...(reward.minSpend ? { minSpend: reward.minSpend } : {}),
    ...(reward.maxBillPercent ? { maxBillPercent: reward.maxBillPercent } : {}),
  };
  store.state.vouchers.push(voucher);
  logTxn(store, { type: 'CLAIM', userId: user.userId, merchantId: null, grossAmount: null, pointsAmount: -reward.pointsRequired, voucherId }, opts.at);
  store.save();
  return { success: true as const, voucher: { ...voucherView(store, voucher), termsText: rewardTerms(voucher, store.state.merchants) }, newPointsBalance: user.pointsBalance };
}

/** Voucher as clients see it: ACTIVE vouchers past validUntil read as EXPIRED. */
export function voucherView(store: Store, v: Voucher): Voucher {
  return v.status === 'ACTIVE' && isPastDate(store, v.validUntil) ? { ...v, status: 'EXPIRED' } : { ...v };
}

export function vouchersFor(store: Store, userId: string) {
  findUser(store, userId);
  return store.state.vouchers
    .filter((v) => v.userId === userId)
    .map((v) => ({ ...voucherView(store, v), termsText: rewardTerms(v, store.state.merchants) }))
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
}

// ---- Burn (PRD §6.2 POST /merchant/burn/validate + confirm) ----

function findVoucherByCode(store: Store, code: unknown) {
  const id = String(code ?? '').trim().toUpperCase().replace(/^GCASH-VOUCHER-/, '');
  return store.state.vouchers.find((v) => v.voucherId === id);
}

const merchantName = (store: Store, id: string | null | undefined) => store.state.merchants.find((m) => m.merchantId === id)?.name;

/** A voucher's category (stored at claim; older vouchers fall back to their reward's). */
const voucherCategory = (store: Store, v: Voucher) => v.category ?? store.state.rewards.find((r) => r.rewardId === v.rewardId)?.category;

/**
 * Store-bound vouchers (merchantId set) redeem only at that store. Common vouchers redeem at any store of their
 * category's kind, e.g. the retail gift voucher at any retail store but not at the cinema.
 */
function wrongStore(store: Store, v: Voucher, merchantId: string | undefined) {
  if (!merchantId) return false;
  if (v.merchantId) return v.merchantId !== merchantId;
  const category = voucherCategory(store, v);
  return !!category && !storesForCategory(category, store.state.merchants).some((m) => m.merchantId === merchantId);
}

/** Why this voucher can't be used at this store right now, or null if it can (POS checkout). */
export function voucherProblem(store: Store, v: Voucher, merchantId: string): string | null {
  if (v.status === 'REDEEMED') return 'Already used';
  if (voucherView(store, v).status === 'EXPIRED') return `Expired on ${v.validUntil}`;
  if (wrongStore(store, v, merchantId)) return `Only at ${validAt(store, v)}`;
  return null;
}

const validAt = (store: Store, v: Voucher) => (v.merchantId ? merchantName(store, v.merchantId) : anyStoreLabel(voucherCategory(store, v), store.state.merchants));

export function validateVoucher(store: Store, code: unknown, merchantId?: unknown): ValidateResponse {
  const v = findVoucherByCode(store, code);
  if (!v) return { success: true, status: 'INVALID', reason: 'NOT_FOUND' };
  const view = voucherView(store, v);
  const customerName = findUser(store, v.userId).name;
  if (view.status === 'REDEEMED') {
    return { success: true, status: 'REDEEMED', voucher: view, customerName, redeemedMerchantName: merchantName(store, v.redeemedMerchantId) };
  }
  if (view.status === 'EXPIRED') return { success: true, status: 'INVALID', reason: 'EXPIRED', voucher: view, customerName };
  if (wrongStore(store, v, typeof merchantId === 'string' ? merchantId : undefined)) {
    return { success: true, status: 'INVALID', reason: 'WRONG_STORE', voucher: view, customerName, validAtMerchantName: validAt(store, v) };
  }
  return { success: true, status: 'ACTIVE', voucher: view, customerName };
}

export function confirmRedemption(store: Store, input: { voucherCode: unknown; merchantId: unknown }) {
  const merchant = findMerchant(store, String(input.merchantId ?? ''));
  const v = findVoucherByCode(store, input.voucherCode);
  if (!v) throw notFound('VOUCHER_NOT_FOUND', 'Invalid voucher code.');
  if (v.status === 'REDEEMED') throw conflict('ALREADY_REDEEMED', 'This voucher has already been used.');
  if (voucherView(store, v).status === 'EXPIRED') throw conflict('VOUCHER_EXPIRED', `This voucher expired on ${v.validUntil}.`);
  if (wrongStore(store, v, merchant.merchantId)) throw conflict('WRONG_STORE', `This voucher can only be redeemed at ${validAt(store, v)}.`);

  v.status = 'REDEEMED';
  v.redeemedAt = store.nowIso();
  v.redeemedMerchantId = merchant.merchantId;
  const txn = logTxn(store, { type: 'REDEEM', userId: v.userId, merchantId: merchant.merchantId, grossAmount: null, pointsAmount: 0, voucherId: v.voucherId });
  store.save();
  return { success: true as const, message: 'Voucher successfully redeemed.', transactionId: txn.transactionId };
}

export function latestVoucher(store: Store) {
  const v = store.state.vouchers.at(-1);
  if (!v) throw notFound('NO_VOUCHERS', 'No vouchers have been claimed yet.');
  return voucherView(store, v);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
