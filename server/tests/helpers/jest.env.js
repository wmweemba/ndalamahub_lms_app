process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'ndalamahub-test-session-secret';
// Fixed values (rather than the app.js '*' default) so the Origin-check
// middleware (Phase 25) has something concrete to test against.
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.APP_URL = process.env.APP_URL || 'http://localhost:5173';
process.env.NODE_ENV = 'test';
// Pin mongodb-memory-server's mongod version: 8.2.x binaries are built for
// macOS 14+ (dyld symbol missing on Ventura/13.x); 7.0.14 runs fine here and
// is already cached locally.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';
