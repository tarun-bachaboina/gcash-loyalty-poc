import { manilaDate, type User } from '@gcash/shared';
import { shiftDate } from './domain/campaigns';
import { recordSale } from './domain/checkout';
import { claimVoucher } from './domain/loyalty';
import { CART_TEMPLATES, syntheticMembers } from './seed-catalog';
import type { Store } from './store';

/** Small deterministic PRNG so the generated history is identical on every run. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 60;
const MEMBERS = 24;
/** Typical bills per day per store (weekends get a bump) */
const TRAFFIC: Record<string, number> = {
  'MERCH-HM-01': 4,
  'MERCH-MANGO-02': 2,
  'MERCH-PENS-03': 3,
  'MERCH-ADI-04': 3,
  'MERCH-SAMS-05': 2,
  'MERCH-TOYS-06': 2,
  'MERCH-AYALA-CINEMA': 5,
  'MERCH-AYALA-PARK': 6,
  'MERCH-AYALA-FOOD': 7,
};
// Shopping hours weighted to lunch and evening peaks
const HOURS = [10, 11, 12, 12, 13, 13, 14, 15, 16, 17, 18, 18, 19, 19, 20, 21];

/**
 * Fills the store with ~60 days of synthetic sales for analytics, using synthetic members (USR-101…).
 * Juan (USR-001) and Maria (USR-002) are left untouched so live demos stay predictable.
 * Runs every sale through the real checkout engine, so campaigns, vouchers and points follow the same rules.
 */
export function generateHistory(store: Store) {
  const rng = mulberry32(20261029);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const today = manilaDate(store.nowIso());
  const start = shiftDate(today, -DAYS);

  const members: User[] = syntheticMembers(MEMBERS).map((m) => ({
    ...m,
    tier: 'Member',
    pointsBalance: 0,
    lifetimePoints: 0,
    createdAt: new Date(`${shiftDate(start, -10)}T09:00:00+08:00`).toISOString(),
  }));
  for (const m of members) if (!store.state.users.some((u) => u.userId === m.userId)) store.state.users.push(m);

  for (let d = 0; d < DAYS; d++) {
    const date = shiftDate(start, d);
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const sales: { merchantId: string; at: string }[] = [];
    for (const merchantId of Object.keys(TRAFFIC)) {
      const n = Math.max(0, Math.round(TRAFFIC[merchantId] * (weekend ? 1.5 : 1) + (rng() * 3 - 1.5)));
      for (let i = 0; i < n; i++) {
        const minute = String(Math.floor(rng() * 60)).padStart(2, '0');
        sales.push({ merchantId, at: new Date(`${date}T${String(pick(HOURS)).padStart(2, '0')}:${minute}:00+08:00`).toISOString() });
      }
    }
    sales.sort((a, b) => a.at.localeCompare(b.at));

    for (const s of sales) {
      const [, items] = pick(CART_TEMPLATES[s.merchantId]);
      const lines = items.map(([sku, qty]) => {
        const p = store.state.products.find((x) => x.sku === sku)!;
        return { sku, name: p.name, category: p.category, tags: p.tags, unitPrice: p.price, qty };
      });
      const member = rng() < 0.72 ? pick(members).userId : undefined;
      recordSale(store, { merchantId: s.merchantId, lines, member, at: s.at, cashier: 'Cashier 001' });
    }

    // Some members turn points into vouchers at the end of the day
    const evening = new Date(`${date}T21:30:00+08:00`).toISOString();
    for (const m of members) {
      if (rng() > 0.18) continue;
      const user = store.state.users.find((u) => u.userId === m.userId)!;
      const affordable = store.state.rewards.filter((r) => r.status === 'ACTIVE' && r.stockQuantity > 0 && r.pointsRequired <= user.pointsBalance && r.validUntil >= date);
      if (!affordable.length) continue;
      claimVoucher(store, { userId: user.userId, rewardId: pick(affordable).rewardId }, { at: evening, rng });
    }
  }
}
