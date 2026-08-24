import request from 'supertest';

import { app } from '../src/app.js';
import { sequelize } from '../src/database/index.js';
import db from '../src/models/index.js';
import { hashOtp } from '../src/utils/otpSecret.js';

const base = process.env.API_PREFIX || '/api/v1';
const OTP = '515151';

/** The account these tests move the password around on. Restored to `partner123` at the end so other suites keep working whatever order they run in. */
const ACCOUNT = { email: 'partner@petza.app', password: 'partner123' };

afterAll(async () => {
  await sequelize.close();
});

/**
 * Plants a challenge with a known code, hashed exactly the way the service
 * hashes it. The endpoint under test is untouched — only the code is
 * predetermined, since it is never stored in the clear.
 *
 * Clears this destination's other challenges first: the service always
 * consumes the *latest active* one, so a leftover from an earlier test
 * would otherwise be what the next assertion actually hits.
 */
async function plantOtp(destination, purpose) {
  await db.OtpChallenge.destroy({ where: { destination } });
  await db.OtpChallenge.create({
    userId: null,
    purpose,
    channel: 'EMAIL',
    destination,
    codeHash: hashOtp(`${destination}:${purpose}:${OTP}`),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

const login = (password) => request(app).post(`${base}/auth/login`).send({ email: ACCOUNT.email, password });

describe('POST /auth/password/forgot', () => {
  it('issues a RESET_PASSWORD code to a known account', async () => {
    const res = await request(app)
      .post(`${base}/auth/password/forgot`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL' })
      .expect(200);

    expect(res.body.data).toMatchObject({ purpose: 'RESET_PASSWORD', channel: 'EMAIL' });
    // The destination comes back masked — a reset flow should never echo the
    // full address back to whoever asked for it.
    expect(res.body.data.destination).not.toBe(ACCOUNT.email);
  });

  it('does not issue one for an identifier with no account', async () => {
    const res = await request(app)
      .post(`${base}/auth/password/forgot`)
      .send({ identifier: 'nobody@petza.test', channel: 'EMAIL' });

    expect(res.status).toBe(404);
  });

  it('validates the identifier against the channel', async () => {
    const res = await request(app)
      .post(`${base}/auth/password/forgot`)
      .send({ identifier: 'not-an-email', channel: 'EMAIL' });

    expect(res.status).toBe(422);
  });
});

describe('POST /auth/password/reset', () => {
  it('rejects a wrong code', async () => {
    await plantOtp(ACCOUNT.email, 'RESET_PASSWORD');

    const res = await request(app)
      .post(`${base}/auth/password/reset`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL', otp: '000000', password: 'irrelevant123' });

    expect(res.status).toBe(400);
  });

  it('will not accept a LOGIN code — reset only ever looks at its own purpose', async () => {
    // A real, unexpired sign-in code and nothing else outstanding.
    await plantOtp(ACCOUNT.email, 'LOGIN');

    const res = await request(app)
      .post(`${base}/auth/password/reset`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL', otp: OTP, password: 'shouldnotwork123' });

    // Reset looks up RESET_PASSWORD challenges only, so it finds nothing —
    // and even if it had, the purpose is part of the hashed subject, so the
    // code would not have matched.
    expect(res.status).toBe(400);
    await login('shouldnotwork123').expect(401);
  });

  it('sets the new password, signs the user in, and revokes every existing session', async () => {
    const before = await login(ACCOUNT.password).expect(200);
    const staleRefreshToken = before.body.data.refreshToken;

    await plantOtp(ACCOUNT.email, 'RESET_PASSWORD');
    const res = await request(app)
      .post(`${base}/auth/password/reset`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL', otp: OTP, password: 'resetpass123' })
      .expect(200);

    expect(res.body.data.user.email).toBe(ACCOUNT.email);
    expect(typeof res.body.data.accessToken).toBe('string');

    // A reset is what someone does when they fear the account is
    // compromised, so whoever else was signed in must be signed out.
    await request(app).post(`${base}/auth/refresh`).send({ refreshToken: staleRefreshToken }).expect(401);

    await login(ACCOUNT.password).expect(401);
    await login('resetpass123').expect(200);
  });

  it('burns the code — the same one cannot reset twice', async () => {
    await plantOtp(ACCOUNT.email, 'RESET_PASSWORD');
    await request(app)
      .post(`${base}/auth/password/reset`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL', otp: OTP, password: 'firstuse123' })
      .expect(200);

    const replay = await request(app)
      .post(`${base}/auth/password/reset`)
      .send({ identifier: ACCOUNT.email, channel: 'EMAIL', otp: OTP, password: 'seconduse123' });

    expect(replay.status).toBe(400);
    await login('seconduse123').expect(401);
  });
});

describe('PATCH /auth/password', () => {
  let accessToken;

  beforeAll(async () => {
    const res = await login('firstuse123').expect(200);
    accessToken = res.body.data.accessToken;
  });

  it('requires a session', async () => {
    await request(app).patch(`${base}/auth/password`).send({ newPassword: 'whatever123' }).expect(401);
  });

  it('requires the current password when the account already has one', async () => {
    const res = await request(app)
      .patch(`${base}/auth/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'nocurrent123' });

    expect(res.status).toBe(400);
  });

  it('rejects a wrong current password', async () => {
    const res = await request(app)
      .patch(`${base}/auth/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'notmypassword', newPassword: 'nocurrent123' });

    expect(res.status).toBe(401);
  });

  it('enforces a minimum length', async () => {
    const res = await request(app)
      .patch(`${base}/auth/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'firstuse123', newPassword: 'short' });

    expect(res.status).toBe(422);
  });

  it('changes it and hands back a working session', async () => {
    const res = await request(app)
      .patch(`${base}/auth/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'firstuse123', newPassword: ACCOUNT.password })
      .expect(200);

    expect(typeof res.body.data.accessToken).toBe('string');

    await request(app)
      .get(`${base}/auth/me`)
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .expect(200);

    // Back to the seeded password, so every other suite still logs in.
    await login(ACCOUNT.password).expect(200);
  });
});

describe('POST /auth/logout-all', () => {
  it('revokes every refresh token the account has', async () => {
    const first = await login(ACCOUNT.password).expect(200);
    const second = await login(ACCOUNT.password).expect(200);

    await request(app)
      .post(`${base}/auth/logout-all`)
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .expect(200);

    // Both devices, not just the one that asked.
    await request(app).post(`${base}/auth/refresh`).send({ refreshToken: first.body.data.refreshToken }).expect(401);
    await request(app).post(`${base}/auth/refresh`).send({ refreshToken: second.body.data.refreshToken }).expect(401);
  });

  it('requires a session', async () => {
    await request(app).post(`${base}/auth/logout-all`).expect(401);
  });
});
