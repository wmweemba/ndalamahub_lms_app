const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// The Phase 22 public intake routes have their own per-lender CORS pinning
// and are never session-authenticated — this check doesn't apply to them.
const EXEMPT_PREFIXES = ['/api/public'];

const allowedOrigins = () => [process.env.CORS_ORIGIN, process.env.APP_URL].filter(Boolean);

/**
 * Same-site-SPA CSRF defence: sameSite:'lax' cookies already stop cross-site
 * requests from carrying the session cookie in the vast majority of cases,
 * this is the belt-and-braces check for the rest. Only rejects when an
 * Origin header is present and doesn't match an allowed origin — requests
 * with no Origin (server-to-server calls, most non-browser clients) are not
 * blocked here, since they're not the CSRF threat model this exists for.
 * `CORS_ORIGIN=*` (the historical permissive default) disables the check.
 */
const originCheck = (req, res, next) => {
  if (!UNSAFE_METHODS.includes(req.method)) return next();
  if (EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();

  const origin = req.headers.origin;
  if (!origin) return next();

  const allowed = allowedOrigins();
  if (allowed.includes('*') || allowed.length === 0) return next();

  if (!allowed.includes(origin)) {
    return res.status(403).json({ message: 'Origin not allowed.' });
  }

  next();
};

module.exports = originCheck;
