import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { resolveSessionSecret, resolveGoogleAccount, createAuth, signSession, SESSION_COOKIE } from './auth.js';

describe('the session secret', () => {
  it('is taken from the environment', () => {
    expect(resolveSessionSecret({ SESSION_SECRET: 's3cret', NODE_ENV: 'production' })).toBe('s3cret');
  });

  it('uses a random secret in production when none is set, and says so', () => {
    const warnings = [];
    const a = resolveSessionSecret({ NODE_ENV: 'production' }, (m) => warnings.push(m));
    const b = resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: '' }, (m) => warnings.push(m));
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(a).not.toBe(b); // never the same twice, so never guessable
    expect(a).not.toMatch(/dev-only/);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/SESSION_SECRET/);
  });

  it('falls back to a development value only outside production', () => {
    expect(resolveSessionSecret({ NODE_ENV: 'development' })).toBeTruthy();
    expect(resolveSessionSecret({})).toBeTruthy();
  });
});

describe('which account a Google sign-in belongs to', () => {
  const user = (over = {}) => ({ id: 1, email: 'a@x.com', google_id: 'sub-1', ...over });

  it('uses the account with that Google id', () => {
    const u = user();
    expect(resolveGoogleAccount({ byGoogleId: u, byEmail: undefined, sub: 'sub-1' })).toEqual({ action: 'use', user: u });
  });

  it('links an older account that has no Google id yet', () => {
    const u = user({ google_id: null });
    expect(resolveGoogleAccount({ byGoogleId: undefined, byEmail: u, sub: 'sub-9' })).toEqual({ action: 'link', user: u });
  });

  it('refuses when the email belongs to an account with a different Google id', () => {
    // The address was released and someone else now holds it: they must not inherit the account.
    expect(resolveGoogleAccount({ byGoogleId: undefined, byEmail: user({ google_id: 'sub-1' }), sub: 'sub-2' }))
      .toEqual({ action: 'reject' });
  });

  it('creates an account when neither matches', () => {
    expect(resolveGoogleAccount({ byGoogleId: undefined, byEmail: undefined, sub: 'sub-3' })).toEqual({ action: 'create' });
  });

  it('prefers the Google id over the email when they point at different accounts', () => {
    const mine = user({ id: 5, google_id: 'sub-5' });
    expect(resolveGoogleAccount({ byGoogleId: mine, byEmail: user({ id: 6 }), sub: 'sub-5' }).user.id).toBe(5);
  });
});

// A stand-in database holding just the sessions table and the users' roles.
const fakePool = () => {
  const sessions = new Map();
  const roles = new Map([[1, 'user'], [2, 'admin']]);
  const calls = { sessionLookups: 0 };
  return {
    sessions, roles, calls,
    async query(sql, params) {
      if (/^\s*SELECT 1 FROM user_sessions/i.test(sql)) {
        calls.sessionLookups++;
        const s = sessions.get(params[0]);
        return { rows: s && s.userId === params[1] ? [{ '?column?': 1 }] : [] };
      }
      if (/INSERT INTO user_sessions/i.test(sql)) { sessions.set(params[0], { userId: params[1] }); return { rows: [] }; }
      if (/DELETE FROM user_sessions WHERE expires_at/i.test(sql)) return { rows: [] };
      if (/DELETE FROM user_sessions/i.test(sql)) { sessions.delete(params[0]); return { rows: [] }; }
      if (/SELECT role FROM users/i.test(sql)) return { rows: roles.has(params[0]) ? [{ role: roles.get(params[0]) }] : [] };
      throw new Error('unexpected query: ' + sql);
    },
  };
};

let server;
afterEach(() => new Promise((resolve) => (server ? server.close(() => resolve()) : resolve())));

const appWith = (auth) => {
  const app = express();
  app.use(cookieParser());
  app.get('/me', auth.requireAuth, (req, res) => res.json({ id: req.user.id }));
  app.get('/admin', auth.requireAdmin, (req, res) => res.json({ ok: true }));
  app.post('/logout', async (req, res) => { await auth.endSession(req); res.json({ ok: true }); });
  return new Promise((resolve) => { server = app.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`)); });
};
const withToken = (token) => ({ headers: { Cookie: `${SESSION_COOKIE}=${token}` } });

describe('signed sessions', () => {
  it('lets in a session that was started, and turns away a stranger', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const token = await auth.startSession(pool, { id: 1, role: 'user' });
    expect((await fetch(base + '/me', withToken(token))).status).toBe(200);
    expect((await fetch(base + '/me')).status).toBe(401);
    expect((await fetch(base + '/me', withToken('garbage'))).status).toBe(401);
  });

  it('turns away a token signed with another secret, or with no signature at all', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const forged = jwt.sign({ id: 2, role: 'admin' }, 'some-other-secret');
    const unsigned = jwt.sign({ id: 2, role: 'admin' }, '', { algorithm: 'none' });
    expect((await fetch(base + '/me', withToken(forged))).status).toBe(401);
    expect((await fetch(base + '/me', withToken(unsigned))).status).toBe(401);
  });

  it('ends a session on the server when the client signs out', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const token = await auth.startSession(pool, { id: 1, role: 'user' });
    expect((await fetch(base + '/me', withToken(token))).status).toBe(200);
    await fetch(base + '/logout', { method: 'POST', ...withToken(token) });
    // The very same token, still unexpired and correctly signed, no longer works.
    expect((await fetch(base + '/me', withToken(token))).status).toBe(401);
  });

  it('signing out on one device leaves another device signed in', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const phone = await auth.startSession(pool, { id: 1, role: 'user' });
    const laptop = await auth.startSession(pool, { id: 1, role: 'user' });
    await fetch(base + '/logout', { method: 'POST', ...withToken(phone) });
    expect((await fetch(base + '/me', withToken(phone))).status).toBe(401);
    expect((await fetch(base + '/me', withToken(laptop))).status).toBe(200);
  });

  it('turns away a session whose row has gone, however valid its signature', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const token = await auth.startSession(pool, { id: 1, role: 'user' });
    pool.sessions.clear();
    // Not asked again within the cache window, so clear it the way expiry would.
    const fresh = createAuth(pool); const base2 = await appWith(fresh);
    expect((await fetch(base2 + '/me', withToken(token))).status).toBe(401);
  });

  it('does not ask the database on every request', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const token = await auth.startSession(pool, { id: 1, role: 'user' });
    for (let i = 0; i < 5; i++) await fetch(base + '/me', withToken(token));
    expect(pool.calls.sessionLookups).toBe(1);
  });

  it('still honours a token issued before sessions were tracked', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const legacy = signSession({ id: 1, role: 'user' }); // no session id
    expect((await fetch(base + '/me', withToken(legacy))).status).toBe(200);
  });
});

describe('admin access', () => {
  it('checks the role in the database, not the one in the token', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const claimsAdmin = await auth.startSession(pool, { id: 1, role: 'admin' }); // token says admin; database says user
    expect((await fetch(base + '/admin', withToken(claimsAdmin))).status).toBe(403);
    const realAdmin = await auth.startSession(pool, { id: 2, role: 'user' });    // token says user; database says admin
    expect((await fetch(base + '/admin', withToken(realAdmin))).status).toBe(200);
  });

  it('takes admin away from a session the moment the role is revoked', async () => {
    const pool = fakePool(); const auth = createAuth(pool); const base = await appWith(auth);
    const token = await auth.startSession(pool, { id: 2, role: 'admin' });
    expect((await fetch(base + '/admin', withToken(token))).status).toBe(200);
    pool.roles.set(2, 'user');
    expect((await fetch(base + '/admin', withToken(token))).status).toBe(403);
  });
});
