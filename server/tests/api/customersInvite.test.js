// Phase 23 — customer account invite (reuses forgot-password token infra)
// and the borrower self-service change-password route.
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ sent: true }) }));

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const db = require('../helpers/db');
const { seedTwoTenants, createUser, PASSWORD } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');
const { sendEmail } = require('../../utils/email');

describe('Phase 23 — invite & change-password', () => {
  let fx;
  let borrowerNoEmail;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();

    borrowerNoEmail = await createUser({
      username: 'walkinborrower',
      role: 'borrower',
      company: fx.employerA._id,
      nrc: '999999/10/1'
    });
    borrowerNoEmail.email = undefined;
    await borrowerNoEmail.save();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/:id/invite', () => {
    it('lender_admin invites a borrower in their tenant -> 200, email sent, no token leaked', async () => {
      const res = await request(app)
        .post(`/api/users/${fx.borrowerA._id}/invite`)
        .set(authHeader(fx.lenderAdminA));

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/resetToken/i);
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: fx.borrowerA.email }));

      const updated = await User.findById(fx.borrowerA._id);
      expect(updated.passwordResetToken).toBeTruthy();
      expect(updated.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('lender_officer invites a borrower in their tenant -> 200', async () => {
      const res = await request(app)
        .post(`/api/users/${fx.borrowerA._id}/invite`)
        .set(authHeader(fx.lenderOfficerA));

      expect(res.status).toBe(200);
    });

    it('employer_admin (not lender-side) -> 403', async () => {
      const res = await request(app)
        .post(`/api/users/${fx.borrowerA._id}/invite`)
        .set(authHeader(fx.employerAdminA));

      expect(res.status).toBe(403);
    });

    it('lender_admin of tenant B inviting borrowerA (cross-tenant) -> 403', async () => {
      const res = await request(app)
        .post(`/api/users/${fx.borrowerA._id}/invite`)
        .set(authHeader(fx.lenderAdminB));

      expect(res.status).toBe(403);
    });

    it('inviting a borrower with no email on file -> 400', async () => {
      const res = await request(app)
        .post(`/api/users/${borrowerNoEmail._id}/invite`)
        .set(authHeader(fx.lenderAdminA));

      expect(res.status).toBe(400);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('the invited token round-trips through /api/auth/reset-password and sets a working password', async () => {
      await request(app)
        .post(`/api/users/${fx.borrowerA._id}/invite`)
        .set(authHeader(fx.lenderAdminA));

      const lastCall = sendEmail.mock.calls[sendEmail.mock.calls.length - 1][0];
      const token = lastCall.html.match(/token=([a-f0-9]+)/)[1];

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'NewPass1!' });

      expect(resetRes.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: fx.borrowerA.username, password: 'NewPass1!' });

      expect(loginRes.status).toBe(200);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('requires the correct current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(authHeader(fx.borrowerB))
        .send({ currentPassword: 'WrongPass1!', newPassword: 'AnotherPass1!' });

      expect(res.status).toBe(400);
    });

    it('changes the password and the new password logs in', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(authHeader(fx.borrowerB))
        .send({ currentPassword: PASSWORD, newPassword: 'FreshPass1!' });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: fx.borrowerB.username, password: 'FreshPass1!' });

      expect(loginRes.status).toBe(200);
    });
  });
});
