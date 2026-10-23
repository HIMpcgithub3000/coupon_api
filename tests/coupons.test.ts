import request from 'supertest';
import { createApp } from '../src/app';
import { InMemoryCouponRepository } from '../src/repositories/InMemoryCouponRepository';

describe('Coupons API Integration Tests', () => {
  let repository: InMemoryCouponRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    repository = new InMemoryCouponRepository();
    app = createApp({ repository });
  });

  // -------------------------------------------------------------
  // POST /coupons
  // -------------------------------------------------------------
  describe('POST /coupons', () => {
    it('creates a coupon with a code, a discount percent from 1 to 90, and an expiry date', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'DISCOUNT20',
          discount: 20,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('DISCOUNT20');
      expect(response.body.data.discount).toBe(20);
      expect(response.body.data.id).toBeDefined();
    });

    it('creates coupon with lowercase code and normalizes to uppercase', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'lowercase50',
          discount: 50,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.code).toBe('LOWERCASE50');
    });

    it('accepts minimum boundary discount of 1', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'MIN1',
          discount: 1,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.discount).toBe(1);
    });

    it('accepts maximum boundary discount of 90', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'MAX90',
          discount: 90,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.discount).toBe(90);
    });

    it('returns 400 when discount is 0 (below minimum 1)', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'ZERO',
          discount: 0,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/between 1 and 90/i);
    });

    it('returns 400 when discount is greater than 90 (e.g. 91)', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'TOO_HIGH',
          discount: 91,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/between 1 and 90/i);
    });

    it('returns 400 when discount is not a number', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'NAN_TEST',
          discount: 'abc',
          expiryDate: futureDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 400 when code is missing', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          discount: 25,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Coupon code is required/i);
    });

    it('returns 400 when expiryDate is missing', async () => {
      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'NO_EXPIRY',
          discount: 25,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Expiry date is required/i);
    });

    it('returns 400 when expiryDate is already in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'PAST_EXPIRY',
          discount: 25,
          expiryDate: pastDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/must be in the future/i);
    });

    it('returns 409 when creating a duplicate coupon code', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // First creation
      await request(app)
        .post('/coupons')
        .send({
          code: 'DUPLICATE',
          discount: 20,
          expiryDate: futureDate,
        });

      // Second creation with same code
      const response = await request(app)
        .post('/coupons')
        .send({
          code: 'duplicate',
          discount: 30,
          expiryDate: futureDate,
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already exists/i);
    });
  });

  // -------------------------------------------------------------
  // GET /coupons
  // -------------------------------------------------------------
  describe('GET /coupons', () => {
    it('lists all coupons', async () => {
      const futureDate = new Date(Date.now() + 86400000);

      await repository.create({
        code: 'PROMO1',
        discount: 10,
        expiryDate: futureDate,
      });

      await repository.create({
        code: 'PROMO2',
        discount: 20,
        expiryDate: futureDate,
      });

      const response = await request(app).get('/coupons');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0].code).toBeDefined();
    });

    it('returns empty array when no coupons exist', async () => {
      const response = await request(app).get('/coupons');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------
  // POST /coupons/apply
  // -------------------------------------------------------------
  describe('POST /coupons/apply', () => {
    beforeEach(async () => {
      // Seed a valid active coupon and an expired coupon
      const futureDate = new Date(Date.now() + 86400000 * 10);
      const pastDate = new Date(Date.now() - 86400000 * 2);

      await repository.create({
        code: 'VALID20',
        discount: 20,
        expiryDate: futureDate,
      });

      await repository.create({
        code: 'HALF50',
        discount: 50,
        expiryDate: futureDate,
      });

      await repository.create({
        code: 'EXPIRED10',
        discount: 10,
        expiryDate: pastDate,
      });
    });

    it('successfully applies a valid coupon and returns amount after discount', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
          amount: 100,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.finalAmount).toBe(80);
      expect(response.body.originalAmount).toBe(100);
      expect(response.body.discountPercent).toBe(20);
      expect(response.body.discountAmount).toBe(20);
      expect(response.body.code).toBe('VALID20');
    });

    it('applies coupon case-insensitively and trims spaces', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: '  valid20  ',
          amount: 200,
        });

      expect(response.status).toBe(200);
      expect(response.body.finalAmount).toBe(160);
    });

    it('handles numeric string amount e.g. "100"', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'HALF50',
          amount: '100',
        });

      expect(response.status).toBe(200);
      expect(response.body.finalAmount).toBe(50);
    });

    it('handles zero order amount gracefully', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
          amount: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.finalAmount).toBe(0);
    });

    // -------------------------------------------------------------
    // SPECIFIC REQUIRED ERROR CHECKS:
    // 1. the coupon code does not exist
    // 2. the coupon has expired
    // 3. the amount is missing, negative, or not a number
    // -------------------------------------------------------------
    it('returns a clear error message when the coupon code does not exist', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'NON_EXISTENT_COUPON',
          amount: 100,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/does not exist/i);
    });

    it('returns a clear error message when the coupon has expired', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'EXPIRED10',
          amount: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/expired/i);
    });

    it('returns a clear error message when the amount is missing (undefined)', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/missing/i);
    });

    it('returns a clear error message when the amount is missing (null or empty string)', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
          amount: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/missing/i);
    });

    it('returns a clear error message when the amount is negative', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
          amount: -50,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/negative/i);
    });

    it('returns a clear error message when the amount is not a number (string with letters)', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          code: 'VALID20',
          amount: 'one_hundred_dollars',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not a number/i);
    });

    it('returns a clear error message when code is missing in apply request', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({
          amount: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Coupon code is required/i);
    });

    it('returns a clear error message when request body is empty object', async () => {
      const response = await request(app)
        .post('/coupons/apply')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Coupon code is required/i);
    });
  });
});
