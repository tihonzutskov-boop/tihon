import express from 'express';

// A fixed-window counter held in memory. That is the right size for this
// server: it runs as one instance, so there is no second copy to disagree with,
// and a restart forgetting the counts only ever errs toward letting someone in.
export const createRateLimiter = ({ windowMs, max, key = (req) => req.ip, message = 'Too many requests. Please wait a moment and try again.' }) => {
  const windows = new Map();

  // Without this every distinct caller leaves an entry behind for good.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }, Math.max(windowMs, 60_000));
  sweep.unref?.();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let w = windows.get(k);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(k, w);
    }
    w.count += 1;
    if (w.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((w.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }
    next();
  };
};

// Who a limit applies to: the signed-in person when there is one, otherwise the
// address they came from.
export const byUserOrIp = (req) => (req.user?.id != null ? `u:${req.user.id}` : `ip:${req.ip}`);

// Bodies are parsed before the route decides whether the caller is allowed to
// send one, so the limit has to be small for anyone who has not proved they
// need more. A 12MB limit on every route meant an anonymous request could make
// the server buffer and parse 12MB — several times over in heap — before being
// refused, on an instance with 512MB. Large bodies (a base64 image or clip in
// the admin screens) are only read for a signed-in admin.
export const createJsonBodyParser = ({ smallLimit, bigLimit, bigPaths, requireAdmin }) => {
  const small = express.json({ limit: smallLimit });
  const big = express.json({ limit: bigLimit });
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && bigPaths.test(req.path)) {
      return requireAdmin(req, res, (err) => (err ? next(err) : big(req, res, next)));
    }
    return small(req, res, next);
  };
};
