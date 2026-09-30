import { randomUUID, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const SESSION_COOKIE = 'gyde_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Sessions are signed with this, so anyone who knows it can mint a session for
// any user id — including an admin's. A fixed fallback is fine on a laptop and
// dangerous on a server deployed without the variable, because it is public in
// the source. In production a missing secret is replaced with a random one that
// nobody knows: sessions cannot be forged, at the cost of everyone being signed
// out whenever the server restarts — which is annoying enough to notice, and
// logged loudly. Refusing to start would be safer still, but would turn a
// misconfiguration into an outage.
const resolveSessionSecret = (env, warn = console.error) => {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.NODE_ENV === 'production') {
    warn('SESSION_SECRET is not set. Using a random secret for this run: sign-ins will not survive a restart. Set SESSION_SECRET in the environment.');
    return randomBytes(48).toString('hex');
  }
  return 'dev-only-insecure-secret';
};
const SESSION_SECRET = resolveSessionSecret(process.env);
export { resolveSessionSecret };

const JWT_ALGORITHM = 'HS256';

export const verifyGoogleToken = async (idToken) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    // Without an audience, google-auth-library skips the "was this token
    // issued for my app" check entirely and accepts any valid Google token.
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email_verified) {
    throw new Error('Google account email is not verified');
  }
  return payload;
};

/**
 * Which account a Google sign-in belongs to.
 *
 * Matched on Google's own account id (`sub`), which never changes and is never
 * reused, and only then on email. Email alone is not an identity: addresses are
 * released and reassigned, and whoever holds one later would otherwise inherit
 * the previous holder's account — including an admin's.
 */
export const resolveGoogleAccount = ({ byGoogleId, byEmail, sub }) => {
  if (byGoogleId) return { action: 'use', user: byGoogleId };
  if (byEmail) {
    if (byEmail.google_id && byEmail.google_id !== sub) return { action: 'reject' };
    // An account from before the Google id was recorded: link it on this sign-in.
    return { action: 'link', user: byEmail };
  }
  return { action: 'create' };
};

export const signSession = (user, sessionId) =>
  jwt.sign(
    { id: user.id, role: user.role, ...(sessionId ? { sid: sessionId } : {}) },
    SESSION_SECRET,
    { expiresIn: '30d', algorithm: JWT_ALGORITHM }
  );

export const setSessionCookie = (res, token) => {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
};

export const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE);
};

export const readSession = (req) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch {
    return null;
  }
};

// How long "this session is still valid" may be remembered before asking the
// database again. Logging out on this server clears the memory at once, so the
// delay only matters for a session revoked some other way.
const SESSION_CHECK_TTL_MS = 30_000;

export const createAuth = (pool) => {
  const verified = new Map(); // session id -> when it was last confirmed

  // Sessions are rows, not just signed tokens: a token alone stays valid until
  // it expires, so signing out would only ever delete the browser's copy. A
  // token issued before sessions were tracked has no id and is honoured until
  // it expires, which is at most 30 days.
  const isLive = async (sid, userId) => {
    const at = verified.get(sid);
    if (at && Date.now() - at < SESSION_CHECK_TTL_MS) return true;
    const result = await pool.query(
      'SELECT 1 FROM user_sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()',
      [sid, userId]
    );
    if (result.rows.length === 0) {
      verified.delete(sid);
      return false;
    }
    verified.set(sid, Date.now());
    return true;
  };

  const requireAuth = async (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const session = readSession(req);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
    try {
      if (session.sid && !(await isLive(session.sid, session.id))) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
    } catch (err) {
      console.error('Session check failed:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    req.user = session;
    next();
  };

  // The admin role in the JWT is a snapshot from login time. Checking it alone
  // would mean revoking ADMIN_EMAILS never actually takes effect for anyone
  // holding an already-issued session, so this re-reads the current role from
  // the database on every admin-gated request instead of trusting the token.
  const requireAdmin = (req, res, next) => {
    requireAuth(req, res, async () => {
      try {
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (result.rows[0]?.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }
        next();
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });
  };

  const startSession = async (client, user) => {
    const sid = randomUUID();
    await client.query(
      'INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')',
      [sid, user.id]
    );
    // Expired rows have no other reason to be cleaned up.
    await client.query('DELETE FROM user_sessions WHERE expires_at < now()');
    return signSession(user, sid);
  };

  const endSession = async (req) => {
    const session = readSession(req);
    if (!session?.sid) return;
    verified.delete(session.sid);
    await pool.query('DELETE FROM user_sessions WHERE id = $1 AND user_id = $2', [session.sid, session.id]);
  };

  return { requireAuth, requireAdmin, startSession, endSession };
};

export const isAdminEmail = (email) => {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || '').toLowerCase());
};
