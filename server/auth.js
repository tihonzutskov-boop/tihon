import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const SESSION_COOKIE = 'gyde_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Render always sets a real generated SESSION_SECRET; this fallback only
// covers local dev before a .env is set up.
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

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

export const signSession = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    SESSION_SECRET,
    { expiresIn: '30d' }
  );
};

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

export const requireAuth = (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(token, SESSION_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};

// The admin role in the JWT is a snapshot from login time. Checking it alone
// would mean revoking ADMIN_EMAILS never actually takes effect for anyone
// holding an already-issued session, so this re-reads the current role from
// the database on every admin-gated request instead of trusting the token.
export const createRequireAdmin = (pool) => (req, res, next) => {
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

export const isAdminEmail = (email) => {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || '').toLowerCase());
};
