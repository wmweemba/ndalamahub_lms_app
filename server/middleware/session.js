const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');

// clientPromise (not mongoUrl) so this works whether the app connects via
// config/db.js (production) or a test's own mongodb-memory-server instance
// connected after this module loads. Connection.asPromise() is no good here
// on its own — called before any connect() attempt has been made (true of
// both server.js's fire-and-forget connectDB() call and every API test
// file), it resolves immediately against an unset $initialConnection rather
// than actually waiting, so getClient() comes back undefined. Wait on the
// 'connected' event instead, falling back to an already-open connection.
const clientPromise = new Promise((resolve) => {
  if (mongoose.connection.readyState === 1) {
    return resolve(mongoose.connection.getClient());
  }
  mongoose.connection.once('connected', () => resolve(mongoose.connection.getClient()));
});

const store = MongoStore.create({
  clientPromise,
  collectionName: 'sessions',
  touchAfter: 60 * 60 // only rewrite the session doc at most once an hour absent data changes
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const sessionMiddleware = session({
  name: 'ndalamahub.sid',
  secret: process.env.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true, // refresh the idle-expiry cookie on every response
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_DAY_MS // idle timeout; the absolute 7-day cap is enforced in middleware/auth.js's loadUser via session.createdAt
  }
});

module.exports = sessionMiddleware;
