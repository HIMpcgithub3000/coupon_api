import request from 'supertest';
import { createApp } from '../src/app';
import { InMemoryCouponRepository } from '../src/repositories/InMemoryCouponRepository';

describe('Part 2 Edge Cases Verification Tests', () => {
  let repository: InMemoryCouponRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    repository = new InMemoryCouponRepository();
    app = createApp({ repository });

    // Seed active and expired coupons
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const pastDate = new Date(Date.now() - 86400000);

    await repository.create({
      code: 'ACTIVE20',
      discount: 20,
      expiryDate: futureDate,
    });

    await repository.create({
      code: 'PRECISION15',
      discount: 15,
      expiryDate: futureDate,
    });

    await repository.create({
      code: 'EXPIRED_CODE',
      discount: 10,
      expiryDate: pastDate,
    });
  });

  // Bug 1: Missing null check for non-existent coupon
  it('Bug 1: returns 404 when coupon code does not exist in database', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'DOES_NOT_EXIST', amount: 100 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/does not exist/i);
  });

  // Bug 3: NoSQL injection attempt
  it('Bug 3: prevents NoSQL injection attack when code is an object (e.g. {"$ne": null})', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: { $ne: null }, amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/must be a string|required/i);
  });

  // Bug 4: Amount missing
  it('Bug 4a: returns 400 clear error when amount is missing (undefined)', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'ACTIVE20' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/amount is missing/i);
  });

  // Bug 4: Amount is negative
  it('Bug 4b: returns 400 clear error when amount is negative', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'ACTIVE20', amount: -50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be negative/i);
  });

  // Bug 4: Amount is not a number
  it('Bug 4c: returns 400 clear error when amount is not a number', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'ACTIVE20', amount: 'not_a_valid_amount' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not a number/i);
  });

  // Bug 5: Floating point precision rounding
  it('Bug 5: handles floating-point math safely with exact 2-decimal place precision', async () => {
    // 99.99 * 0.15 = 14.9985 -> rounded to 15.00
    // finalAmount = 99.99 - 15.00 = 84.99
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'PRECISION15', amount: 99.99 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.originalAmount).toBe(99.99);
    expect(res.body.discountAmount).toBe(15.0);
    expect(res.body.finalAmount).toBe(84.99);
  });

  // Bug 6: Expired coupon check
  it('Bug 6: returns 400 when coupon has expired', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({ code: 'EXPIRED_CODE', amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/expired/i);
  });

  // Bug 7: Empty or invalid payload guard
  it('Bug 7: returns 400 when request body is empty object', async () => {
    const res = await request(app)
      .post('/coupons/apply')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/code is required/i);
  });
});
