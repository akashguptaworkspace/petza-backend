import request from 'supertest';

import { app } from '../src/app.js';
import { API_PREFIX } from '../src/routes/index.js';

describe('GET /api/v1/health', () => {
  it('returns a healthy success envelope', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptime');
  });
});

describe('GET /api/v1/unknown-route', () => {
  it('returns a 404 error envelope', async () => {
    const res = await request(app).get(`${API_PREFIX}/unknown-route`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
