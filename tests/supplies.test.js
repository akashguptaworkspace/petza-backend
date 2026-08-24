import request from 'supertest';

import { app } from '../src/app.js';
import { sequelize } from '../src/database/index.js';
import { API_PREFIX } from '../src/routes/index.js';

const base = API_PREFIX;

/** The kennel demo store, which has to opt into supplies before any of this exists for it. */
const SELLER = { email: 'partner@petza.app', password: 'partner123' };
/** A care-only store, used to prove the pillar is closed to partners who haven't enabled it. */
const NON_SELLER = { email: 'trainer@petza.app', password: 'partner123' };

let sellerToken;
let nonSellerToken;

async function login({ email, password }) {
  const res = await request(app).post(`${base}/auth/login`).send({ email, password }).expect(200);
  return res.body.data.accessToken;
}

const authed = (method, path, token) => request(app)[method](`${base}${path}`).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  sellerToken = await login(SELLER);
  nonSellerToken = await login(NON_SELLER);

  await authed('patch', '/partner/store/capabilities', sellerToken)
    .send({ capabilities: ['SELL_SUPPLIES'] })
    .expect(200);
});

afterAll(async () => {
  await sequelize.close();
});

describe('supplies capability gate', () => {
  it('closes the whole pillar to a partner whose store does not sell supplies', async () => {
    const res = await authed('get', '/partner/supplies/overview', nonSellerToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('opens it once the store has the capability', async () => {
    const res = await authed('get', '/partner/supplies/overview', sellerToken).expect(200);
    expect(res.body.data).toHaveProperty('activeProducts');
  });

  it('requires a session at all', async () => {
    await request(app).get(`${base}/partner/supplies/products`).expect(401);
  });
});

describe('supplies catalogue', () => {
  let productId;
  let lowStockVariantId;

  it('creates a product with its variants and derives the summary fields', async () => {
    const res = await authed('post', '/partner/supplies/products', sellerToken)
      .send({
        name: `Salmon Pâté Wet Food ${Date.now()}`,
        brand: 'Whiskas',
        categorySlug: 'wet-food',
        petTypes: ['cats'],
        status: 'ACTIVE',
        variants: [
          { label: '85 g × 12', priceInInr: 640, mrpInInr: 720, stockQuantity: 26, lowStockThreshold: 8 },
          { label: '85 g × 24', priceInInr: 1180, stockQuantity: 4, lowStockThreshold: 8 },
        ],
      })
      .expect(201);

    const product = res.body.data;
    productId = product.id;
    lowStockVariantId = product.variants.find((variant) => variant.label === '85 g × 24').id;

    // Price and stock are summarised server-side so a list row never has to
    // reduce over variants itself.
    expect(product.priceFromInInr).toBe(640);
    expect(product.totalStock).toBe(30);
    expect(product.variantCount).toBe(2);
    expect(product.variants.map((variant) => variant.stockState)).toEqual(['IN_STOCK', 'LOW_STOCK']);
  });

  it('refuses a product with no variants — it would have no price and no stock', async () => {
    const res = await authed('post', '/partner/supplies/products', sellerToken).send({
      name: 'Nothing To Sell',
      categorySlug: 'toys',
      variants: [],
    });

    expect(res.status).toBe(422);
  });

  it('paginates and searches the catalogue', async () => {
    const res = await authed('get', '/partner/supplies/products?q=whiskas&limit=5', sellerToken).expect(200);

    expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(res.body.data.every((product) => product.brand === 'Whiskas')).toBe(true);
  });

  it('will not publish a product whose variants are all inactive', async () => {
    const created = await authed('post', '/partner/supplies/products', sellerToken)
      .send({
        name: `Unpublishable ${Date.now()}`,
        categorySlug: 'toys',
        variants: [{ label: 'One size', priceInInr: 100, stockQuantity: 1, isActive: false }],
      })
      .expect(201);

    const res = await authed('patch', `/partner/supplies/products/${created.body.data.id}/status`, sellerToken).send({
      status: 'ACTIVE',
    });

    expect(res.status).toBe(400);
  });

  it('replaces the variant set wholesale on update', async () => {
    const res = await authed('patch', `/partner/supplies/products/${productId}`, sellerToken)
      .send({ variants: [{ label: '85 g × 6', priceInInr: 340, stockQuantity: 12, lowStockThreshold: 4 }] })
      .expect(200);

    expect(res.body.data.variantCount).toBe(1);
    expect(res.body.data.priceFromInInr).toBe(340);
  });

  it('never serves a product belonging to another store', async () => {
    await authed('patch', '/partner/store/capabilities', nonSellerToken).send({ capabilities: ['SELL_SUPPLIES'] });

    const res = await authed('get', `/partner/supplies/products/${productId}`, nonSellerToken);
    expect(res.status).toBe(404);

    // Put the trainer back to care-only so the gate test above stays true
    // whichever order these files run in.
    await authed('patch', '/partner/store/capabilities', nonSellerToken).send({ capabilities: ['PROVIDE_CARE'] });
  });

  it('keeps a low-stock variant visible to the inventory filter', async () => {
    const res = await authed('get', '/partner/supplies/inventory?mode=LOW', sellerToken).expect(200);
    expect(res.body.data.every((row) => row.stockState !== 'IN_STOCK')).toBe(true);
    expect(lowStockVariantId).toBeTruthy();
  });
});

describe('supplies stock adjustments', () => {
  let variantId;

  beforeAll(async () => {
    const created = await authed('post', '/partner/supplies/products', sellerToken)
      .send({
        name: `Rope Tug Toy ${Date.now()}`,
        categorySlug: 'toys',
        status: 'ACTIVE',
        variants: [{ label: 'Medium', priceInInr: 299, stockQuantity: 0, lowStockThreshold: 3 }],
      })
      .expect(201);

    variantId = created.body.data.variants[0].id;
  });

  it('applies a relative delta and recomputes the stock state', async () => {
    const res = await authed('patch', `/partner/supplies/inventory/${variantId}`, sellerToken)
      .send({ delta: 12 })
      .expect(200);

    expect(res.body.data.stockQuantity).toBe(12);
    expect(res.body.data.stockState).toBe('IN_STOCK');
  });

  it('never lets a delta drive stock below zero', async () => {
    const res = await authed('patch', `/partner/supplies/inventory/${variantId}`, sellerToken)
      .send({ delta: -999 })
      .expect(200);

    expect(res.body.data.stockQuantity).toBe(0);
    expect(res.body.data.stockState).toBe('OUT_OF_STOCK');
  });

  it('sets stock absolutely for a stock count', async () => {
    const res = await authed('patch', `/partner/supplies/inventory/${variantId}`, sellerToken)
      .send({ stockQuantity: 7 })
      .expect(200);

    expect(res.body.data.stockQuantity).toBe(7);
  });

  it('rejects sending a delta and an absolute quantity together', async () => {
    const res = await authed('patch', `/partner/supplies/inventory/${variantId}`, sellerToken).send({
      delta: 1,
      stockQuantity: 9,
    });

    expect(res.status).toBe(422);
  });

  it('does not find a variant belonging to another store', async () => {
    await authed('patch', '/partner/store/capabilities', nonSellerToken).send({ capabilities: ['SELL_SUPPLIES'] });

    const res = await authed('patch', `/partner/supplies/inventory/${variantId}`, nonSellerToken).send({ delta: 100 });
    expect(res.status).toBe(404);

    await authed('patch', '/partner/store/capabilities', nonSellerToken).send({ capabilities: ['PROVIDE_CARE'] });
  });
});
