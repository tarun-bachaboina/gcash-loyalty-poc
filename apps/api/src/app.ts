import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { API_BASE } from '@gcash/shared';
import { errorHandler } from './domain/errors';
import { adminRoutes } from './routes/admin';
import { customerRoutes } from './routes/customer';
import { merchantRoutes } from './routes/merchant';
import { posRoutes } from './routes/pos';
import { Store } from './store';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SURFACES = ['customer', 'merchant', 'admin', 'pos'] as const;

export function createApp(store = new Store()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get(`${API_BASE}/health`, (_req, res) => {
    res.json({ ok: true });
  });

  // PRD §6.2
  app.use(`${API_BASE}/customer`, customerRoutes(store));
  app.use(`${API_BASE}/merchant`, merchantRoutes(store));
  app.use(`${API_BASE}/admin`, adminRoutes(store));
  app.use(`${API_BASE}/pos`, posRoutes(store));

  // Demo helper: re-seed everything
  app.post(`${API_BASE}/dev/reset`, (_req, res) => {
    store.reset();
    res.json({ success: true, message: 'Demo data reset.' });
  });

  app.use(`${API_BASE}`, (_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } });
  });
  app.use(errorHandler);

  // Shared brand assets, served at /assets/GCash_logo.svg for every surface.
  app.use('/assets', express.static(path.join(repoRoot, 'public/assets')));

  // Built surfaces (after `npm run build`) are served from one origin.
  for (const name of SURFACES) {
    const dist = path.join(repoRoot, 'apps', name, 'dist');
    if (!fs.existsSync(dist)) continue;
    app.use(`/${name}`, express.static(dist));
    app.get(`/${name}{/*splat}`, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  return app;
}
