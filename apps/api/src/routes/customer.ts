import { MALL, PROGRAM } from '@gcash/shared';
import { Router } from 'express';
import type { Store } from '../store';
import { claimVoucher, findUser, loginByMobile, vouchersFor } from '../domain/loyalty';
import { historyFor } from '../domain/reports';
import { customerPromos } from '../domain/campaigns';
import { withTerms } from '../domain/rewardRequests';

export function customerRoutes(store: Store) {
  const r = Router();

  // C-1 mock login: existing number logs in, new number creates a member
  r.post('/login', (req, res) => {
    const { user, created } = loginByMobile(store, req.body?.mobileNumber);
    res.status(created ? 201 : 200).json({ success: true, data: user });
  });

  r.get('/profile', (req, res) => {
    res.json({ success: true, data: findUser(store, String(req.query.userId ?? '')) });
  });

  // Read-only program values for C-2 ("1 Point = ₱1.00 Value at …"); POC helper
  r.get('/program', (_req, res) => {
    res.json({ success: true, data: { mallName: MALL.name, baseSpendRatio: PROGRAM.spendPerPoint, pointMonetaryValue: PROGRAM.pointValue } });
  });

  r.get('/rewards', (_req, res) => {
    res.json({ success: true, data: store.state.rewards.filter((x) => x.status === 'ACTIVE').map((x) => withTerms(store, x)) });
  });

  r.post('/vouchers/claim', (req, res) => {
    res.status(201).json(claimVoucher(store, req.body ?? {}));
  });

  r.get('/vouchers', (req, res) => {
    res.json({ success: true, data: vouchersFor(store, String(req.query.userId ?? '')) });
  });

  r.get('/history', (req, res) => {
    res.json({ success: true, data: historyFor(store, String(req.query.userId ?? '')) });
  });

  // v2: "Promos" = live, upcoming and recently ended merchant campaigns
  r.get('/promos', (_req, res) => {
    res.json({ success: true, data: customerPromos(store) });
  });

  return r;
}
