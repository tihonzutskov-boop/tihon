import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Boots the real server.js — the wiring between the routes and the modules
// tested on their own. No database is needed: everything checked here is
// decided before a query would run, and the server keeps retrying a database it
// cannot reach in the background.
const dir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(dir, 'server.js');
const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}`;

const env = (over = {}) => ({
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-secret',
  DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/none',
  GOOGLE_CLIENT_ID: '',
  ...over,
});

let child;
beforeAll(async () => {
  child = spawn(process.execPath, [serverPath], { env: env(), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${base}/api/auth/me`); return; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  throw new Error('server did not start');
}, 30_000);
afterAll(() => { child?.kill(); });

const post = (url, body, headers = {}) => fetch(base + url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

describe('the library needs a signed-in user', () => {
  for (const url of ['/api/gyms', '/api/equipment', '/api/exercises', '/api/equipment/x/image',
                     '/api/exercises/x/image', '/api/exercises/x/tutorial-video']) {
    it(`refuses an anonymous request to ${url}`, async () => {
      expect((await fetch(base + url)).status).toBe(401);
    });
  }
});

describe('writes need a signed-in user, and the right one', () => {
  it('refuses anonymous saves', async () => {
    for (const [method, url] of [['PUT', '/api/questionnaire/me'], ['PUT', '/api/plans/me'], ['POST', '/api/exercise-logs'],
                                 ['POST', '/api/workouts'], ['POST', '/api/session-checkins']]) {
      const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(r.status, url).toBe(401);
    }
  });

  it('refuses a forged admin session', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ id: 1, role: 'admin' }, 'a-guess');
    const r = await fetch(base + '/api/coaching/clients', { headers: { Cookie: `gyde_session=${forged}` } });
    expect(r.status).toBe(401);
  });
});

describe('request size', () => {
  it('refuses an oversized body on an ordinary route before doing anything with it', async () => {
    const r = await post('/api/auth/google', { idToken: 'x'.repeat(2_000_000) });
    expect(r.status).toBe(413);
  });

  it('refuses a large body on an admin route from someone who is not signed in, without parsing it', async () => {
    const r = await post('/api/exercises', { name: 'x'.repeat(3_000_000) });
    expect(r.status).toBe(401);
  });
});

describe('sign-in is rate limited', () => {
  it('starts refusing after too many attempts from one address', async () => {
    const statuses = [];
    for (let i = 0; i < 125; i++) statuses.push((await post('/api/auth/google', { idToken: 'nope' })).status);
    expect(statuses.slice(0, 120).every(s => s !== 429)).toBe(true);
    expect(statuses.slice(120).every(s => s === 429)).toBe(true);
  }, 30_000);
});

describe('starting up', () => {
  it('still starts in production without a session secret, with a warning and an unguessable one', async () => {
    const port = PORT + 100;
    const proc = spawn(process.execPath, [serverPath], {
      env: env({ NODE_ENV: 'production', SESSION_SECRET: '', PORT: String(port) }), stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    try {
      let up = false;
      for (let i = 0; i < 60 && !up; i++) {
        try { await fetch(`http://127.0.0.1:${port}/api/auth/me`); up = true; } catch { await new Promise(r => setTimeout(r, 250)); }
      }
      expect(up).toBe(true);
      expect(stderr).toMatch(/SESSION_SECRET is not set/);
      // The old public fallback secret must not work.
      const jwt = (await import('jsonwebtoken')).default;
      const forged = jwt.sign({ id: 1, role: 'admin' }, 'dev-only-insecure-secret');
      const r = await fetch(`http://127.0.0.1:${port}/api/coaching/clients`, { headers: { Cookie: `gyde_session=${forged}` } });
      expect(r.status).toBe(401);
    } finally {
      proc.kill();
    }
  }, 30_000);
});
