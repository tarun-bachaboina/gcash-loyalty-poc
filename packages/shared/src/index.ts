// Shared API contract for all surfaces. Mirrors PRD §6.1 — change here first, then API, then apps.

export const API_BASE = '/api/v1';

export const MALL = {
  mallId: 'MALL-AMMB-01',
  name: 'Ayala Mall Manila Bay',
} as const;

export type Tier = 'Member' | 'VIP';

export interface User {
  userId: string; // USR-001
  name: string;
  mobileNumber: string; // 11 digits, starts with 09
  tier: Tier;
  pointsBalance: number;
  createdAt: string; // ISO 8601
  // POC extension: drives the Member → VIP tier (VIP_THRESHOLD)
  lifetimePoints: number;
}

export const VIP_THRESHOLD = 1000;
export const MOBILE_PATTERN = /^09\d{9}$/;

export interface Merchant {
  merchantId: string; // MERCH-ADI-04
  name: string;
  category: string;
  location: string;
  mallId: string;
  earnRatePerPoint: number; // ₱ spend per 1 point
}

/** PRD M-1 store branch labels, e.g. "Adidas - Sports Wing". */
export const BRANCH_LABEL: Record<string, string> = {
  'MERCH-HM-01': 'H&M - Main Atrium',
  'MERCH-MANGO-02': 'Mango - Fashion Hall',
  'MERCH-PENS-03': 'Penshoppe - Main Hall',
  'MERCH-ADI-04': 'Adidas - Sports Wing',
  'MERCH-SAMS-05': 'Samsung - Tech Zone',
  'MERCH-TOYS-06': 'Toys "R" Us - Family Zone',
  'MERCH-AYALA-CINEMA': 'Ayala Malls Cinema - 4th Floor',
  'MERCH-AYALA-PARK': 'Ayala Malls Parking - B1/B2',
  // Not in the PRD list: added so the Food Court token has a store to be redeemed at (CLAUDE.md decision 6)
  'MERCH-AYALA-FOOD': 'Ayala Malls Food Court - Food Hall',
};

export const branchLabel = (m: Pick<Merchant, 'merchantId' | 'name'>) => BRANCH_LABEL[m.merchantId] ?? m.name;

export type RewardCategory = 'Entertainment' | 'Parking' | 'Food & Dining' | 'Retail';
/** PENDING / REJECTED / WITHDRAWN: merchant-submitted rewards awaiting or after admin review (v2). */
export type RewardStatus = 'ACTIVE' | 'PAUSED' | 'PENDING' | 'REJECTED' | 'WITHDRAWN';

/**
 * Which kinds of store can redeem each reward category (by Merchant.category).
 * Non-retail rewards are tied to their one venue; only Retail rewards may be mall-wide (no merchantId).
 */
const STORE_CATEGORIES: Record<RewardCategory, string[]> = {
  Entertainment: ['Entertainment'],
  Parking: ['Infrastructure'],
  'Food & Dining': ['Food & Dining'],
  Retail: ['Apparel & Fashion', 'Sports & Lifestyle', 'Electronics & Tech', 'Toys & Family'],
};

export const storesForCategory = <M extends Pick<Merchant, 'category'>>(category: RewardCategory, merchants: M[]) =>
  merchants.filter((m) => STORE_CATEGORIES[category].includes(m.category));

export const allowsAnyStore = (category: RewardCategory) => category === 'Retail';

/** "any retail store (H&M, Mango, …)": where an unbound (common) reward of this category can be redeemed. */
export const anyStoreLabel = (category: RewardCategory | undefined, merchants: Pick<Merchant, 'category' | 'name'>[]) =>
  category ? `any ${category === 'Retail' ? 'retail' : category.toLowerCase()} store (${storesForCategory(category, merchants).map((m) => m.name).join(', ')})` : 'any participating store';

export interface Reward {
  rewardId: string; // REW-CINEMA-50
  title: string;
  category: RewardCategory;
  pointsRequired: number;
  discountAmount: number; // ₱ face value
  sponsor: string;
  status: RewardStatus;
  // v2: merchants submit their own rewards for approval; admins create the common (any retail store) ones
  createdBy?: 'MERCHANT' | 'ADMIN';
  submittedAt?: string;
  decidedAt?: string;
  rejectReason?: string;
  // POC extensions beyond PRD §6.1 (needed by screens A-3 / C-4)
  stockQuantity: number;
  validUntil: string; // YYYY-MM-DD
  /** The only store that can redeem it, e.g. MERCH-AYALA-CINEMA. Absent = any participating store. */
  merchantId?: string;
  // Voucher T&Cs (v2): minimum order (bill before vouchers) and the max share of the bill it can cover
  minSpend?: number;
  maxBillPercent?: number;
  /** Generated "Valid only at H&M · Min. order ₱1,000 · …" line (in API responses) */
  termsText?: string;
}

export type VoucherStatus = 'ACTIVE' | 'REDEEMED' | 'EXPIRED';

export interface Voucher {
  voucherId: string; // VOUCH-CINEMA-8821
  rewardId: string;
  userId: string;
  voucherCode: string; // GCASH-VOUCHER-<voucherId>
  discountAmount: number;
  status: VoucherStatus;
  claimedAt: string;
  redeemedAt: string | null;
  redeemedMerchantId: string | null;
  // POC extensions
  title: string;
  validUntil: string;
  /** Copied from the reward at claim time: the only store that can redeem it. */
  merchantId?: string;
  /** Copied from the reward at claim time. With no merchantId, any store of this category's kind can redeem it. */
  category?: RewardCategory;
  /** Copied from the reward's T&Cs at claim time */
  minSpend?: number;
  maxBillPercent?: number;
  /** Generated "Valid only at H&M · Min. order ₱1,000 · …" line (customer voucher list) */
  termsText?: string;
}

// EARN   = points issued at a merchant (customer +PTS)
// CLAIM  = points burned to claim a voucher (customer -PTS)
// REDEEM = voucher applied at a merchant checkout (no point movement)
export type TransactionType = 'EARN' | 'CLAIM' | 'REDEEM';

export interface Transaction {
  transactionId: string; // TXN-EARN-9021
  type: TransactionType;
  userId: string;
  merchantId: string | null;
  grossAmount: number | null;
  pointsAmount: number;
  voucherId: string | null;
  timestamp: string;
  // v2 (POS checkout): the bill this belongs to and, for EARN, the base/bonus split
  billId?: string;
  basePoints?: number;
  bonusPoints?: number;
  campaignIds?: string[];
}

// CLAIM transactions store a negative pointsAmount so the ledger sums to the balance.

export const memberQrPayload = (userId: string) => `GCASH-MEMBER-${userId}`;
export const voucherQrPayload = (voucherId: string) => `GCASH-VOUCHER-${voucherId}`;
export const humanMemberId = (u: Pick<User, 'userId' | 'mobileNumber'>) => `${u.userId}-${u.mobileNumber}`;

/** ISO timestamp → "YYYY-MM-DD" calendar date in Asia/Manila (the mall's business day). */
export function manilaDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

// ---- API envelopes ----

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export interface ApiData<T> {
  success: true;
  data: T;
}

// ---- Customer ----

export interface Program {
  mallName: string;
  baseSpendRatio: number;
  pointMonetaryValue: number;
}

export interface LoginRequest {
  mobileNumber: string;
}

export interface ClaimResponse {
  success: true;
  voucher: Voucher;
  newPointsBalance: number;
}

export interface HistoryEntry extends Transaction {
  merchantName: string | null;
  /** e.g. "Redeemed Ayala Cinema ₱50 Off Ticket" */
  description: string;
  /** v2: campaigns that added bonus points to this EARN */
  campaignNames?: string[];
}

// ---- Merchant ----

export interface EarnRequest {
  merchantId: string;
  /** USR-001, GCASH-MEMBER-USR-001, USR-001-09171112222 or a mobile number */
  userId: string;
  grossAmount: number;
}

export interface EarnResponse {
  success: true;
  transactionId: string;
  pointsAwarded: number;
  updatedCustomerBalance: number;
  customerName: string;
}

export type ValidateStatus = 'ACTIVE' | 'REDEEMED' | 'INVALID';

export interface ValidateResponse {
  success: true;
  status: ValidateStatus;
  /** INVALID only: why */
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'WRONG_STORE';
  voucher?: Voucher;
  customerName?: string;
  redeemedMerchantName?: string;
  /** WRONG_STORE only: the store that can redeem it */
  validAtMerchantName?: string;
}

export interface ValidateRequest {
  voucherCode: string;
  /** The validating store. Optional per PRD; when sent, store-bound vouchers are checked against it. */
  merchantId?: string;
}

export interface ConfirmResponse {
  success: true;
  message: string;
  transactionId: string;
}

export interface JournalEntry {
  transactionId: string;
  timestamp: string;
  type: 'EARN' | 'REDEEM';
  customerName: string;
  userId: string;
  grossAmount: number | null;
  pointsIssued: number;
  discountApplied: number;
  voucherId: string | null;
  status: 'Completed';
}

export interface Journal {
  date: string; // YYYY-MM-DD, Asia/Manila
  entries: JournalEntry[];
  totals: { earnCount: number; pointsIssued: number; redeemCount: number; discountValue: number };
}

// ---- Admin ----

export interface MerchantPerformance {
  merchantId: string;
  name: string;
  totalSales: number;
  pointsIssued: number;
  vouchersRedeemed: number;
  active: boolean;
  // v2
  bills: number;
  bonusPoints: number;
  discountsFunded: number;
  liveCampaigns: number;
}

export interface Dashboard {
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  activeVouchers: { count: number; value: number };
  activeMerchantCount: number;
  merchants: MerchantPerformance[];
  // v2
  /** Fixed programme values (A-2 retired) */
  program: { spendPerPoint: number; pointValue: number };
  campaigns: { live: number; scheduled: number; bonusPointsIssued: number };
  pendingApprovals: { campaigns: number; rewards: number };
  /** ₱ of voucher discounts given at stores (each store funds the vouchers redeemed there) */
  voucherDiscountsFunded: number;
}

export interface AuditRow extends Transaction {
  merchantName: string | null;
  customerName: string;
  /** Voucher face value for CLAIM / REDEEM rows */
  voucherValue: number | null;
  /** v2: names of the campaigns that boosted this EARN */
  campaignNames: string[];
}

/** v2: the mall only authors the common reward(s): Retail, redeemable at any retail store. Store rewards come from merchants. */
export interface CreateRewardRequest {
  title: string;
  category: 'Retail';
  pointsRequired: number;
  discountAmount: number;
  validUntil: string;
  stockQuantity: number;
  minSpend?: number;
  maxBillPercent?: number;
}

export { ApiRequestError, apiData, apiRequest } from './client';

// =====================================================================
// v2: products, carts, POS checkout, campaigns (Reference Docs/PLAN-v2-campaigns-pos-analytics.md)
// =====================================================================

/** Programme constants (v2 retired the A-2 rules screen): ₱100 spend = 1 point, 1 point = ₱1. */
export const PROGRAM = { spendPerPoint: 100, pointValue: 1 } as const;

export interface Product {
  sku: string; // HM-LIN-WHT
  merchantId: string;
  name: string;
  /** Store-level product category, e.g. "Menswear" (product campaigns can target it) */
  category: string;
  /** Finer targeting for product campaigns, e.g. "linen-shirt" */
  tags: string[];
  price: number;
}

export interface CartLine {
  sku: string;
  name: string;
  category: string;
  tags: string[];
  unitPrice: number;
  qty: number;
}

export type CartStatus = 'OPEN' | 'PAID';

export interface Cart {
  cartId: string; // CART-HM-1001
  merchantId: string;
  label: string; // "Weekend shopper"
  lines: CartLine[];
  status: CartStatus;
  billId?: string;
  createdAt: string;
}

export type CampaignType = 'BILL_MULTIPLIER' | 'PRODUCT_MULTIPLIER' | 'FLAT_BONUS';
export const CAMPAIGN_MULTIPLIERS = [1.5, 2, 3] as const;

/** Stored lifecycle. Display status (LIVE/SCHEDULED/ENDED) is derived from dates, budget and this. */
export type CampaignStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'ENDED';
export type CampaignDisplayStatus = 'PENDING' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'REJECTED' | 'WITHDRAWN';

export interface Campaign {
  campaignId: string; // CMP-1001
  merchantId: string;
  name: string;
  type: CampaignType;
  /** BILL_ / PRODUCT_MULTIPLIER: 1.5 | 2 | 3 */
  multiplier?: number;
  /** BILL_MULTIPLIER and FLAT_BONUS: minimum net bill (₱) */
  minSpend?: number;
  /** PRODUCT_MULTIPLIER: match cart lines by tag or by product category */
  productTag?: string;
  productCategory?: string;
  /** FLAT_BONUS: points added once per qualifying bill */
  flatBonus?: number;
  startDate: string; // YYYY-MM-DD (Asia/Manila), inclusive
  endDate: string; // inclusive
  /** Optional cap on bonus points; the campaign ends when it is used up */
  budgetPoints?: number;
  terms: string;
  status: CampaignStatus;
  submittedAt: string;
  decidedAt?: string;
  rejectReason?: string;
  endedAt?: string;
  endedReason?: 'MERCHANT' | 'ADMIN' | 'BUDGET';
  bonusPointsIssued: number;
}

export interface CampaignView extends Campaign {
  displayStatus: CampaignDisplayStatus;
  merchantName: string;
  /** "2× points on bills of ₱5,000 or more at Adidas" */
  mechanics: string;
  /** Merchant portal only: results so far (bills the campaign boosted and their net revenue) */
  stats?: { bills: number; revenue: number };
  /** Admin review: what the campaign would have cost on the store's last 30 days of member bills */
  estimate?: CampaignEstimate;
}

export interface CampaignEstimate {
  /** Member bills in the last 30 days that would have qualified */
  qualifyingBills: number;
  memberBills: number;
  /** Bonus points those bills would have earned (30 days) */
  bonusPoints30d: number;
  /** Scaled to the campaign's length and capped by its budget */
  projectedBonusPoints: number;
}

export interface CreateCampaignRequest {
  merchantId: string;
  name: string;
  type: CampaignType;
  multiplier?: number;
  minSpend?: number;
  productTag?: string;
  productCategory?: string;
  flatBonus?: number;
  startDate: string;
  endDate: string;
  budgetPoints?: number;
  terms: string;
}

export interface MerchantRewardRequest {
  merchantId: string;
  title: string;
  category: RewardCategory;
  pointsRequired: number;
  discountAmount: number;
  validUntil: string;
  stockQuantity: number;
  minSpend?: number;
  maxBillPercent?: number;
}

/** Reward/voucher T&Cs line: "Valid only at H&M · Min. order ₱1,000 · Covers up to 50% of the bill · Valid until 2026-12-31" */
export function rewardTerms(r: Pick<Reward, 'merchantId' | 'minSpend' | 'maxBillPercent' | 'validUntil'> & { category?: RewardCategory }, merchants: Pick<Merchant, 'merchantId' | 'name'>[]) {
  const where = r.merchantId
    ? `Valid only at ${merchants.find((m) => m.merchantId === r.merchantId)?.name ?? r.merchantId}`
    : r.category === 'Retail'
      ? 'Valid at any retail store'
      : 'Valid at any participating store';
  return [
    where,
    r.minSpend ? `Min. order ₱${r.minSpend.toLocaleString('en-PH')}` : null,
    r.maxBillPercent && r.maxBillPercent < 100 ? `Covers up to ${r.maxBillPercent}% of the bill` : null,
    `Valid until ${r.validUntil}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Plain-language mechanics shown to merchants, admins and shoppers. */
export function describeCampaign(c: Pick<Campaign, 'type' | 'multiplier' | 'minSpend' | 'productTag' | 'productCategory' | 'flatBonus'>, merchantName: string) {
  const peso = (n?: number) => `₱${(n ?? 0).toLocaleString('en-PH')}`;
  const x = `${c.multiplier}×`;
  if (c.type === 'BILL_MULTIPLIER') return `${x} points on bills of ${peso(c.minSpend)} or more at ${merchantName}`;
  if (c.type === 'PRODUCT_MULTIPLIER') {
    const what = c.productTag ? c.productTag.replace(/-/g, ' ') + 's' : (c.productCategory ?? 'selected items');
    return `${x} points on ${what} at ${merchantName}`;
  }
  return `+${(c.flatBonus ?? 0).toLocaleString('en-PH')} bonus points on bills of ${peso(c.minSpend)} or more at ${merchantName}`;
}

// ---- POS ----

export interface QuoteRequest {
  cartId: string;
  /** Member QR payload, member ID or mobile; omit for a non-member checkout */
  member?: string;
  /** Voucher IDs to apply; omit to auto-select the best combination */
  voucherIds?: string[];
}

export interface QuoteVoucher {
  voucherId: string;
  title: string;
  discountAmount: number;
  selected: boolean;
  /** Set when the voucher can't be used here (shown greyed out) */
  unusableReason?: string;
}

export interface QuoteCampaign {
  campaignId: string;
  name: string;
  type: CampaignType;
  mechanics: string;
  bonusPoints: number;
}

export interface Quote {
  cartId: string;
  merchantId: string;
  member: { userId: string; name: string; tier: Tier; pointsBalance: number } | null;
  lines: (CartLine & { lineTotal: number; multiplier: number; campaignId?: string })[];
  subtotal: number;
  vouchers: QuoteVoucher[];
  discount: number;
  /** Voucher value that exceeds the bill and is lost */
  forfeited: number;
  net: number;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  campaigns: QuoteCampaign[];
  warnings: string[];
}

export interface Sale {
  billId: string; // BILL-HM-20481
  merchantId: string;
  cartId?: string;
  userId: string | null;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  net: number;
  voucherIds: string[];
  basePoints: number;
  bonusPoints: number;
  campaignIds: string[];
  /** Bonus points attributed to each campaign on this bill */
  campaignPoints: Record<string, number>;
  cashier: string;
  timestamp: string;
}

export interface CheckoutResponse {
  success: true;
  sale: Sale;
  quote: Quote;
  earnTransactionId: string | null;
  newPointsBalance: number | null;
}

// ---- Merchant portal (v2) ----

export interface AnalyticsKpis {
  memberRevenue: number;
  nonMemberRevenue: number;
  memberBills: number;
  nonMemberBills: number;
  uniqueMembers: number;
  avgMemberBill: number;
  avgNonMemberBill: number;
  basePoints: number;
  bonusPoints: number;
  /** ₱ of voucher discounts given at this store (the store that burns the points funds them) */
  voucherDiscounts: number;
  voucherRedemptions: number;
}

export interface MerchantAnalytics {
  period: { from: string; to: string; days: number };
  kpis: { current: AnalyticsKpis; previous: AnalyticsKpis };
  daily: { date: string; memberRevenue: number; nonMemberRevenue: number; bills: number; basePoints: number; bonusPoints: number }[];
  campaigns: {
    campaignId: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    startDate: string;
    endDate: string;
    bills: number;
    revenue: number;
    bonusPoints: number;
    revenuePerBonusPoint: number;
    avgBillDuring: number;
    avgBillBefore: number;
  }[];
  vouchers: { rewardId: string; title: string; count: number; discount: number }[];
  topProducts: { sku: string; name: string; qty: number; revenue: number; campaignTagged: boolean }[];
  customerMix: { newMembers: number; returningMembers: number };
  /** dow 0 = Monday … 6 = Sunday; hour 0–23 (Asia/Manila) */
  heatmap: { dow: number; day: string; hour: number; bills: number }[];
}

export interface MerchantSaleRow extends Sale {
  customerName: string | null;
}
