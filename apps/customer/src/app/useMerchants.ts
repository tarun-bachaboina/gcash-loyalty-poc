import { anyStoreLabel, apiData, type Merchant, type Reward, type Voucher } from '@gcash/shared';
import { useAsync } from '@gcash/ui';

/** Merchant names for sponsor lines and voucher instructions. */
export function useMerchants() {
  const q = useAsync(() => apiData<Merchant[]>('/merchant/list'), []);
  const byId = new Map((q.data ?? []).map((m) => [m.merchantId, m]));
  return { ...q, byId };
}

/**
 * The C-3 sponsor line: just the store ("Ayala Malls Cinema"); the common retail reward says "Any retail store".
 * v2: no "(100% Mall Funded)" / "Funded by": the store where a voucher is used funds it.
 */
export function sponsorLine(reward: Pick<Reward, 'merchantId' | 'category'>, byId: Map<string, Merchant>) {
  if (reward.merchantId) return byId.get(reward.merchantId)?.name ?? 'Ayala Mall Manila Bay';
  return reward.category === 'Retail' ? 'Any retail store' : 'Any participating store';
}

/** Where to present a voucher (C-4 instructions): its store, or e.g. "any retail store (H&M, Mango, …)". */
export function redeemAt(v: Pick<Voucher, 'merchantId' | 'category'>, byId: Map<string, Merchant>) {
  if (v.merchantId) return byId.get(v.merchantId)?.name ?? 'its store';
  return anyStoreLabel(v.category, [...byId.values()]);
}
