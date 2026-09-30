import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import { createRateLimiter, createJsonBodyParser, byUserOrIp } from './limits.js';

let server;
const listen = (app) => new Promise((resolve) => {
  server = app.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`));
});
afterEach(() => new Promise((resolve) => (server ? server.close(() => resolve()) : resolve())));

describe('rate limiting', () => {
  it('lets calls through up to the limit and refuses the rest with a retry time', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 3 }));
    app.get('/', (req, res) => res.json({ ok: true }));
    const base = await listen(app);

    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await fetch(base)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);

    const refused = await fetch(base);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await refused.json()).error).toMatch(/too many/i);
  });

  it('starts counting again once the window has passed', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 150, max: 1 }));
    app.get('/', (req, res) => res.json({}));
    const base = await listen(app);
    expect((await fetch(base)).status).toBe(200);
    expect((await fetch(base)).status).toBe(429);
    await new Promise(r => setTimeout(r, 200));
    expect((await fetch(base)).status).toBe(200);
  });

  it('counts each caller separately', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 1, key: (req) => req.get('x-who') }));
    app.get('/', (req, res) => res.json({}));
    const base = await listen(app);
    const as = (who) => fetch(base, { headers: { 'x-who': who } }).then(r => r.status);
    expect([await as('a'), await as('b'), await as('a'), await as('b')]).toEqual([200, 200, 429, 429]);
  });

  it('keys on the signed-in user when there is one, otherwise the address', () => {
    expect(byUserOrIp({ user: { id: 7 }, ip: '1.2.3.4' })).toBe('u:7');
    expect(byUserOrIp({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });
});

describe('request body limits', () => {
  const requireAdmin = (req, res, next) => {
    if (req.get('x-admin') === 'yes') return next();
    return res.status(403).json({ error: 'Admin access required' });
  };
  const build = () => {
    const app = express();
    app.use(createJsonBodyParser({
      smallLimit: '10kb', bigLimit: '1mb', bigPaths: /^\/api\/(exercises|gyms)(\/|$)/, requireAdmin,
    }));
    app.post('/api/plans', (req, res) => res.json({ size: JSON.stringify(req.body).length }));
    app.post('/api/exercises', (req, res) => res.json({ size: JSON.stringify(req.body).length }));
    app.get('/api/exercises', (req, res) => res.json({ ok: true }));
    return app;
  };
  const post = (base, path, size, headers = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ data: 'x'.repeat(size) }),
  });

  it('gives an ordinary route only the small limit', async () => {
    const base = await listen(build());
    expect((await post(base, '/api/plans', 1_000)).status).toBe(200);
    expect((await post(base, '/api/plans', 50_000)).status).toBe(413);
  });

  it('gives an admin route the large limit, but only to an admin', async () => {
    const base = await listen(build());
    expect((await post(base, '/api/exercises', 200_000, { 'x-admin': 'yes' })).status).toBe(200);
  });

  it('refuses a large body from a non-admin without reading it', async () => {
    const base = await listen(build());
    // 403, not 413: the caller was turned away before any body was parsed.
    expect((await post(base, '/api/exercises', 200_000)).status).toBe(403);
    expect((await post(base, '/api/exercises', 50_000)).status).toBe(403);
  });

  it('still bounds an admin at the large limit', async () => {
    const base = await listen(build());
    expect((await post(base, '/api/exercises', 2_000_000, { 'x-admin': 'yes' })).status).toBe(413);
  });

  it('does not put reads behind the admin check', async () => {
    const base = await listen(build());
    expect((await fetch(base + '/api/exercises')).status).toBe(200);
  });
});
