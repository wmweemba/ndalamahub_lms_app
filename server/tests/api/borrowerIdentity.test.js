// Phase 19 — NRC-first borrower identity, email-optional for borrowers.
const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const User = require('../../models/User');
const db = require('../helpers/db');
const { seedTwoTenants, PASSWORD } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('Phase 19 — borrower identity (NRC-first, email-optional)', () => {
  let fx;
  let directLender, employerLender;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();

    directLender = await Company.create({
      name: 'Direct Identity Lender',
      type: 'lender',
      lendingModel: 'direct',
      registrationNumber: 'IDENT-DIRECT-1',
      address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
      contactInfo: { phone: '+260970000020', email: 'ident-direct1@example.com' }
    });

    employerLender = fx.lenderA; // employer-model, default lendingModel
  });

  afterAll(async () => {
    await db.disconnect();
  });

  const directAdmin = () => User.create({
    firstName: 'Direct', lastName: 'Admin', username: `directadmin${Date.now()}`,
    email: `directadmin${Date.now()}@example.com`, phone: '+260970000021',
    password: PASSWORD, role: 'lender_admin', company: directLender._id
  });

  it('NRC is required to create a borrower', async () => {
    const admin = await directAdmin();
    const res = await request(app)
      .post('/api/users')
      .set(await authHeader(admin))
      .send({
        firstName: 'No', lastName: 'Nrc', username: `nonrc${Date.now()}`,
        phone: '+260970000030', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString()
      });
    expect(res.status).toBe(400);
  });

  it('a borrower can be created without email (staff create without email OK)', async () => {
    const admin = await directAdmin();
    const res = await request(app)
      .post('/api/users')
      .set(await authHeader(admin))
      .send({
        firstName: 'No', lastName: 'Email', username: `noemail${Date.now()}`,
        phone: '+260970000031', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString(),
        nrc: '222222/10/1'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBeUndefined();
  });

  it('a duplicate NRC within the same company is rejected (400)', async () => {
    const admin = await directAdmin();
    const nrc = '333333/10/1';
    const first = await request(app)
      .post('/api/users')
      .set(await authHeader(admin))
      .send({
        firstName: 'First', lastName: 'Nrc', username: `dupnrc1${Date.now()}`,
        phone: '+260970000032', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString(), nrc
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/users')
      .set(await authHeader(admin))
      .send({
        firstName: 'Second', lastName: 'Nrc', username: `dupnrc2${Date.now()}`,
        phone: '+260970000033', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString(), nrc
      });
    expect(second.status).toBe(400);
  });

  it('the same NRC is allowed under a different company', async () => {
    const nrc = '444444/10/1';
    const admin1 = await directAdmin();
    const res1 = await request(app)
      .post('/api/users')
      .set(await authHeader(admin1))
      .send({
        firstName: 'Same', lastName: 'NrcA', username: `samenrca${Date.now()}`,
        phone: '+260970000034', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString(), nrc
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/users')
      .set(await authHeader(fx.employerAdminA))
      .send({
        firstName: 'Same', lastName: 'NrcB', username: `samenrcb${Date.now()}`,
        email: `samenrcb${Date.now()}@example.com`, phone: '+260970000035', password: PASSWORD,
        role: 'borrower', company: fx.employerA._id.toString(), department: 'Ops', nrc
      });
    expect(res2.status).toBe(201);
  });

  it('email is still required for staff (non-borrower) roles', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(await authHeader(fx.employerAdminA))
      .send({
        firstName: 'No', lastName: 'Email', username: `staffnoemail${Date.now()}`,
        phone: '+260970000036', password: PASSWORD,
        role: 'employer_hr', company: fx.employerA._id.toString(), department: 'HR'
      });
    expect(res.status).toBe(400);
  });

  it('a borrower with no email can still log in by username', async () => {
    const admin = await directAdmin();
    const username = `loginnoemail${Date.now()}`;
    const createRes = await request(app)
      .post('/api/users')
      .set(await authHeader(admin))
      .send({
        firstName: 'Login', lastName: 'NoEmail', username,
        phone: '+260970000037', password: PASSWORD,
        role: 'borrower', company: directLender._id.toString(), nrc: '555555/10/1'
      });
    expect(createRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  describe('direct-model gate on lender staff borrower creation', () => {
    it('lender staff of a direct-model lender can attach a borrower to their own company', async () => {
      const admin = await directAdmin();
      const res = await request(app)
        .post('/api/users')
        .set(await authHeader(admin))
        .send({
          firstName: 'Direct', lastName: 'Walkin', username: `walkin${Date.now()}`,
          phone: '+260970000038', password: PASSWORD,
          role: 'borrower', company: directLender._id.toString(), nrc: '666666/10/1'
        });
      expect(res.status).toBe(201);
    });

    it('lender_officer of a direct-model lender may also onboard a walk-in borrower', async () => {
      const officer = await User.create({
        firstName: 'Direct', lastName: 'Officer', username: `directofficer${Date.now()}`,
        email: `directofficer${Date.now()}@example.com`, phone: '+260970000039',
        password: PASSWORD, role: 'lender_officer', company: directLender._id
      });
      const res = await request(app)
        .post('/api/users')
        .set(await authHeader(officer))
        .send({
          firstName: 'Walkin', lastName: 'ByOfficer', username: `walkinofficer${Date.now()}`,
          phone: '+260970000040', password: PASSWORD,
          role: 'borrower', company: directLender._id.toString(), nrc: '777777/10/1'
        });
      expect(res.status).toBe(201);
    });

    it('lender staff of an employer-model lender cannot attach a borrower to their own (lender) company', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(await authHeader(fx.lenderAdminA))
        .send({
          firstName: 'Bad', lastName: 'Direct', username: `baddirect${Date.now()}`,
          phone: '+260970000041', password: PASSWORD,
          role: 'borrower', company: employerLender._id.toString(), nrc: '888888/10/1'
        });
      expect(res.status).toBe(403);
    });
  });
});
