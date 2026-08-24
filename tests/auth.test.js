import request from 'supertest';

import { app } from '../src/app.js';
import { sequelize } from '../src/database/index.js';

const base = process.env.API_PREFIX || '/api/v1';

afterAll(async () => {
  await sequelize.close();
});

describe('POST /auth/login', () => {
  it('logs in a seeded partner and returns the collapsed PARTNER context role', async () => {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'partner@petza.app', password: 'partner123' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'partner@petza.app', role: 'PARTNER' });
    expect(res.body.data.user.partnerStoreId).toBeTruthy();
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('logs in a seeded admin with no partnerStoreId', async () => {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'admin@petza.app', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'admin@petza.app', role: 'ADMIN' });
    expect(res.body.data.user).not.toHaveProperty('partnerStoreId');
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'admin@petza.app', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'nobody@petza.app', password: 'whatever' });

    expect(res.status).toBe(401);
  });

  it('rejects a malformed request body with a validation error', async () => {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me', () => {
  async function loginAndGetToken(email, password) {
    const res = await request(app).post(`${base}/auth/login`).send({ email, password });
    return res.body.data.accessToken;
  }

  it('returns the authenticated user profile for a valid token', async () => {
    const token = await loginAndGetToken('partner@petza.app', 'partner123');

    const res = await request(app).get(`${base}/auth/me`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'partner@petza.app', role: 'PARTNER' });
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get(`${base}/auth/me`);

    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await request(app).get(`${base}/auth/me`).set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  async function login() {
    const res = await request(app).post(`${base}/auth/login`).send({ email: 'partner@petza.app', password: 'partner123' });
    return res.body.data;
  }

  it('rotates a valid refresh token for a new access+refresh pair', async () => {
    const { refreshToken } = await login();

    const res = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('lets the new access token authenticate /auth/me', async () => {
    const { refreshToken } = await login();
    const refreshed = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });

    const res = await request(app).get(`${base}/auth/me`).set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'partner@petza.app' });
  });

  it('rejects reuse of an already-rotated refresh token and kills the whole session chain', async () => {
    const { refreshToken } = await login();
    const firstRefresh = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });
    const newRefreshToken = firstRefresh.body.data.refreshToken;

    // Replay the original (now-revoked) token — simulates a stolen refresh token used after rotation.
    const replay = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });
    expect(replay.status).toBe(401);

    // The reuse detection should have revoked the legitimate rotated token too.
    const followUp = await request(app).post(`${base}/auth/refresh`).send({ refreshToken: newRefreshToken });
    expect(followUp.status).toBe(401);
  });

  it('rejects a malformed refresh token', async () => {
    const res = await request(app).post(`${base}/auth/refresh`).send({ refreshToken: 'garbage' });

    expect(res.status).toBe(422);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used to refresh', async () => {
    const login = await request(app).post(`${base}/auth/login`).send({ email: 'partner@petza.app', password: 'partner123' });
    const { refreshToken } = login.body.data;

    const logout = await request(app).post(`${base}/auth/logout`).send({ refreshToken });
    expect(logout.status).toBe(200);

    const res = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('is idempotent — logging out with an unknown token still succeeds', async () => {
    const res = await request(app).post(`${base}/auth/logout`).send({ refreshToken: 'a'.repeat(40) });

    expect(res.status).toBe(200);
  });
});
