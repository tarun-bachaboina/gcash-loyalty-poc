import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Store } from '../src/store';

// v2: POS checkout, campaigns, merchant rewards, promos, analytics (Reference Docs/PLAN-v2-campaigns-pos-analytics.md)

const NOW = new Date('2026-10-29T06:00:00Z'); // 14:00 Manila → "today" = 2026-10-29
let store: Store;
let api: ReturnType<typeof request>;

beforeEach(() => {
  let n = 0;
  store = new Store({ now: () => NOW, random: () => (n++ * 0.137) % 1 });
  api = request(createApp(store));
});

const carts = async (merchantId: string) => (await api.get(`/api/v1/pos/carts?merchantId=${merchantId}`)).body.data as { cartId: string; label: string; status: string; lines: unknown[] }[];
const cartId = async (merchantId: string, label: string) => (await carts(merchantId)).find((c) => c.label === label)!.cartId;
const quote = (body: object) => api.post('/api/v1/pos/quote').send(body);
const checkout = (body: object) => api.post('/api/v1/pos/checkout').send({ cashier: 'Cashier 001', ...body });
const earn = (userId: string, grossAmount: number, merchantId = 'MERCH-HM-01') => api.post('/api/v1/merchant/earn').send({ merchantId, userId, grossAmount });
const claim = async (userId: string, rewardId: string) => (await api.post('/api/v1/customer/vouchers/claim').send({ userId, rewardId })).body.voucher;

const newCampaign = (over: object = {}) => ({
  merchantId: 'MERCH-HM-01',
  name: 'Test campaign',
  type: 'BILL_MULTIPLIER',
  multiplier: 2,
  minSpend: 5000,
  startDate: '2026-10-29',
  endDate: '2026-11-30',
  terms: 'Members only. Points on the amount paid.',
  ...over,
});
async function liveCampaign(over: object = {}) {
  const c = (await api.post('/api/v1/merchant/campaigns').send(newCampaign(over))).body.data;
  await api.post(`/api/v1/admin/campaigns/${c.campaignId}/approve`);
  return c.campaignId as string;
}

describe('POS carts', () => {
  it('each store has open demo carts with priced lines', async () => {
    const list = await carts('MERCH-HM-01');
    expect(list).toHaveLength(6);
    expect(list.every((c) => c.status === 'OPEN' && c.lines.length > 0)).toBe(true);
    expect((await carts('MERCH-AYALA-FOOD')).length).toBeGreaterThan(0);
  });

  it('reset regenerates a fresh set of open carts', async () => {
    const before = await carts('MERCH-HM-01');
    await checkout({ cartId: before[1].cartId });
    await api.post('/api/v1/pos/carts/reset').send({ merchantId: 'MERCH-HM-01' });
    const after = await carts('MERCH-HM-01');
    expect(after).toHaveLength(6);
    expect(after.every((c) => c.status === 'OPEN')).toBe(true);
    expect(after.map((c) => c.cartId)).not.toEqual(before.map((c) => c.cartId));
  });
});

describe('quote engine', () => {
  it('non-member: totals only, no points or vouchers', async () => {
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Quick tee run') })).body.data;
    expect(q).toMatchObject({ member: null, subtotal: 998, discount: 0, net: 998, totalPoints: 0, vouchers: [] });
  });

  it('member: base points on the net, product campaign bonus only on matching lines', async () => {
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'GCASH-MEMBER-USR-001' })).body.data;
    // 1,999 + 1,999 + 1,799 = 5,797 → base 57; linen shirts 3,998 × 0.5 / 100 = 19.99 → 19
    expect(q).toMatchObject({ subtotal: 5797, net: 5797, basePoints: 57, bonusPoints: 19, totalPoints: 76 });
    expect(q.campaigns).toEqual([expect.objectContaining({ campaignId: 'CMP-1001', bonusPoints: 19, mechanics: '1.5× points on linen shirts at H&M' })]);
    expect(q.lines.find((l: { sku: string }) => l.sku === 'HM-JNS-SLM').multiplier).toBe(1);
  });

  it('bill-threshold campaign doubles the whole bill once the net reaches the minimum', async () => {
    const big = (await quote({ cartId: await cartId('MERCH-ADI-04', 'Samba drop'), member: 'USR-001' })).body.data;
    expect(big).toMatchObject({ net: 5800, basePoints: 58, bonusPoints: 58, totalPoints: 116 });
    const small = (await quote({ cartId: await cartId('MERCH-ADI-04', 'Socks restock'), member: 'USR-001' })).body.data;
    expect(small).toMatchObject({ net: 1300, bonusPoints: 0, campaigns: [] });
  });

  it('highest multiplier per line wins (no stacking)', async () => {
    const id = await liveCampaign(); // 2× on H&M bills ≥ ₱5,000 vs 1.5× linen
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data;
    expect(q.bonusPoints).toBe(57); // 5,797 × 1 / 100
    expect(q.campaigns.map((c: { campaignId: string }) => c.campaignId)).toEqual([id]);
  });

  it('flat bonus is added on top of the multiplier', async () => {
    await liveCampaign({ name: 'Flat 100', type: 'FLAT_BONUS', multiplier: undefined, flatBonus: 100, minSpend: 3000 });
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data;
    expect(q).toMatchObject({ basePoints: 57, bonusPoints: 119, totalPoints: 176 });
  });

  it('only vouchers usable at this store are selectable; the best one is pre-selected', async () => {
    await earn('USR-001', 100000);
    const cinema = await claim('USR-001', 'REW-CINEMA-50');
    const hm = await claim('USR-001', 'REW-HM-200');
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data;
    const byId = Object.fromEntries(q.vouchers.map((v: { voucherId: string }) => [v.voucherId, v]));
    expect(byId[hm.voucherId]).toMatchObject({ selected: true, discountAmount: 200 });
    expect(byId[cinema.voucherId]).toMatchObject({ selected: false, unusableReason: 'Only at Ayala Malls Cinema' });
    // 5,797 − 200 = 5,597 → base 55; linen net 3,998 × 5,597/5,797 = 3,860.07 × 0.5 → 19
    expect(q).toMatchObject({ discount: 200, net: 5597, basePoints: 55, bonusPoints: 19 });
  });

  it('a voucher worth more than the bill is capped, with the remainder forfeited', async () => {
    await earn('USR-001', 20000);
    await claim('USR-001', 'REW-PARK-100');
    const q = (await quote({ cartId: await cartId('MERCH-AYALA-PARK', 'Quick errand'), member: 'USR-001' })).body.data;
    expect(q).toMatchObject({ subtotal: 60, discount: 60, forfeited: 40, net: 0, totalPoints: 0 });
    expect(q.warnings[0]).toMatch(/₱40.00 of the voucher value will be forfeited/);
  });

  it('the cashier can deselect vouchers', async () => {
    await earn('USR-001', 100000);
    await claim('USR-001', 'REW-HM-200');
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Quick tee run'), member: 'USR-001', voucherIds: [] })).body.data;
    expect(q).toMatchObject({ discount: 0, net: 998 });
  });
});

describe('voucher terms: minimum order and max % of bill', () => {
  it('a voucher below its minimum order is listed but unusable', async () => {
    await earn('USR-001', 100000);
    const v = await claim('USR-001', 'REW-HM-200'); // min order ₱1,000
    expect(v).toMatchObject({ minSpend: 1000, maxBillPercent: 50 });
    const small = (await quote({ cartId: await cartId('MERCH-HM-01', 'Quick tee run'), member: 'USR-001' })).body.data; // ₱998
    expect(small.vouchers[0]).toMatchObject({ voucherId: v.voucherId, selected: false, unusableReason: 'Minimum order ₱1,000.00' });
    expect(small.discount).toBe(0);
    const big = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data;
    expect(big.vouchers[0].selected).toBe(true);
  });

  it('a voucher covers at most its % of the bill; the rest is forfeited', async () => {
    const r = (await api.post('/api/v1/merchant/rewards').send({ merchantId: 'MERCH-HM-01', title: 'H&M ₱1,000 Off', category: 'Retail', pointsRequired: 1000, discountAmount: 1000, validUntil: '2026-12-31', stockQuantity: 5, minSpend: 0, maxBillPercent: 10 })).body.data;
    expect(r).toMatchObject({ maxBillPercent: 10 });
    await api.post(`/api/v1/admin/rewards/${r.rewardId}/approve`);
    await earn('USR-001', 100000);
    await claim('USR-001', r.rewardId);
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data; // ₱5,797
    expect(q).toMatchObject({ discount: 579.7, forfeited: 420.3, net: 5217.3 });
    expect(q.warnings.join(' ')).toMatch(/covers at most 10% of the bill/);
  });

  it('rejects out-of-range terms on merchant rewards', async () => {
    const base = { merchantId: 'MERCH-HM-01', title: 'X', category: 'Retail', pointsRequired: 10, discountAmount: 10, validUntil: '2026-12-31', stockQuantity: 5 };
    expect((await api.post('/api/v1/merchant/rewards').send({ ...base, maxBillPercent: 0 })).status).toBe(400);
    expect((await api.post('/api/v1/merchant/rewards').send({ ...base, maxBillPercent: 120 })).status).toBe(400);
    expect((await api.post('/api/v1/merchant/rewards').send({ ...base, minSpend: -5 })).status).toBe(400);
  });

  it('the generated terms line describes where and how a voucher can be used', async () => {
    const rewards = (await api.get('/api/v1/customer/rewards')).body.data;
    expect(rewards.find((x: { rewardId: string }) => x.rewardId === 'REW-HM-200').termsText).toBe('Valid only at H&M · Min. order ₱1,000 · Covers up to 50% of the bill · Valid until 2026-12-31');
    expect(rewards.find((x: { rewardId: string }) => x.rewardId === 'REW-CINEMA-50').termsText).toBe('Valid only at Ayala Malls Cinema · Valid until 2026-12-31');
  });
});

describe('cart campaign hints', () => {
  it('carts show which live campaigns a member would get', async () => {
    const list = (await api.get('/api/v1/pos/carts?merchantId=MERCH-HM-01')).body.data;
    expect(list.find((c: { label: string }) => c.label === 'Linen weekend haul').eligibleCampaigns).toEqual([{ campaignId: 'CMP-1001', name: 'Linen Season' }]);
    expect(list.find((c: { label: string }) => c.label === 'Quick tee run').eligibleCampaigns).toEqual([]);
  });
});

describe('checkout', () => {
  it('records the sale, redeems vouchers and credits points automatically', async () => {
    await earn('USR-001', 20000); // 200 pts
    const v = await claim('USR-001', 'REW-HM-200'); // → 0 pts
    const id = await cartId('MERCH-HM-01', 'Linen weekend haul');
    const res = await checkout({ cartId: id, member: 'USR-001' });
    expect(res.status).toBe(201);
    expect(res.body.sale).toMatchObject({ merchantId: 'MERCH-HM-01', userId: 'USR-001', subtotal: 5797, discount: 200, net: 5597, basePoints: 55, bonusPoints: 19, voucherIds: [v.voucherId], campaignIds: ['CMP-1001'], cashier: 'Cashier 001' });
    expect(res.body.newPointsBalance).toBe(74);

    const billId = res.body.sale.billId;
    expect(store.state.vouchers.find((x) => x.voucherId === v.voucherId)).toMatchObject({ status: 'REDEEMED', redeemedMerchantId: 'MERCH-HM-01' });
    const txns = store.state.transactions.filter((t) => t.billId === billId);
    expect(txns.map((t) => t.type).sort()).toEqual(['EARN', 'REDEEM']);
    expect(txns.find((t) => t.type === 'EARN')).toMatchObject({ pointsAmount: 74, basePoints: 55, bonusPoints: 19, campaignIds: ['CMP-1001'], grossAmount: 5597 });
    expect(store.state.carts.find((c) => c.cartId === id)).toMatchObject({ status: 'PAID', billId });
    expect(store.state.campaigns.find((c) => c.campaignId === 'CMP-1001')!.bonusPointsIssued).toBe(19);
  });

  it('non-member checkout records the sale without points', async () => {
    const res = await checkout({ cartId: await cartId('MERCH-HM-01', 'Quick tee run') });
    expect(res.body).toMatchObject({ earnTransactionId: null, newPointsBalance: null, sale: { userId: null, net: 998 } });
  });

  it('refuses a cart that was already paid', async () => {
    const id = await cartId('MERCH-HM-01', 'Quick tee run');
    await checkout({ cartId: id });
    const again = await checkout({ cartId: id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CART_PAID');
  });

  it('refuses a voucher that was used between quote and checkout', async () => {
    await earn('USR-001', 20000);
    const v = await claim('USR-001', 'REW-HM-200');
    await api.post('/api/v1/merchant/burn/confirm').send({ voucherCode: v.voucherCode, merchantId: 'MERCH-HM-01' });
    const res = await checkout({ cartId: await cartId('MERCH-HM-01', 'Quick tee run'), member: 'USR-001', voucherIds: [v.voucherId] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VOUCHER_UNUSABLE');
  });

  it('caps a campaign at its bonus budget and ends it', async () => {
    const id = await liveCampaign({ budgetPoints: 30 });
    const res = await checkout({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' });
    expect(res.body.sale.bonusPoints).toBe(30);
    const c = store.state.campaigns.find((x) => x.campaignId === id)!;
    expect(c).toMatchObject({ status: 'ENDED', endedReason: 'BUDGET', bonusPointsIssued: 30 });
  });

  it('404s an unknown member', async () => {
    const res = await quote({ cartId: await cartId('MERCH-HM-01', 'Quick tee run'), member: 'USR-404' });
    expect(res.status).toBe(404);
  });
});

describe('campaign lifecycle', () => {
  it('merchant list carries per-campaign results (bills boosted, net revenue)', async () => {
    const id = await liveCampaign({ minSpend: 1000 });
    const cart = (await carts('MERCH-HM-01'))[0].cartId;
    const sale = (await checkout({ cartId: cart, member: 'USR-002' })).body.sale;
    const mine = (await api.get('/api/v1/merchant/campaigns?merchantId=MERCH-HM-01')).body.data.find((c: { campaignId: string }) => c.campaignId === id);
    expect(sale.campaignIds).toContain(id);
    expect(mine.stats).toEqual({ bills: 1, revenue: sale.net });
  });

  it('merchant submits → PENDING, visible to merchant and in the admin queue', async () => {
    const res = await api.post('/api/v1/merchant/campaigns').send(newCampaign());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'PENDING', displayStatus: 'PENDING', merchantName: 'H&M', mechanics: '2× points on bills of ₱5,000 or more at H&M' });
    const mine = (await api.get('/api/v1/merchant/campaigns?merchantId=MERCH-HM-01')).body.data;
    expect(mine.some((c: { campaignId: string }) => c.campaignId === res.body.data.campaignId)).toBe(true);
    const queue = (await api.get('/api/v1/admin/campaigns?status=PENDING')).body.data;
    expect(queue.map((c: { campaignId: string }) => c.campaignId)).toEqual(expect.arrayContaining([res.body.data.campaignId, 'CMP-1005', 'CMP-1006']));
  });

  it.each([
    [{ terms: '' }, 'terms'],
    [{ startDate: '2026-11-10', endDate: '2026-11-01' }, 'end'],
    [{ startDate: '2026-09-01', endDate: '2026-09-30' }, 'past'],
    [{ multiplier: 2.5 }, 'multiplier'],
    [{ type: 'PRODUCT_MULTIPLIER', minSpend: undefined, productTag: 'surfboard' }, 'product'],
    [{ type: 'FLAT_BONUS', multiplier: undefined, flatBonus: 0 }, 'bonus'],
  ])('rejects invalid campaign %o', async (over, word) => {
    const res = await api.post('/api/v1/merchant/campaigns').send(newCampaign(over));
    expect(res.status).toBe(400);
    expect(res.body.error.message.toLowerCase()).toContain(word);
  });

  it('pending campaigns do not affect checkout; approval makes them live', async () => {
    const c = (await api.post('/api/v1/merchant/campaigns').send(newCampaign())).body.data;
    const id = await cartId('MERCH-HM-01', 'Big spender');
    expect((await quote({ cartId: id, member: 'USR-001' })).body.data.campaigns.map((x: { campaignId: string }) => x.campaignId)).not.toContain(c.campaignId);
    const ok = await api.post(`/api/v1/admin/campaigns/${c.campaignId}/approve`);
    expect(ok.body.data).toMatchObject({ status: 'APPROVED', displayStatus: 'LIVE' });
    expect((await quote({ cartId: id, member: 'USR-001' })).body.data.campaigns.map((x: { campaignId: string }) => x.campaignId)).toContain(c.campaignId);
  });

  it('a future campaign is SCHEDULED after approval', async () => {
    const c = (await api.post('/api/v1/merchant/campaigns').send(newCampaign({ startDate: '2026-11-15' }))).body.data;
    expect((await api.post(`/api/v1/admin/campaigns/${c.campaignId}/approve`)).body.data.displayStatus).toBe('SCHEDULED');
  });

  it('reject needs a reason, which the merchant sees', async () => {
    const c = (await api.post('/api/v1/merchant/campaigns').send(newCampaign())).body.data;
    expect((await api.post(`/api/v1/admin/campaigns/${c.campaignId}/reject`).send({ reason: ' ' })).status).toBe(400);
    await api.post(`/api/v1/admin/campaigns/${c.campaignId}/reject`).send({ reason: 'Overlaps Linen Season.' });
    const mine = (await api.get('/api/v1/merchant/campaigns?merchantId=MERCH-HM-01')).body.data.find((x: { campaignId: string }) => x.campaignId === c.campaignId);
    expect(mine).toMatchObject({ status: 'REJECTED', rejectReason: 'Overlaps Linen Season.' });
  });

  it('merchant can withdraw a pending campaign but not an approved one', async () => {
    const c = (await api.post('/api/v1/merchant/campaigns').send(newCampaign())).body.data;
    expect((await api.post(`/api/v1/merchant/campaigns/${c.campaignId}/withdraw`)).body.data.status).toBe('WITHDRAWN');
    expect((await api.post('/api/v1/merchant/campaigns/CMP-1001/withdraw')).status).toBe(409);
  });

  it('merchant or admin can end a live campaign; it stops applying', async () => {
    expect((await api.post('/api/v1/merchant/campaigns/CMP-1001/end')).body.data).toMatchObject({ status: 'ENDED', endedReason: 'MERCHANT', displayStatus: 'ENDED' });
    const q = (await quote({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' })).body.data;
    expect(q.bonusPoints).toBe(0);
    expect((await api.post('/api/v1/admin/campaigns/CMP-1002/end')).body.data.endedReason).toBe('ADMIN');
  });

  it('admin can list by status', async () => {
    const rejected = (await api.get('/api/v1/admin/campaigns?status=REJECTED')).body.data;
    expect(rejected.map((c: { campaignId: string }) => c.campaignId)).toEqual(['CMP-1007']);
  });
});

describe('admin review aids', () => {
  it('estimates a pending campaign from the store’s member bills in the last 30 days', async () => {
    let now = NOW;
    const s2 = new Store({ now: () => now });
    const a2 = request(createApp(s2));
    const list = (await a2.get('/api/v1/pos/carts?merchantId=MERCH-HM-01')).body.data as { cartId: string }[];
    for (const c of list) await a2.post('/api/v1/pos/checkout').send({ cartId: c.cartId, member: 'USR-002', cashier: 'Cashier 001' });
    await a2.post('/api/v1/pos/carts/reset').send({ merchantId: 'MERCH-HM-01' });
    const fresh = (await a2.get('/api/v1/pos/carts?merchantId=MERCH-HM-01')).body.data[0].cartId;
    await a2.post('/api/v1/pos/checkout').send({ cartId: fresh, cashier: 'Cashier 001' }); // non-member: ignored
    now = new Date(NOW.getTime() + 86_400_000); // tomorrow: today's bills are now history
    const created = (await a2.post('/api/v1/merchant/campaigns').send(newCampaign({ minSpend: 1, startDate: '2026-10-30', endDate: '2026-11-28' }))).body.data;
    const pending = (await a2.get('/api/v1/admin/campaigns?status=PENDING')).body.data.find((c: { campaignId: string }) => c.campaignId === created.campaignId);
    const memberSales = s2.state.sales.filter((x) => x.userId);
    const expected = memberSales.reduce((n, x) => n + Math.floor(x.net / 100), 0); // 2× → one extra base's worth
    expect(pending.estimate).toEqual({ qualifyingBills: 6, memberBills: 6, bonusPoints30d: expected, projectedBonusPoints: expected });
    // a budget caps the projection
    const capped = (await a2.post('/api/v1/merchant/campaigns').send(newCampaign({ minSpend: 1, startDate: '2026-10-30', endDate: '2026-11-28', budgetPoints: 10 }))).body.data;
    const view = (await a2.get('/api/v1/admin/campaigns')).body.data.find((c: { campaignId: string }) => c.campaignId === capped.campaignId);
    expect(view.estimate.projectedBonusPoints).toBe(10);
  });

  it('audit rows name the campaigns that boosted an earn', async () => {
    const id = await cartId('MERCH-HM-01', 'Linen weekend haul');
    await checkout({ cartId: id, member: 'USR-002' });
    const rows = (await api.get('/api/v1/admin/audit')).body.data as { type: string; billId?: string; campaignNames: string[] }[];
    expect(rows.find((r) => r.type === 'EARN' && r.billId)!.campaignNames).toContain('Linen Season');
  });
});

describe('customer history & vouchers (v2)', () => {
  it('history names the campaigns behind bonus points; vouchers carry their terms line', async () => {
    const id = await cartId('MERCH-HM-01', 'Linen weekend haul');
    await checkout({ cartId: id, member: 'USR-002' });
    const history = (await api.get('/api/v1/customer/history?userId=USR-002')).body.data as { type: string; billId?: string; bonusPoints?: number; campaignNames?: string[] }[];
    const earn = history.find((h) => h.type === 'EARN' && h.billId)!;
    expect(earn.bonusPoints).toBeGreaterThan(0);
    expect(earn.campaignNames).toEqual(['Linen Season']);
    expect((await claim('USR-002', 'REW-HM-200')).termsText).toMatch(/^Valid only at H&M · Min. order ₱1,000/);
    const v = (await api.get('/api/v1/customer/vouchers?userId=USR-002')).body.data[0];
    expect(v.termsText).toBe('Valid only at H&M · Min. order ₱1,000 · Covers up to 50% of the bill · Valid until 2026-12-31');
  });
});

describe('customer promos', () => {
  it('shows live, then upcoming, then recently expired; never pending/rejected/withdrawn', async () => {
    const promos = (await api.get('/api/v1/customer/promos')).body.data as { campaignId: string; displayStatus: string; terms: string; mechanics: string; merchantName: string }[];
    expect(promos.map((p) => [p.campaignId, p.displayStatus])).toEqual([
      ['CMP-1001', 'LIVE'],
      ['CMP-1002', 'LIVE'],
      ['CMP-1004', 'SCHEDULED'],
      ['CMP-1003', 'ENDED'],
    ]);
    expect(promos[0]).toMatchObject({ merchantName: 'H&M', mechanics: '1.5× points on linen shirts at H&M' });
    expect(promos[0].terms.length).toBeGreaterThan(10);
  });
});

describe('merchant rewards (approval flow)', () => {
  const reward = { merchantId: 'MERCH-PENS-03', title: 'Penshoppe ₱250 Off', category: 'Retail', pointsRequired: 250, discountAmount: 250, validUntil: '2026-12-31', stockQuantity: 50 };

  it('a submitted reward stays out of the catalog until approved', async () => {
    const r = (await api.post('/api/v1/merchant/rewards').send(reward)).body.data;
    expect(r).toMatchObject({ status: 'PENDING', merchantId: 'MERCH-PENS-03', createdBy: 'MERCHANT' });
    const catalog = async () => (await api.get('/api/v1/customer/rewards')).body.data.map((x: { rewardId: string }) => x.rewardId);
    expect(await catalog()).not.toContain(r.rewardId);
    expect((await api.post(`/api/v1/admin/rewards/${r.rewardId}/approve`)).body.data.status).toBe('ACTIVE');
    expect(await catalog()).toContain(r.rewardId);
  });

  it('reject needs a reason; merchant sees it in their list', async () => {
    const r = (await api.post('/api/v1/merchant/rewards').send(reward)).body.data;
    expect((await api.post(`/api/v1/admin/rewards/${r.rewardId}/reject`).send({})).status).toBe(400);
    await api.post(`/api/v1/admin/rewards/${r.rewardId}/reject`).send({ reason: 'Stock too low.' });
    const mine = (await api.get('/api/v1/merchant/rewards?merchantId=MERCH-PENS-03')).body.data;
    expect(mine.find((x: { rewardId: string }) => x.rewardId === r.rewardId)).toMatchObject({ status: 'REJECTED', rejectReason: 'Stock too low.' });
  });

  it('a store can only offer rewards in categories it can redeem', async () => {
    const res = await api.post('/api/v1/merchant/rewards').send({ ...reward, category: 'Entertainment' });
    expect(res.status).toBe(400);
  });

  it('merchant can withdraw a pending reward', async () => {
    const r = (await api.post('/api/v1/merchant/rewards').send(reward)).body.data;
    expect((await api.post(`/api/v1/merchant/rewards/${r.rewardId}/withdraw`)).body.data.status).toBe('WITHDRAWN');
  });

  it('admin reward list includes seeded pending and rejected requests', async () => {
    const all = (await api.get('/api/v1/admin/rewards')).body.data;
    expect(all.find((r: { rewardId: string }) => r.rewardId === 'REW-MANGO-300').status).toBe('PENDING');
    expect(all.find((r: { rewardId: string }) => r.rewardId === 'REW-ADI-1000').status).toBe('REJECTED');
  });
});

describe('merchant analytics', () => {
  it('summarises revenue, points, campaigns, vouchers and products for the period', async () => {
    await earn('USR-001', 20000);
    await claim('USR-001', 'REW-HM-200');
    await checkout({ cartId: await cartId('MERCH-HM-01', 'Linen weekend haul'), member: 'USR-001' });
    await checkout({ cartId: await cartId('MERCH-HM-01', 'Quick tee run') });
    const a = (await api.get('/api/v1/merchant/analytics?merchantId=MERCH-HM-01&days=30')).body.data;
    expect(a.period).toMatchObject({ days: 30, to: '2026-10-29' });
    expect(a.kpis.current).toMatchObject({ memberRevenue: 5597, nonMemberRevenue: 998, memberBills: 1, nonMemberBills: 1, uniqueMembers: 1, basePoints: 55, bonusPoints: 19, voucherDiscounts: 200, voucherRedemptions: 1 });
    expect(a.daily).toHaveLength(30);
    expect(a.daily.at(-1)).toMatchObject({ date: '2026-10-29', memberRevenue: 5597, nonMemberRevenue: 998 });
    expect(a.campaigns.find((c: { campaignId: string }) => c.campaignId === 'CMP-1001')).toMatchObject({ bills: 1, revenue: 5597, bonusPoints: 19 });
    expect(a.vouchers[0]).toMatchObject({ title: 'H&M ₱200 Off Voucher', count: 1, discount: 200 });
    expect(a.topProducts[0]).toMatchObject({ sku: expect.stringMatching(/^HM-LIN-/), campaignTagged: true });
    expect(a.heatmap.length).toBeGreaterThan(0);
  });
});

describe('generated history', () => {
  it('creates ~60 days of sales per store, deterministically, with consistent balances', () => {
    const a = new Store({ now: () => NOW, history: true });
    const b = new Store({ now: () => NOW, history: true });
    expect(a.state.sales.length).toBeGreaterThan(500);
    expect(JSON.stringify(a.state.sales)).toBe(JSON.stringify(b.state.sales));
    const merchants = new Set(a.state.sales.map((s) => s.merchantId));
    expect(merchants.size).toBe(9);
    expect(a.state.sales.every((s) => s.timestamp < NOW.toISOString())).toBe(true);
    for (const u of a.state.users) {
      const sum = a.state.transactions.filter((t) => t.userId === u.userId).reduce((n, t) => n + t.pointsAmount, 0);
      expect(sum).toBe(u.pointsBalance);
    }
    // Juan and Maria are left untouched for predictable demos
    expect(a.state.users.find((u) => u.userId === 'USR-001')!.pointsBalance).toBe(0);
    expect(a.state.users.find((u) => u.userId === 'USR-002')!.pointsBalance).toBe(150);
    // Campaign bonuses appear in history during the campaigns' windows
    expect(a.state.sales.some((s) => s.campaignIds.includes('CMP-1003'))).toBe(true);
  });
});
