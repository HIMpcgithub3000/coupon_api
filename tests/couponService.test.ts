import { InMemoryCouponRepository } from '../src/repositories/InMemoryCouponRepository';
import { CouponService } from '../src/services/coupon.service';
import { BadRequestError, ConflictError, NotFoundError } from '../src/types/errors';

describe('CouponService Unit Tests', () => {
  let repository: InMemoryCouponRepository;
  let service: CouponService;

  beforeEach(() => {
    repository = new InMemoryCouponRepository();
    service = new CouponService(repository);
  });

  describe('createCoupon', () => {
    it('should successfully create a coupon with valid data', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days from now
      const coupon = await service.createCoupon({
        code: 'save20',
        discount: 20,
        expiryDate: futureDate,
      });

      expect(coupon.id).toBeDefined();
      expect(coupon.code).toBe('SAVE20'); // Normalized to uppercase
      expect(coupon.discount).toBe(20);
      expect(coupon.isExpired).toBe(false);
    });

    it('should throw ConflictError when attempting to create a duplicate coupon code', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await service.createCoupon({
        code: 'PROMO10',
        discount: 10,
        expiryDate: futureDate,
      });

      await expect(
        service.createCoupon({
          code: 'promo10',
          discount: 15,
          expiryDate: futureDate,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getAllCoupons', () => {
    it('should return empty list when no coupons exist', async () => {
      const coupons = await service.getAllCoupons();
      expect(coupons).toEqual([]);
    });

    it('should return all created coupons with correct isExpired flags', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const pastDate = new Date(Date.now() - 86400000);

      await repository.create({
        code: 'ACTIVE',
        discount: 30,
        expiryDate: futureDate,
      });

      await repository.create({
        code: 'EXPIRED',
        discount: 10,
        expiryDate: pastDate,
      });

      const coupons = await service.getAllCoupons();
      expect(coupons).toHaveLength(2);

      const active = coupons.find((c) => c.code === 'ACTIVE');
      const expired = coupons.find((c) => c.code === 'EXPIRED');

      expect(active?.isExpired).toBe(false);
      expect(expired?.isExpired).toBe(true);
    });
  });

  describe('applyCoupon', () => {
    it('should apply discount accurately and round to 2 decimal places', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await service.createCoupon({
        code: 'TEST25',
        discount: 25,
        expiryDate: futureDate,
      });

      const result = await service.applyCoupon('TEST25', 100);
      expect(result.originalAmount).toBe(100);
      expect(result.discountPercent).toBe(25);
      expect(result.discountAmount).toBe(25);
      expect(result.finalAmount).toBe(75);
    });

    it('should correctly handle float amounts and decimal precision', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await service.createCoupon({
        code: 'FLOAT15',
        discount: 15,
        expiryDate: futureDate,
      });

      // 99.99 * 0.15 = 14.9985 -> rounded to 15.00
      // finalAmount = 99.99 - 15.00 = 84.99
      const result = await service.applyCoupon('FLOAT15', 99.99);
      expect(result.discountAmount).toBe(15);
      expect(result.finalAmount).toBe(84.99);
    });

    it('should throw NotFoundError if coupon code does not exist', async () => {
      await expect(service.applyCoupon('UNKNOWN_CODE', 100)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError if coupon has expired', async () => {
      const pastDate = new Date(Date.now() - 5000);
      await repository.create({
        code: 'OLDCOUPON',
        discount: 20,
        expiryDate: pastDate,
      });

      await expect(service.applyCoupon('OLDCOUPON', 100)).rejects.toThrow(
        BadRequestError
      );
    });
  });
});
