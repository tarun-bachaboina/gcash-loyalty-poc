import { Router } from 'express';
import type { Store } from '../store';
import { confirmRedemption, earnPoints, latestVoucher, validateVoucher } from '../domain/loyalty';
import { journalFor } from '../domain/reports';
import { merchantAnalytics, merchantSales } from '../domain/analytics';
import { createCampaign, endCampaign, merchantCampaigns, withdrawCampaign } from '../domain/campaigns';
import { merchantRewards, submitMerchantReward, withdrawReward } from '../domain/rewardRequests';

export function merchantRoutes(store: Store) {
  const r = Router();

  r.get('/list', (_req, res) => {
    res.json({ success: true, data: store.state.merchants });
  });

  r.post('/earn', (req, res) => {
    res.status(201).json(earnPoints(store, req.body ?? {}));
  });

  r.post('/burn/validate', (req, res) => {
    res.json(validateVoucher(store, req.body?.voucherCode, req.body?.merchantId));
  });

  r.post('/burn/confirm', (req, res) => {
    res.json(confirmRedemption(store, req.body ?? {}));
  });

  // Demo helper for M-4 "Paste Last Created Voucher QR"
  r.get('/vouchers/latest', (_req, res) => {
    res.json({ success: true, data: latestVoucher(store) });
  });

  r.get('/journal', (req, res) => {
    res.json({ success: true, data: journalFor(store, String(req.query.merchantId ?? '')) });
  });

  // ---- v2: merchant portal ----

  r.get('/products', (req, res) => {
    res.json({ success: true, data: store.state.products.filter((p) => p.merchantId === req.query.merchantId) });
  });

  r.get('/campaigns', (req, res) => {
    res.json({ success: true, data: merchantCampaigns(store, String(req.query.merchantId ?? '')) });
  });

  r.post('/campaigns', (req, res) => {
    res.status(201).json({ success: true, data: createCampaign(store, req.body ?? {}) });
  });

  r.post('/campaigns/:id/withdraw', (req, res) => {
    res.json({ success: true, data: withdrawCampaign(store, req.params.id) });
  });

  r.post('/campaigns/:id/end', (req, res) => {
    res.json({ success: true, data: endCampaign(store, req.params.id, 'MERCHANT') });
  });

  r.get('/rewards', (req, res) => {
    res.json({ success: true, data: merchantRewards(store, String(req.query.merchantId ?? '')) });
  });

  r.post('/rewards', (req, res) => {
    res.status(201).json({ success: true, data: submitMerchantReward(store, req.body ?? {}) });
  });

  r.post('/rewards/:id/withdraw', (req, res) => {
    res.json({ success: true, data: withdrawReward(store, req.params.id) });
  });

  r.get('/analytics', (req, res) => {
    res.json({ success: true, data: merchantAnalytics(store, String(req.query.merchantId ?? ''), req.query.days) });
  });

  r.get('/transactions', (req, res) => {
    res.json({ success: true, data: merchantSales(store, String(req.query.merchantId ?? ''), req.query.from, req.query.to) });
  });

  return r;
}
