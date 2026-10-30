import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  it('reports ok', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('serves the shared GCash logo', async () => {
    const res = await request(createApp()).get('/assets/gcash-logo.svg');
    expect(res.status).toBe(200);
  });
});
