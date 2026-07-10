process.env.JWT_SECRET = process.env.JWT_SECRET || 'ndalamahub-test-secret';
process.env.NODE_ENV = 'test';
// Pin mongodb-memory-server's mongod version: 8.2.x binaries are built for
// macOS 14+ (dyld symbol missing on Ventura/13.x); 7.0.14 runs fine here and
// is already cached locally.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';
