import { MALL, manilaDate, type Campaign, type Cart, type Merchant, type Product, type Reward, type Sale, type Transaction, type User, type Voucher } from '@gcash/shared';
import { CART_TEMPLATES, seedCampaigns, seedProducts, seedRewardRequests } from './seed-catalog';

export interface DbState {
  users: User[];
  merchants: Merchant[];
  rewards: Reward[];
  vouchers: Voucher[];
  transactions: Transaction[];
  // v2
  products: Product[];
  carts: Cart[];
  campaigns: Campaign[];
  sales: Sale[];
  seq: { user: number; txn: number; cart: number; sale: number; campaign: number };
}

/** Short store code used in cart/bill ids: MERCH-HM-01 → HM, MERCH-AYALA-CINEMA → CINEMA */
export const storeCode = (merchantId: string) => merchantId.replace(/^MERCH-(AYALA-)?/, '').replace(/-\d+$/, '');

/** A fresh set of OPEN demo carts for one store (from CART_TEMPLATES). */
export function makeCarts(state: Pick<DbState, 'products' | 'seq'>, merchantId: string, nowIso: string): Cart[] {
  return (CART_TEMPLATES[merchantId] ?? []).map(([label, items]) => ({
    cartId: `CART-${storeCode(merchantId)}-${++state.seq.cart}`,
    merchantId,
    label,
    status: 'OPEN' as const,
    createdAt: nowIso,
    lines: items.map(([sku, qty]) => {
      const p = state.products.find((x) => x.sku === sku)!;
      return { sku, name: p.name, category: p.category, tags: p.tags, unitPrice: p.price, qty };
    }),
  }));
}

const SPONSOR = '100% Ayala Mall Manila Bay Marketing Fund';

// PRD §2.1 master list
const MERCHANTS: Array<[string, string, string, string]> = [
  ['MERCH-HM-01', 'H&M', 'Apparel & Fashion', 'Ground Floor, Main Atrium'],
  ['MERCH-MANGO-02', 'Mango', 'Apparel & Fashion', '2nd Level, Fashion Hall'],
  ['MERCH-PENS-03', 'Penshoppe', 'Apparel & Fashion', '2nd Level, Main Hall'],
  ['MERCH-ADI-04', 'Adidas', 'Sports & Lifestyle', 'Ground Floor, Sports Wing'],
  ['MERCH-SAMS-05', 'Samsung', 'Electronics & Tech', '3rd Level, Tech Zone'],
  ['MERCH-TOYS-06', 'Toys "R" Us', 'Toys & Family', '3rd Level, Family Zone'],
  ['MERCH-AYALA-CINEMA', 'Ayala Malls Cinema', 'Entertainment', '4th Level, Cinema Complex'],
  ['MERCH-AYALA-PARK', 'Ayala Malls Parking', 'Infrastructure', 'Basement 1 & 2'],
  // Not in PRD §2.1: gives the Food Court token a store to be redeemed at (CLAUDE.md decision 6)
  ['MERCH-AYALA-FOOD', 'Ayala Malls Food Court', 'Food & Dining', '3rd Level, Food Hall'],
];

export function buildSeed(now: Date = new Date()): DbState {
  const nowIso = now.toISOString();
  const state: DbState = {
    users: [
      { userId: 'USR-001', name: 'Juan Dela Cruz', mobileNumber: '09171112222', tier: 'Member', pointsBalance: 0, lifetimePoints: 0, createdAt: '2026-10-20T02:00:00.000Z' },
      { userId: 'USR-002', name: 'Maria Santos', mobileNumber: '09183334444', tier: 'Member', pointsBalance: 150, lifetimePoints: 150, createdAt: '2026-10-20T02:00:00.000Z' },
    ],
    merchants: MERCHANTS.map(([merchantId, name, category, location]) => ({ merchantId, name, category, location, mallId: MALL.mallId, earnRatePerPoint: 100 })),
    rewards: [
      { rewardId: 'REW-CINEMA-50', title: 'Ayala Cinema ₱50 Off Ticket', category: 'Entertainment', pointsRequired: 50, discountAmount: 50, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 500, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-CINEMA' },
      { rewardId: 'REW-PARK-100', title: 'Ayala Parking ₱100 Discount', category: 'Parking', pointsRequired: 100, discountAmount: 100, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 300, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-PARK' },
      { rewardId: 'REW-FOOD-30', title: 'Food Court ₱30 Discount Token', category: 'Food & Dining', pointsRequired: 30, discountAmount: 30, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 1000, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-FOOD' },
      // Store retail rewards: redeemable only at their own store
      { rewardId: 'REW-HM-200', title: 'H&M ₱200 Off Voucher', category: 'Retail', pointsRequired: 200, discountAmount: 200, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 200, validUntil: '2026-12-31', merchantId: 'MERCH-HM-01' , minSpend: 1000, maxBillPercent: 50 },
      { rewardId: 'REW-MANGO-150', title: 'Mango ₱150 Off Voucher', category: 'Retail', pointsRequired: 150, discountAmount: 150, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 200, validUntil: '2026-12-31', merchantId: 'MERCH-MANGO-02' , minSpend: 1500, maxBillPercent: 50 },
      { rewardId: 'REW-ADI-300', title: 'Adidas ₱300 Off Voucher', category: 'Retail', pointsRequired: 300, discountAmount: 300, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 150, validUntil: '2026-12-31', merchantId: 'MERCH-ADI-04' , minSpend: 3000, maxBillPercent: 50 },
      { rewardId: 'REW-SAMS-500', title: 'Samsung ₱500 Off Voucher', category: 'Retail', pointsRequired: 500, discountAmount: 500, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 100, validUntil: '2026-12-31', merchantId: 'MERCH-SAMS-05' , minSpend: 5000, maxBillPercent: 50 },
      // The one common voucher: no merchantId, so any retail store can redeem it (not cinema/parking/food court)
      { rewardId: 'REW-MALL-100', title: 'Ayala Malls ₱100 Retail Gift Voucher', category: 'Retail', pointsRequired: 100, discountAmount: 100, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 500, validUntil: '2026-12-31' , minSpend: 500, maxBillPercent: 50 },
      // More mall rewards (user request, 2026-10-29); each follows the category → store rule
      { rewardId: 'REW-CINEMA-250', title: 'Ayala Cinema Free Regular Ticket', category: 'Entertainment', pointsRequired: 250, discountAmount: 250, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 150, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-CINEMA' },
      { rewardId: 'REW-PARK-60', title: 'Ayala Parking 3-Hour Free Pass', category: 'Parking', pointsRequired: 60, discountAmount: 60, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 300, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-PARK' },
      { rewardId: 'REW-FOOD-100', title: 'Food Court ₱100 Meal Voucher', category: 'Food & Dining', pointsRequired: 100, discountAmount: 100, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 300, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-FOOD' },
      { rewardId: 'REW-PENS-100', title: 'Penshoppe ₱100 Off Voucher', category: 'Retail', pointsRequired: 100, discountAmount: 100, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 200, validUntil: '2026-12-31', merchantId: 'MERCH-PENS-03' , minSpend: 500, maxBillPercent: 50 },
      { rewardId: 'REW-TOYS-250', title: 'Toys "R" Us ₱250 Off Voucher', category: 'Retail', pointsRequired: 250, discountAmount: 250, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 120, validUntil: '2026-12-31', merchantId: 'MERCH-TOYS-06' , minSpend: 1500, maxBillPercent: 50 },
      { rewardId: 'REW-CINEMA-120', title: 'Ayala Cinema Popcorn & Drink Combo', category: 'Entertainment', pointsRequired: 120, discountAmount: 120, sponsor: SPONSOR, status: 'ACTIVE', stockQuantity: 300, validUntil: '2026-12-31', merchantId: 'MERCH-AYALA-CINEMA' },
    ],
    vouchers: [],
    // Maria's seeded balance is backed by a real earn so history and metrics agree
    transactions: [
      { transactionId: 'TXN-EARN-9001', type: 'EARN', userId: 'USR-002', merchantId: 'MERCH-HM-01', grossAmount: 15000, pointsAmount: 150, voucherId: null, timestamp: '2026-10-27T06:30:00.000Z' },
    ],
    products: seedProducts(),
    carts: [],
    campaigns: seedCampaigns(manilaDate(nowIso), nowIso),
    sales: [],
    seq: { user: 2, txn: 9001, cart: 1000, sale: 20000, campaign: 1007 },
  };
  // Store-specific rewards belong to (and are funded by) their merchant; the common one is the admin's
  for (const r of state.rewards) r.createdBy = r.merchantId ? 'MERCHANT' : 'ADMIN';
  state.rewards.push(...seedRewardRequests(nowIso));
  for (const m of state.merchants) state.carts.push(...makeCarts(state, m.merchantId, nowIso));
  return state;
}

export { SPONSOR };
