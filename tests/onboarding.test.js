import request from 'supertest';

import { app } from '../src/app.js';
import { sequelize } from '../src/database/index.js';
import db from '../src/models/index.js';
import { API_PREFIX } from '../src/routes/index.js';
import { hashOtp } from '../src/utils/otpSecret.js';

const base = API_PREFIX;
const OTP = '424242';

afterAll(async () => {
  await sequelize.close();
});

/**
 * Registers a brand-new partner and returns its access token.
 *
 * The OTP is only ever stored hashed, so rather than trying to recover the
 * one the send endpoint generated, this plants a challenge with a known
 * code — hashed exactly the way the service hashes it — and verifies
 * against that. The endpoint under test is unchanged; only the code is
 * predetermined.
 */
async function signUpPartner() {
  const identifier = `partner-${Date.now()}-${Math.floor(Math.random() * 1e6)}@petza.test`;

  await db.OtpChallenge.create({
    userId: null,
    purpose: 'REGISTER',
    channel: 'EMAIL',
    destination: identifier,
    codeHash: hashOtp(`${identifier}:REGISTER:${OTP}`),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  const verify = await request(app)
    .post(`${base}/auth/otp/verify`)
    .send({ identifier, channel: 'EMAIL', purpose: 'REGISTER', otp: OTP, role: 'PARTNER' })
    .expect(200);

  return { identifier, user: verify.body.data.user, token: verify.body.data.accessToken };
}

const authed = (method, path, token) => request(app)[method](`${base}${path}`).set('Authorization', `Bearer ${token}`);

describe('partner onboarding', () => {
  it('starts a verified partner with no store, no business type and no capabilities', async () => {
    const { user, token } = await signUpPartner();

    expect(user.role).toBe('PARTNER');
    expect(user.businessType).toBeUndefined();

    const res = await authed('get', '/partner/onboarding', token).expect(200);
    expect(res.body.data).toMatchObject({ storeId: null, businessType: null, capabilities: [] });
  });

  it('creates the store when a business type is picked, and derives its capability', async () => {
    const { token } = await signUpPartner();

    const res = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'VET' }).expect(200);

    expect(res.body.data).toMatchObject({
      businessType: 'VET',
      capabilities: ['PROVIDE_CARE'],
      approvalStatus: 'PENDING',
      status: 'PENDING_KYC',
    });
    expect(res.body.data.storeId).toBeTruthy();
  });

  it('is idempotent — picking the same type twice keeps one store', async () => {
    const { token } = await signUpPartner();

    const first = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'TRAINER' }).expect(200);
    const second = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'TRAINER' }).expect(200);

    expect(second.body.data.storeId).toBe(first.body.data.storeId);
  });

  it('has no PET_SHOP business type — a pet shop signs up as a kennel', async () => {
    const { token } = await signUpPartner();

    const res = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'PET_SHOP' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('signs up a supplies-only business, whose capability is SELL_SUPPLIES', async () => {
    const { token } = await signUpPartner();

    const res = await authed('post', '/partner/onboarding/business-type', token)
      .send({ businessType: 'SUPPLIER' })
      .expect(200);

    // A shop that only sells supplies gets the supplies dashboard and
    // nothing else — unlike a kennel that adds supplies as a second pillar.
    expect(res.body.data.capabilities).toEqual(['SELL_SUPPLIES']);
  });

  it('asks a supplies store for GST rather than a professional licence', async () => {
    const { token } = await signUpPartner();
    const created = await authed('post', '/partner/onboarding/business-type', token)
      .send({ businessType: 'SUPPLIER' })
      .expect(200);

    await authed('post', '/partner/onboarding/kyc', token)
      .send({
        role: 'SUPPLIER',
        ownerName: 'Imran Sheikh',
        city: 'Bengaluru',
        storeName: 'Petza Supply Co.',
        gstNumber: '29ABCDE1234F1Z5',
        warehouseCity: 'Hosur',
        brandsStocked: ['pedigree'],
        categories: ['dry-food', 'toys'],
        shipsNationwide: true,
        documents: [{ id: 'doc-1', name: 'GST certificate', uri: 'file:///tmp/gst.pdf' }],
      })
      .expect(201);

    const profile = await db.SupplierProfile.findOne({ where: { storeId: created.body.data.storeId } });
    expect(profile.gstNumber).toBe('29ABCDE1234F1Z5');
    expect(profile.shipsNationwide).toBe(true);
    expect(profile.categories).toEqual(['dry-food', 'toys']);
  });

  it('swaps the capability when the type changes before KYC', async () => {
    const { token } = await signUpPartner();

    await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'VET' }).expect(200);
    const res = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'KENNEL' }).expect(200);

    expect(res.body.data.capabilities).toEqual(['SELL_PETS']);
  });

  it('rejects KYC for a different business type than the account is registered as', async () => {
    const { token } = await signUpPartner();
    await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'VET' }).expect(200);

    const res = await authed('post', '/partner/onboarding/kyc', token).send({
      role: 'TRAINER',
      ownerName: 'Dev Raghavan',
      city: 'Mumbai',
      businessName: 'K9 Craft',
      documents: [],
    });

    expect(res.status).toBe(400);
  });

  it('submits KYC into the review queue, and locks the business type behind it', async () => {
    const { token } = await signUpPartner();
    const created = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'VET' }).expect(200);

    const kyc = await authed('post', '/partner/onboarding/kyc', token)
      .send({
        role: 'VET',
        ownerName: 'Dr. Anika Mehra',
        city: 'Pune',
        clinicName: 'Marigold Veterinary Clinic',
        councilRegistrationNumber: 'MVC-2015-7782',
        services: ['consultation', 'vaccination'],
        documents: [{ id: 'doc-1', name: 'Council certificate', uri: 'file:///tmp/cert.pdf' }],
      })
      .expect(201);

    expect(kyc.body.data.approvalStatus).toBe('PENDING');

    // The business type's own profile table is filled, not a pile of
    // nullable columns on the store.
    const profile = await db.VetProfile.findOne({ where: { storeId: created.body.data.storeId } });
    expect(profile.councilRegistrationNumber).toBe('MVC-2015-7782');
    expect(profile.services).toEqual(['consultation', 'vaccination']);

    const documents = await db.StoreKycDocument.count({ where: { storeId: created.body.data.storeId } });
    expect(documents).toBe(1);

    const locked = await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'TRAINER' });
    expect(locked.status).toBe(409);
  });

  it('reports approval status, and requires a session to do it', async () => {
    await request(app).get(`${base}/partner/onboarding/approval-status`).expect(401);

    const login = await request(app)
      .post(`${base}/auth/login`)
      .send({ email: 'partner@petza.app', password: 'partner123' })
      .expect(200);

    const status = await authed('get', '/partner/onboarding/approval-status', login.body.data.accessToken).expect(200);
    expect(status.body.data.approvalStatus).toBe('APPROVED');
  });
});

describe('store capabilities', () => {
  it('gives an approved partner its business type and capability set on login', async () => {
    const login = await request(app)
      .post(`${base}/auth/login`)
      .send({ email: 'partner@petza.app', password: 'partner123' })
      .expect(200);

    expect(login.body.data.user).toMatchObject({ role: 'PARTNER', businessType: 'KENNEL', approvalStatus: 'APPROVED' });
    expect(login.body.data.user.capabilities).toContain('SELL_PETS');
  });

  it('lets an approved kennel also provide care and sell supplies', async () => {
    const login = await request(app).post(`${base}/auth/login`).send({ email: 'partner@petza.app', password: 'partner123' });

    const res = await authed('patch', '/partner/store/capabilities', login.body.data.accessToken)
      .send({ capabilities: ['PROVIDE_CARE', 'SELL_SUPPLIES'] })
      .expect(200);

    expect(res.body.data.capabilities).toEqual(expect.arrayContaining(['SELL_PETS', 'PROVIDE_CARE', 'SELL_SUPPLIES']));

    const me = await authed('get', '/auth/me', login.body.data.accessToken).expect(200);
    expect(me.body.data.capabilities).toEqual(expect.arrayContaining(['SELL_PETS', 'PROVIDE_CARE', 'SELL_SUPPLIES']));
  });

  it('never drops the capability the business type is defined by', async () => {
    const login = await request(app).post(`${base}/auth/login`).send({ email: 'vet@petza.app', password: 'partner123' });

    const res = await authed('patch', '/partner/store/capabilities', login.body.data.accessToken)
      // Omits PROVIDE_CARE — a vet must not be able to drop the capability
      // every booking they have depends on.
      .send({ capabilities: ['SELL_SUPPLIES'] })
      .expect(200);

    expect(res.body.data.capabilities).toContain('PROVIDE_CARE');
  });

  it('refuses to widen capabilities before the account is approved', async () => {
    const { token } = await signUpPartner();
    await authed('post', '/partner/onboarding/business-type', token).send({ businessType: 'KENNEL' }).expect(200);

    const res = await authed('patch', '/partner/store/capabilities', token).send({ capabilities: ['PROVIDE_CARE'] });

    expect(res.status).toBe(403);
  });
});
