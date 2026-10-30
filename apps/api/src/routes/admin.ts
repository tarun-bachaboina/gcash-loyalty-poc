import { Router } from 'express';
import type { Store } from '../store';
import { createReward, setRewardStatus } from '../domain/admin';
import { auditLedger, dashboard } from '../domain/reports';
import { adminCampaigns, decideCampaign, endCampaign } from '../domain/campaigns';
import { decideReward, withTerms } from '../domain/rewardRequests';

export function adminRoutes(store: Store) {
  const r = Router();

  r.get('/dashboard', (_req, res) => {
    res.json({ success: true, data: dashboard(store) });
  });

  r.get('/rewards', (_req, res) => {
    res.json({ success: true, data: store.state.rewards.map((r) => withTerms(store, r)) });
  });

  r.post('/rewards', (req, res) => {
    res.status(201).json({ success: true, data: createReward(store, req.body ?? {}) });
  });

  r.patch('/rewards/:rewardId', (req, res) => {
    res.json({ success: true, data: setRewardStatus(store, req.params.rewardId, req.body?.status) });
  });

  r.get('/audit', (_req, res) => {
    res.json({ success: true, data: auditLedger(store) });
  });

  // ---- v2: approvals ----

  r.get('/campaigns', (req, res) => {
    res.json({ success: true, data: adminCampaigns(store, req.query.status ? String(req.query.status) : undefined) });
  });

  r.post('/campaigns/:id/approve', (req, res) => {
    res.json({ success: true, data: decideCampaign(store, req.params.id, 'approve') });
  });

  r.post('/campaigns/:id/reject', (req, res) => {
    res.json({ success: true, data: decideCampaign(store, req.params.id, 'reject', req.body?.reason) });
  });

  r.post('/campaigns/:id/end', (req, res) => {
    res.json({ success: true, data: endCampaign(store, req.params.id, 'ADMIN') });
  });

  r.post('/rewards/:id/approve', (req, res) => {
    res.json({ success: true, data: decideReward(store, req.params.id, 'approve') });
  });

  r.post('/rewards/:id/reject', (req, res) => {
    res.json({ success: true, data: decideReward(store, req.params.id, 'reject', req.body?.reason) });
  });

  return r;
}
