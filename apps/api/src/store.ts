import fs from 'node:fs';
import path from 'node:path';
import { PROGRAM } from '@gcash/shared';
import { generateHistory } from './history';
import { buildSeed, makeCarts, type DbState } from './seed';

export interface StoreOptions {
  /** JSON snapshot file; omit for a purely in-memory store (tests). */
  persistPath?: string;
  now?: () => Date;
  random?: () => number;
  /** Generate ~60 days of synthetic sales for analytics (on by default in the server, off in tests). */
  history?: boolean;
}

/**
 * Bring an older snapshot up to the current seed without touching existing data: add seed merchants and
 * rewards that are missing (by id) and give seed rewards their store binding if they were saved without one.
 */
function upgradeFromSeed(state: DbState, now: Date): DbState {
  const seed = buildSeed(now);
  // v2 collections that older snapshots don't have
  state.products ??= seed.products;
  state.campaigns ??= seed.campaigns;
  state.sales ??= [];
  state.carts ??= [];
  // v2 retired the A-2 rules: earning always uses the programme constants
  delete (state as DbState & { rules?: unknown }).rules;
  for (const m of state.merchants) m.earnRatePerPoint = PROGRAM.spendPerPoint;
  state.seq = { ...seed.seq, ...state.seq };
  state.seq.cart = Math.max(state.seq.cart, seed.seq.cart);
  for (const p of seed.products) if (!state.products.some((x) => x.sku === p.sku)) state.products.push(p);
  for (const c of seed.campaigns) if (!state.campaigns.some((x) => x.campaignId === c.campaignId)) state.campaigns.push(c);
  for (const m of seed.merchants) if (!state.merchants.some((x) => x.merchantId === m.merchantId)) state.merchants.push(m);
  for (const r of seed.rewards) {
    const existing = state.rewards.find((x) => x.rewardId === r.rewardId);
    if (!existing) state.rewards.push(r);
    else {
      if (r.merchantId && !existing.merchantId) existing.merchantId = r.merchantId;
      if (r.minSpend !== undefined && existing.minSpend === undefined) existing.minSpend = r.minSpend;
      if (r.maxBillPercent !== undefined && existing.maxBillPercent === undefined) existing.maxBillPercent = r.maxBillPercent;
    }
  }
  for (const r of state.rewards) r.createdBy ??= r.merchantId ? 'MERCHANT' : 'ADMIN';
  for (const m of state.merchants) {
    if (!state.carts.some((c) => c.merchantId === m.merchantId && c.status === 'OPEN')) state.carts.push(...makeCarts(state, m.merchantId, now.toISOString()));
  }
  return state;
}

/** In-memory state with an optional JSON snapshot so demos survive restarts. */
export class Store {
  state: DbState;
  readonly now: () => Date;
  readonly random: () => number;
  private readonly persistPath?: string;
  private readonly history: boolean;

  constructor({ persistPath, now = () => new Date(), random = Math.random, history = false }: StoreOptions = {}) {
    this.persistPath = persistPath;
    this.now = now;
    this.random = random;
    this.history = history;
    const loaded = this.load();
    this.state = loaded ? upgradeFromSeed(loaded, this.now()) : buildSeed(this.now());
    if (this.history && this.state.sales.length === 0) generateHistory(this);
    if (loaded || this.history) this.save();
  }

  nowIso() {
    return this.now().toISOString();
  }

  save() {
    if (!this.persistPath) return;
    fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
    const tmp = `${this.persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state)); // compact: the generated history makes this file large
    fs.renameSync(tmp, this.persistPath);
  }

  reset() {
    this.state = buildSeed(this.now());
    if (this.history) generateHistory(this);
    this.save();
  }

  private load(): DbState | null {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.persistPath, 'utf8')) as DbState;
    } catch {
      console.warn(`Ignoring unreadable store snapshot at ${this.persistPath}; re-seeding.`);
      return null;
    }
  }
}
