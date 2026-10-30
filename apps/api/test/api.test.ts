import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Store } from '../src/store';

const NOW = new Date('2026-10-29T06:00:00Z'); // 14:00 Manila
let store: Store;
let api: ReturnType<typeof request>;

beforeEach(() => {
  let n = 0;
  // Deterministic "random" so voucher ids are predictable but unique
  store = new Store({ now: () => NOW, random: () => ((n++ * 0.137) % 1) });
  api = request(createApp(store));
});

const earn = (userId: string, grossAmount: number, merchantId = 'MERCH-HM-01') =>
  api.post('/api/v1/merchant/earn').send({ merchantId, userId, grossAmount });

describe('customer', () => {
  it('returns the seeded profile', async () => {
    const res = await api.get('/api/v1/customer/profile?userId=USR-002');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: 'USR-002', name: 'Maria Santos', pointsBalance: 150, tier: 'Member' });
  });

  it('404s an unknown user', async () => {
    const res = await api.get('/api/v1/customer/profile?userId=USR-999');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'USER_NOT_FOUND' } });
  });

  it('logs in an existing mobile number and creates a new one', async () => {
    const juan = await api.post('/api/v1/customer/login').send({ mobileNumber: '09171112222' });
    expect(juan.body.data.userId).toBe('USR-001');

    const fresh = await api.post('/api/v1/customer/login').send({ mobileNumber: '09998887777' });
    expect(fresh.status).toBe(201);
    expect(fresh.body.data).toMatchObject({ userId: 'USR-003', name: 'GCash User ••7777', pointsBalance: 0, tier: 'Member' });
  });

  it('rejects a malformed mobile number', async () => {
    const res = await api.post('/api/v1/customer/login').send({ mobileNumber: '0817111222' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MOBILE');
  });

  it('exposes the fixed programme values the customer app displays', async () => {
    const res = await api.get('/api/v1/customer/program');
    expect(res.body.data).toEqual({ mallName: 'Ayala Mall Manila Bay', baseSpendRatio: 100, pointMonetaryValue: 1 });
  });

  it('lists active catalog rewards, each bound to a store except the mall-wide gift voucher', async () => {
    const res = await api.get('/api/v1/customer/rewards');
    const byId = Object.fromEntries(res.body.data.map((r: { rewardId: string; merchantId?: string }) => [r.rewardId, r.merchantId ?? null]));
    expect(byId).toEqual({
      'REW-CINEMA-50': 'MERCH-AYALA-CINEMA',
      'REW-PARK-100': 'MERCH-AYALA-PARK',
      'REW-FOOD-30': 'MERCH-AYALA-FOOD',
      'REW-HM-200': 'MERCH-HM-01',
      'REW-MANGO-150': 'MERCH-MANGO-02',
      'REW-ADI-300': 'MERCH-ADI-04',
      'REW-SAMS-500': 'MERCH-SAMS-05',
      'REW-MALL-100': null,
      'REW-CINEMA-250': 'MERCH-AYALA-CINEMA',
      'REW-PARK-60': 'MERCH-AYALA-PARK',
      'REW-FOOD-100': 'MERCH-AYALA-FOOD',
      'REW-PENS-100': 'MERCH-PENS-03',
      'REW-TOYS-250': 'MERCH-TOYS-06',
      'REW-CINEMA-120': 'MERCH-AYALA-CINEMA',
    });
  });

  it('refuses a claim without enough points', async () => {
    const res = await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_POINTS');
  });

  it('claims a voucher: deducts points, decrements stock, logs CLAIM', async () => {
    await earn('USR-001', 5000);
    const stockBefore = store.state.rewards.find((r) => r.rewardId === 'REW-CINEMA-50')!.stockQuantity;

    const res = await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.newPointsBalance).toBe(0);
    expect(res.body.voucher).toMatchObject({ rewardId: 'REW-CINEMA-50', userId: 'USR-001', status: 'ACTIVE', discountAmount: 50, redeemedAt: null, merchantId: 'MERCH-AYALA-CINEMA' });
    expect(res.body.voucher.voucherId).toMatch(/^VOUCH-CINEMA-\d{4}$/);
    expect(res.body.voucher.voucherCode).toBe(`GCASH-VOUCHER-${res.body.voucher.voucherId}`);
    expect(store.state.rewards.find((r) => r.rewardId === 'REW-CINEMA-50')!.stockQuantity).toBe(stockBefore - 1);

    const claim = store.state.transactions.at(-1)!;
    expect(claim).toMatchObject({ type: 'CLAIM', userId: 'USR-001', pointsAmount: -50, voucherId: res.body.voucher.voucherId });
    expect(claim.transactionId).toMatch(/^TXN-CLAIM-\d+$/);
  });

  it('lists the user vouchers and marks past-date ones EXPIRED', async () => {
    await earn('USR-001', 10000);
    await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });
    await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-FOOD-30' });
    store.state.vouchers[1].validUntil = '2026-10-01';

    const res = await api.get('/api/v1/customer/vouchers?userId=USR-001');
    expect(res.body.data.map((v: { status: string }) => v.status).sort()).toEqual(['ACTIVE', 'EXPIRED']);
  });

  it('returns history newest first with descriptions', async () => {
    await earn('USR-001', 5000);
    const { body } = await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });
    await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: body.voucher.voucherCode, merchantId: 'MERCH-AYALA-CINEMA' });

    const res = await api.get('/api/v1/customer/history?userId=USR-001');
    expect(res.body.data.map((t: { type: string }) => t.type)).toEqual(['REDEEM', 'CLAIM', 'EARN']);
    expect(res.body.data[2]).toMatchObject({ merchantName: 'H&M', description: 'Earned at H&M', pointsAmount: 50, grossAmount: 5000 });
    expect(res.body.data[1].description).toBe('Redeemed Ayala Cinema ₱50 Off Ticket');
    expect(res.body.data[0].description).toBe('Used Ayala Cinema ₱50 Off Ticket at Ayala Malls Cinema');
  });
});

describe('merchant earn', () => {
  it('lists the 8 PRD merchants plus the Food Court', async () => {
    const res = await api.get('/api/v1/merchant/list');
    expect(res.body.data).toHaveLength(9);
    expect(res.body.data.at(-1)).toMatchObject({ merchantId: 'MERCH-AYALA-FOOD', name: 'Ayala Malls Food Court', category: 'Food & Dining' });
  });

  it('awards floor(gross / 100) points and returns the PRD shape', async () => {
    const res = await earn('GCASH-MEMBER-USR-001', 2550);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, pointsAwarded: 25, updatedCustomerBalance: 25, customerName: 'Juan Dela Cruz' });
    expect(res.body.transactionId).toMatch(/^TXN-EARN-\d+$/);
  });

  it('accepts a mobile number or human-readable member id', async () => {
    expect((await earn('09183334444', 1000)).body.updatedCustomerBalance).toBe(160);
    expect((await earn('USR-002-09183334444', 1000)).body.updatedCustomerBalance).toBe(170);
  });

  it('rejects spends that earn 0 points', async () => {
    const res = await earn('USR-001', 99);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BELOW_MINIMUM_SPEND');
  });

  it('rejects non-positive and non-numeric amounts', async () => {
    expect((await earn('USR-001', -5)).status).toBe(400);
    expect((await earn('USR-001', 'abc' as unknown as number)).status).toBe(400);
  });

  it('404s unknown merchants and members', async () => {
    expect((await earn('USR-001', 500, 'MERCH-NOPE')).body.error.code).toBe('MERCHANT_NOT_FOUND');
    expect((await earn('GCASH-MEMBER-USR-404', 500)).body.error.code).toBe('USER_NOT_FOUND');
  });

  it('promotes to VIP at 1,000 lifetime points', async () => {
    await earn('USR-001', 100000);
    const res = await api.get('/api/v1/customer/profile?userId=USR-001');
    expect(res.body.data).toMatchObject({ tier: 'VIP', lifetimePoints: 1000 });
  });
});

describe('merchant burn', () => {
  async function claimCinema() {
    await earn('USR-001', 5000);
    const res = await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });
    return res.body.voucher as { voucherId: string; voucherCode: string };
  }

  it('validates an active voucher by full code or bare serial', async () => {
    const v = await claimCinema();
    for (const code of [v.voucherCode, v.voucherId, ` ${v.voucherId.toLowerCase()} `]) {
      const res = await api.post('/api/v1/merchant/burn/validate').send({ voucherCode: code });
      expect(res.body).toMatchObject({ success: true, status: 'ACTIVE', customerName: 'Juan Dela Cruz' });
      expect(res.body.voucher.voucherId).toBe(v.voucherId);
    }
  });

  it('confirms once, then reports REDEEMED with time and store', async () => {
    const v = await claimCinema();
    const ok = await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: v.voucherCode, merchantId: 'MERCH-AYALA-CINEMA' });
    expect(ok.body).toMatchObject({ success: true, message: 'Voucher successfully redeemed.' });

    const again = await api.post('/api/v1/merchant/burn/validate').send({ voucherCode: v.voucherCode });
    expect(again.body).toMatchObject({ status: 'REDEEMED', redeemedMerchantName: 'Ayala Malls Cinema' });
    expect(again.body.voucher.redeemedAt).toBe(NOW.toISOString());

    const twice = await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: v.voucherCode, merchantId: 'MERCH-AYALA-CINEMA' });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('ALREADY_REDEEMED');
  });

  it('reports unknown and expired codes as INVALID', async () => {
    const unknown = await api.post('/api/v1/merchant/burn/validate').send({ voucherCode: 'VOUCH-CINEMA-0000' });
    expect(unknown.body).toMatchObject({ status: 'INVALID', reason: 'NOT_FOUND' });

    const v = await claimCinema();
    store.state.vouchers[0].validUntil = '2026-10-28';
    const expired = await api.post('/api/v1/merchant/burn/validate').send({ voucherCode: v.voucherId });
    expect(expired.body).toMatchObject({ status: 'INVALID', reason: 'EXPIRED' });
    const confirm = await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: v.voucherId, merchantId: 'MERCH-AYALA-CINEMA' });
    expect(confirm.body.error.code).toBe('VOUCHER_EXPIRED');
  });

  it('returns the latest created voucher for the demo paste button', async () => {
    const v = await claimCinema();
    const res = await api.get('/api/v1/merchant/vouchers/latest');
    expect(res.body.data.voucherCode).toBe(v.voucherCode);
  });

  it("builds today's journal with totals", async () => {
    const v = await claimCinema();
    await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: v.voucherCode, merchantId: 'MERCH-AYALA-CINEMA' });

    const hm = await api.get('/api/v1/merchant/journal?merchantId=MERCH-HM-01');
    expect(hm.body.data.date).toBe('2026-10-29');
    // Maria's seeded H&M earn is from a previous day, so only today's earn appears
    expect(hm.body.data.totals).toEqual({ earnCount: 1, pointsIssued: 50, redeemCount: 0, discountValue: 0 });

    const cinema = await api.get('/api/v1/merchant/journal?merchantId=MERCH-AYALA-CINEMA');
    expect(cinema.body.data.entries[0]).toMatchObject({ type: 'REDEEM', customerName: 'Juan Dela Cruz', discountApplied: 50, status: 'Completed' });
    expect(cinema.body.data.totals).toEqual({ earnCount: 0, pointsIssued: 0, redeemCount: 1, discountValue: 50 });
  });
});

describe('admin', () => {
  it('aggregates the points economy', async () => {
    await earn('USR-001', 5000);
    await api.post('/api/v1/customer/vouchers/claim').send({ userId: 'USR-001', rewardId: 'REW-CINEMA-50' });

    const res = await api.get('/api/v1/admin/dashboard');
    expect(res.body.data).toMatchObject({
      totalPointsIssued: 200,
      totalPointsRedeemed: 50,
      activeVouchers: { count: 1, value: 50 },
      activeMerchantCount: 9,
    });
    const hm = res.body.data.merchants.find((m: { merchantId: string }) => m.merchantId === 'MERCH-HM-01');
    expect(hm).toMatchObject({ totalSales: 20000, pointsIssued: 200, vouchersRedeemed: 0, active: true, bills: 2, liveCampaigns: 1 });
    expect(res.body.data).toMatchObject({
      program: { spendPerPoint: 100, pointValue: 1 },
      campaigns: { live: 2, scheduled: 1 },
      pendingApprovals: { campaigns: 2, rewards: 1 },
      voucherDiscountsFunded: 0,
    });
  });

  it('the A-2 rules endpoints are retired: earning always uses ₱100 = 1 pt', async () => {
    expect((await api.get('/api/v1/admin/rules')).status).toBe(404);
    expect((await api.put('/api/v1/admin/rules').send({ baseSpendRatio: 50 })).status).toBe(404);
    expect((await earn('USR-001', 1000)).body.pointsAwarded).toBe(10);
  });

  it('publishes a common reward (any retail store) to the catalog and can pause it', async () => {
    const created = await api.post('/api/v1/admin/rewards').send({
      title: 'Ayala Malls ₱250 Retail Gift Voucher',
      category: 'Retail',
      pointsRequired: 250,
      discountAmount: 250,
      validUntil: '2026-12-31',
      stockQuantity: 50,
      minSpend: 1000,
      maxBillPercent: 40,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.rewardId;
    expect(created.body.data).toMatchObject({ status: 'ACTIVE', createdBy: 'ADMIN', minSpend: 1000, maxBillPercent: 40, termsText: 'Valid at any retail store · Min. order ₱1,000 · Covers up to 40% of the bill · Valid until 2026-12-31' });
    expect(created.body.data.merchantId).toBeUndefined();

    let catalog = await api.get('/api/v1/customer/rewards');
    expect(catalog.body.data.some((r: { rewardId: string }) => r.rewardId === id)).toBe(true);

    await api.patch(`/api/v1/admin/rewards/${id}`).send({ status: 'PAUSED' });
    catalog = await api.get('/api/v1/customer/rewards');
    expect(catalog.body.data.some((r: { rewardId: string }) => r.rewardId === id)).toBe(false);
  });

  it('validates new rewards', async () => {
    const res = await api.post('/api/v1/admin/rewards').send({ title: '', category: 'Spa', pointsRequired: 0 });
    expect(res.status).toBe(400);
  });

  it('returns the full audit ledger newest first', async () => {
    await earn('USR-001', 5000);
    const res = await api.get('/api/v1/admin/audit');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ type: 'EARN', customerName: 'Juan Dela Cruz', merchantName: 'H&M' });
  });
});

describe('store-bound redemption', () => {
  async function claim(userId: string, rewardId: string, gross = 100000) {
    await earn(userId, gross);
    const res = await api.post('/api/v1/customer/vouchers/claim').send({ userId, rewardId });
    return res.body.voucher as { voucherId: string; voucherCode: string; merchantId?: string };
  }
  const validateAt = (voucherCode: string, merchantId?: string) => api.post('/api/v1/merchant/burn/validate').send({ voucherCode, merchantId });
  const confirmAt = (voucherCode: string, merchantId: string) => api.post('/api/v1/merchant/burn/confirm').send({ voucherCode, merchantId });

  it('a cinema voucher is refused at another store, with the store it belongs to', async () => {
    const v = await claim('USR-001', 'REW-CINEMA-50');
    const res = await validateAt(v.voucherCode, 'MERCH-HM-01');
    expect(res.body).toMatchObject({ success: true, status: 'INVALID', reason: 'WRONG_STORE', validAtMerchantName: 'Ayala Malls Cinema', customerName: 'Juan Dela Cruz' });

    const confirm = await confirmAt(v.voucherCode, 'MERCH-HM-01');
    expect(confirm.status).toBe(409);
    expect(confirm.body.error).toMatchObject({ code: 'WRONG_STORE', message: 'This voucher can only be redeemed at Ayala Malls Cinema.' });
    expect(store.state.vouchers[0].status).toBe('ACTIVE');
  });

  it('the same voucher validates and redeems at its own store', async () => {
    const v = await claim('USR-001', 'REW-CINEMA-50');
    expect((await validateAt(v.voucherCode, 'MERCH-AYALA-CINEMA')).body.status).toBe('ACTIVE');
    expect((await confirmAt(v.voucherCode, 'MERCH-AYALA-CINEMA')).body.success).toBe(true);
  });

  it('validation without a merchantId still reports the voucher status (PRD request shape)', async () => {
    const v = await claim('USR-001', 'REW-MANGO-150');
    expect((await validateAt(v.voucherCode)).body.status).toBe('ACTIVE');
  });

  it('store rewards are bound to their store (Mango only at Mango, Food Court token only at the Food Court)', async () => {
    const mango = await claim('USR-002', 'REW-MANGO-150');
    expect(mango.merchantId).toBe('MERCH-MANGO-02');
    expect((await confirmAt(mango.voucherCode, 'MERCH-PENS-03')).body.error.code).toBe('WRONG_STORE');
    expect((await confirmAt(mango.voucherCode, 'MERCH-MANGO-02')).body.success).toBe(true);

    const food = await claim('USR-002', 'REW-FOOD-30');
    expect((await validateAt(food.voucherCode, 'MERCH-AYALA-CINEMA')).body.reason).toBe('WRONG_STORE');
    expect((await confirmAt(food.voucherCode, 'MERCH-AYALA-FOOD')).body.success).toBe(true);
  });

  it('the common retail gift voucher is accepted at any retail store', async () => {
    const a = await claim('USR-001', 'REW-MALL-100');
    expect(a.merchantId).toBeUndefined();
    expect((await validateAt(a.voucherCode, 'MERCH-SAMS-05')).body.status).toBe('ACTIVE');
    expect((await confirmAt(a.voucherCode, 'MERCH-SAMS-05')).body.success).toBe(true);
    const b = await claim('USR-001', 'REW-MALL-100');
    expect((await confirmAt(b.voucherCode, 'MERCH-TOYS-06')).body.success).toBe(true);
  });

  it('…but not at the cinema, parking or food court', async () => {
    const v = await claim('USR-001', 'REW-MALL-100');
    const res = await validateAt(v.voucherCode, 'MERCH-AYALA-FOOD');
    expect(res.body).toMatchObject({ status: 'INVALID', reason: 'WRONG_STORE', validAtMerchantName: 'any retail store (H&M, Mango, Penshoppe, Adidas, Samsung, Toys "R" Us)' });
    for (const m of ['MERCH-AYALA-CINEMA', 'MERCH-AYALA-PARK', 'MERCH-AYALA-FOOD']) {
      const c = await confirmAt(v.voucherCode, m);
      expect(c.body.error).toMatchObject({ code: 'WRONG_STORE', message: 'This voucher can only be redeemed at any retail store (H&M, Mango, Penshoppe, Adidas, Samsung, Toys "R" Us).' });
    }
  });

  it('a used or expired voucher reports that before the store check', async () => {
    const v = await claim('USR-001', 'REW-CINEMA-50');
    await confirmAt(v.voucherCode, 'MERCH-AYALA-CINEMA');
    expect((await validateAt(v.voucherCode, 'MERCH-HM-01')).body.status).toBe('REDEEMED');
  });

  it('a store reward (merchant-submitted, approved) is bound to that store; a common reward works at any retail store', async () => {
    const base = { category: 'Retail', pointsRequired: 120, discountAmount: 120, validUntil: '2026-12-31', stockQuantity: 10 };
    const submitted = await api.post('/api/v1/merchant/rewards').send({ ...base, title: 'Penshoppe ₱120 Off', merchantId: 'MERCH-PENS-03' });
    const bound = await api.post(`/api/v1/admin/rewards/${submitted.body.data.rewardId}/approve`);
    expect(bound.body.data.merchantId).toBe('MERCH-PENS-03');
    const anywhere = await api.post('/api/v1/admin/rewards').send({ ...base, title: 'Mall ₱120 Gift' });
    expect(anywhere.body.data.merchantId).toBeUndefined();

    const v = await claim('USR-001', bound.body.data.rewardId);
    expect((await confirmAt(v.voucherCode, 'MERCH-HM-01')).body.error.code).toBe('WRONG_STORE');
    const w = await claim('USR-001', anywhere.body.data.rewardId);
    expect((await confirmAt(w.voucherCode, 'MERCH-AYALA-CINEMA')).body.error.code).toBe('WRONG_STORE');
    expect((await confirmAt(w.voucherCode, 'MERCH-ADI-04')).body.success).toBe(true);
  });
});

describe('reward category decides where it can be redeemed', () => {
  const base = { pointsRequired: 80, discountAmount: 80, validUntil: '2026-12-31', stockQuantity: 10 };
  const submit = (body: Record<string, unknown>) => api.post('/api/v1/merchant/rewards').send({ ...base, title: 'Test reward', ...body });

  it.each([
    ['Entertainment', 'MERCH-AYALA-CINEMA'],
    ['Parking', 'MERCH-AYALA-PARK'],
    ['Food & Dining', 'MERCH-AYALA-FOOD'],
    ['Retail', 'MERCH-TOYS-06'],
  ])('a %s reward from %s is accepted', async (category, merchantId) => {
    expect((await submit({ category, merchantId })).status).toBe(201);
  });

  it.each([
    ['Entertainment', 'MERCH-HM-01'],
    ['Parking', 'MERCH-MANGO-02'],
    ['Food & Dining', 'MERCH-SAMS-05'],
    ['Retail', 'MERCH-AYALA-CINEMA'],
  ])('a %s reward from %s (a different kind of store) is refused', async (category, merchantId) => {
    const res = await submit({ category, merchantId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REWARD');
  });

  it('the mall creates common Retail rewards only: no store-bound or non-retail rewards', async () => {
    const create = (body: Record<string, unknown>) => api.post('/api/v1/admin/rewards').send({ ...base, title: 'Test reward', ...body });
    expect((await create({ category: 'Retail' })).status).toBe(201);
    const bound = await create({ category: 'Retail', merchantId: 'MERCH-HM-01' });
    expect(bound.status).toBe(400);
    expect(bound.body.error.message).toMatch(/created by the store/);
    const cinema = await create({ category: 'Entertainment' });
    expect(cinema.status).toBe(400);
    expect(cinema.body.error.message).toBe('Common rewards are Retail rewards, redeemable at any retail store.');
  });
});

describe('seed upgrade on start', () => {
  it('adds new seed stores and rewards to an older data file without touching existing data', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcash-db-'));
    const file = path.join(dir, 'db.json');
    const old = new Store({ now: () => NOW }).state;
    // Shape of a data file written before the Food Court and retail rewards existed
    old.merchants = old.merchants.filter((m) => m.merchantId !== 'MERCH-AYALA-FOOD');
    old.rewards = old.rewards.filter((r) => ['REW-CINEMA-50', 'REW-PARK-100', 'REW-FOOD-30'].includes(r.rewardId));
    delete old.rewards.find((r) => r.rewardId === 'REW-FOOD-30')!.merchantId;
    old.rewards[0].stockQuantity = 7; // an admin edit that must survive
    old.users[0].pointsBalance = 999;
    fs.writeFileSync(file, JSON.stringify(old));

    const upgraded = new Store({ persistPath: file, now: () => NOW }).state;
    expect(upgraded.merchants.map((m) => m.merchantId)).toContain('MERCH-AYALA-FOOD');
    expect(upgraded.rewards).toHaveLength(new Store().state.rewards.length);
    expect(upgraded.rewards.find((r) => r.rewardId === 'REW-FOOD-30')!.merchantId).toBe('MERCH-AYALA-FOOD');
    expect(upgraded.rewards.find((r) => r.rewardId === 'REW-CINEMA-50')!.stockQuantity).toBe(7);
    expect(upgraded.users[0].pointsBalance).toBe(999);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).merchants).toHaveLength(9);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('dev', () => {
  it('reset re-seeds the store', async () => {
    await earn('USR-001', 5000);
    await api.post('/api/v1/dev/reset');
    expect((await api.get('/api/v1/customer/profile?userId=USR-001')).body.data.pointsBalance).toBe(0);
  });
});
