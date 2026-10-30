import { Router } from 'express';
import type { Store } from '../store';
import { cartsFor, checkoutCart, quoteCart, resetCarts } from '../domain/checkout';

/** v2 POS (cashier terminal): demo carts, quote, checkout. */
export function posRoutes(store: Store) {
  const r = Router();

  r.get('/carts', (req, res) => {
    res.json({ success: true, data: cartsFor(store, String(req.query.merchantId ?? '')) });
  });

  r.post('/carts/reset', (req, res) => {
    res.json({ success: true, data: resetCarts(store, String(req.body?.merchantId ?? '')) });
  });

  r.post('/quote', (req, res) => {
    res.json({ success: true, data: quoteCart(store, req.body ?? {}) });
  });

  r.post('/checkout', (req, res) => {
    res.status(201).json(checkoutCart(store, req.body ?? {}));
  });

  return r;
}
