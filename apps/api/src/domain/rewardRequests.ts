import { rewardTerms, storesForCategory, type MerchantRewardRequest, type Reward, type RewardCategory } from '@gcash/shared';
import { SPONSOR, storeCode } from '../seed';
import type { Store } from '../store';
import { badRequest, conflict, notFound } from './errors';
import { findMerchant } from './loyalty';

const CATEGORIES: RewardCategory[] = ['Entertainment', 'Parking', 'Food & Dining', 'Retail'];
const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** A merchant proposes a reward redeemable (and funded) only at its own store; it waits for admin approval. */
export function submitMerchantReward(store: Store, body: Partial<MerchantRewardRequest>): Reward {
  const merchant = findMerchant(store, String(body.merchantId ?? ''));
  const title = String(body.title ?? '').trim();
  const category = body.category as RewardCategory;
  const pointsRequired = num(body.pointsRequired);
  const discountAmount = num(body.discountAmount);
  const stockQuantity = num(body.stockQuantity);
  const validUntil = String(body.validUntil ?? '');
  if (!title) throw badRequest('INVALID_REWARD', 'Reward title is required.');
  if (!CATEGORIES.includes(category)) throw badRequest('INVALID_REWARD', 'Choose a category.');
  if (!storesForCategory(category, [merchant]).length) {
    throw badRequest('INVALID_REWARD', `${merchant.name} can't offer ${category} rewards: they can only be redeemed at ${category === 'Retail' ? 'retail stores' : 'their own venue'}.`);
  }
  if (!posInt(pointsRequired)) throw badRequest('INVALID_REWARD', 'Points cost must be a whole number above 0.');
  if (!(typeof discountAmount === 'number' && Number.isFinite(discountAmount) && discountAmount > 0)) throw badRequest('INVALID_REWARD', 'Discount value must be above ₱0.00.');
  if (!posInt(stockQuantity)) throw badRequest('INVALID_REWARD', 'Stock quantity must be a whole number above 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw badRequest('INVALID_REWARD', 'Valid-through date is required.');
  // Optional T&Cs
  const minSpend = body.minSpend === undefined || String(body.minSpend) === '' ? 0 : num(body.minSpend);
  const maxBillPercent = body.maxBillPercent === undefined || String(body.maxBillPercent) === '' ? 100 : num(body.maxBillPercent);
  if (!(typeof minSpend === 'number' && Number.isFinite(minSpend) && minSpend >= 0)) throw badRequest('INVALID_REWARD', 'Minimum order must be ₱0 or more.');
  if (!(typeof maxBillPercent === 'number' && Number.isInteger(maxBillPercent) && maxBillPercent >= 1 && maxBillPercent <= 100)) {
    throw badRequest('INVALID_REWARD', 'Max share of the bill must be a whole % from 1 to 100.');
  }

  const base = `REW-${storeCode(merchant.merchantId)}-${Math.round(discountAmount)}`;
  let rewardId = base;
  for (let i = 2; store.state.rewards.some((r) => r.rewardId === rewardId); i++) rewardId = `${base}-${i}`;
  const reward: Reward = {
    rewardId,
    title,
    category,
    pointsRequired,
    discountAmount: Math.round(discountAmount * 100) / 100,
    sponsor: SPONSOR,
    status: 'PENDING',
    stockQuantity,
    validUntil,
    merchantId: merchant.merchantId,
    ...(minSpend > 0 ? { minSpend } : {}),
    ...(maxBillPercent < 100 ? { maxBillPercent } : {}),
    createdBy: 'MERCHANT',
    submittedAt: store.nowIso(),
  };
  store.state.rewards.push(reward);
  store.save();
  return withTerms(store, reward);
}

function findReward(store: Store, id: string) {
  const r = store.state.rewards.find((x) => x.rewardId === id);
  if (!r) throw notFound('REWARD_NOT_FOUND', `No reward found for "${id}".`);
  return r;
}

/** Reward as returned by the API, with its generated T&Cs line. */
export const withTerms = (store: Store, r: Reward): Reward => ({ ...r, termsText: rewardTerms(r, store.state.merchants) });

export function merchantRewards(store: Store, merchantId: string) {
  findMerchant(store, merchantId);
  return store.state.rewards
    .filter((r) => r.merchantId === merchantId)
    .map((r) => withTerms(store, r))
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || a.rewardId.localeCompare(b.rewardId));
}

export function decideReward(store: Store, id: string, decision: 'approve' | 'reject', reason?: unknown) {
  const r = findReward(store, id);
  if (r.status !== 'PENDING') throw conflict('NOT_PENDING', `${r.title} is not waiting for approval.`);
  if (decision === 'reject') {
    const why = String(reason ?? '').trim();
    if (!why) throw badRequest('REASON_REQUIRED', 'Tell the merchant why the reward is rejected.');
    r.status = 'REJECTED';
    r.rejectReason = why;
  } else {
    r.status = 'ACTIVE';
  }
  r.decidedAt = store.nowIso();
  store.save();
  return r;
}

export function withdrawReward(store: Store, id: string) {
  const r = findReward(store, id);
  if (r.status !== 'PENDING') throw conflict('NOT_PENDING', 'Only rewards waiting for approval can be withdrawn.');
  r.status = 'WITHDRAWN';
  r.decidedAt = store.nowIso();
  store.save();
  return r;
}
