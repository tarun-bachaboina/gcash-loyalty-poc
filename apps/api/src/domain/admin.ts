import type { CreateRewardRequest, Reward, RewardStatus } from '@gcash/shared';
import { SPONSOR } from '../seed';
import type { Store } from '../store';
import { badRequest, conflict, notFound } from './errors';
import { withTerms } from './rewardRequests';

const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * v2: the mall authors only common rewards (Retail, redeemable at any retail store). Store-specific rewards are
 * submitted by merchants and approved in Approvals. Published straight to the catalogue.
 */
export function createReward(store: Store, body: Partial<CreateRewardRequest> & { merchantId?: unknown }): Reward {
  const title = String(body.title ?? '').trim();
  const pointsRequired = num(body.pointsRequired);
  const discountAmount = num(body.discountAmount);
  const stockQuantity = num(body.stockQuantity);
  const validUntil = String(body.validUntil ?? '');
  if (!title) throw badRequest('INVALID_REWARD', 'Reward title is required.');
  if (String(body.merchantId ?? '').trim()) throw badRequest('INVALID_REWARD', 'Store rewards are created by the store and approved in Approvals. The mall creates common rewards only.');
  if (body.category !== 'Retail') throw badRequest('INVALID_REWARD', 'Common rewards are Retail rewards, redeemable at any retail store.');
  if (!isPositive(pointsRequired) || !Number.isInteger(pointsRequired)) throw badRequest('INVALID_REWARD', 'Points cost must be a whole number above 0.');
  if (!isPositive(discountAmount)) throw badRequest('INVALID_REWARD', 'Face value must be above ₱0.00.');
  if (!isPositive(stockQuantity) || !Number.isInteger(stockQuantity)) throw badRequest('INVALID_REWARD', 'Stock quantity must be a whole number above 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw badRequest('INVALID_REWARD', 'Valid-through date is required.');
  const minSpend = body.minSpend === undefined || String(body.minSpend) === '' ? 0 : num(body.minSpend);
  const maxBillPercent = body.maxBillPercent === undefined || String(body.maxBillPercent) === '' ? 100 : num(body.maxBillPercent);
  if (!(typeof minSpend === 'number' && Number.isFinite(minSpend) && minSpend >= 0)) throw badRequest('INVALID_REWARD', 'Minimum order must be ₱0 or more.');
  if (!(typeof maxBillPercent === 'number' && Number.isInteger(maxBillPercent) && maxBillPercent >= 1 && maxBillPercent <= 100)) {
    throw badRequest('INVALID_REWARD', 'Max share of the bill must be a whole % from 1 to 100.');
  }

  const base = `REW-RETAIL-${Math.round(discountAmount)}`;
  let rewardId = base;
  for (let i = 2; store.state.rewards.some((r) => r.rewardId === rewardId); i++) rewardId = `${base}-${i}`;

  const reward: Reward = {
    rewardId,
    title,
    category: 'Retail',
    pointsRequired,
    discountAmount: Math.round(discountAmount * 100) / 100,
    sponsor: SPONSOR,
    status: 'ACTIVE',
    stockQuantity,
    validUntil,
    ...(minSpend > 0 ? { minSpend } : {}),
    ...(maxBillPercent < 100 ? { maxBillPercent } : {}),
    createdBy: 'ADMIN',
    submittedAt: store.nowIso(),
  };
  store.state.rewards.push(reward);
  store.save();
  return withTerms(store, reward);
}

export function setRewardStatus(store: Store, rewardId: string, status: unknown): Reward {
  const reward = store.state.rewards.find((r) => r.rewardId === rewardId);
  if (!reward) throw notFound('REWARD_NOT_FOUND', `No reward found for "${rewardId}".`);
  if (status !== 'ACTIVE' && status !== 'PAUSED') throw badRequest('INVALID_STATUS', 'Status must be ACTIVE or PAUSED.');
  // Pause/activate only applies to approved rewards; pending ones go through approve/reject
  if (reward.status !== 'ACTIVE' && reward.status !== 'PAUSED') throw conflict('NOT_APPROVED', `${reward.title} is ${reward.status.toLowerCase()}: approve it first.`);
  reward.status = status as RewardStatus;
  store.save();
  return reward;
}
