jest.mock('../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ sent: true }) }));

const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants, PASSWORD } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');
const { sendEmail } = require('../../utils/email');

describe('Email notification wiring', () => {
  let fixtures;

  beforeAll(async () => {
    await db.connect();
    fixtures = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('forgot-password response body contains no reset token', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: fixtures.borrowerA.email });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/resetToken/i);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: fixtures.borrowerA.email }));
  });

  it('approve route sends the loan-approved template to the applicant', async () => {
    const res = await request(app)
      .put(`/api/loans/${fixtures.loanA_pending._id}/approve`)
      .set(authHeader(fixtures.lenderAdminA))
      .send({ approvalNotes: 'Looks good' });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: fixtures.borrowerA.email,
        subject: expect.stringContaining(fixtures.loanA_pending.loanNumber)
      })
    );
  });

  it('does not fail the approve request when mail sending fails', async () => {
    // sendEmail's real implementation never throws/rejects (it catches internally
    // and resolves { sent: false, reason }) — mirror that contract here rather
    // than rejecting, and confirm the route doesn't depend on the outcome.
    sendEmail.mockResolvedValueOnce({ sent: false, reason: 'resend down' });

    const res = await request(app)
      .put(`/api/loans/${fixtures.loanB_pending._id}/approve`)
      .set(authHeader(fixtures.lenderAdminB))
      .send({ approvalNotes: 'Looks good' });

    expect(res.status).toBe(200);
  });
});
