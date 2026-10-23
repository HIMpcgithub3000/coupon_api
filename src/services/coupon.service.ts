import { ICouponRepository } from '../repositories/ICouponRepository';
import { ICoupon, ApplyCouponResult } from '../types/coupon.types';
import { BadRequestError, ConflictError, NotFoundError } from '../types/errors';
import { CreateCouponInput } from '../schemas/coupon.schema';

export class CouponService {
  constructor(private readonly couponRepository: ICouponRepository) {}

  /**
   * Creates a new coupon with validation checks against existing codes.
   */
  async createCoupon(input: CreateCouponInput): Promise<ICoupon> {
    const normalizedCode = input.code.trim().toUpperCase();

    // Check for duplicate code
    const existing = await this.couponRepository.findByCode(normalizedCode);
    if (existing) {
      throw new ConflictError(`Coupon code '${normalizedCode}' already exists`);
    }

    const created = await this.couponRepository.create({
      code: normalizedCode,
      discount: input.discount,
      expiryDate: input.expiryDate,
    });

    return {
      ...created,
      isExpired: created.expiryDate.getTime() <= Date.now(),
    };
  }

  /**
   * Retrieves all coupons, sorted by creation date descending.
   */
  async getAllCoupons(): Promise<ICoupon[]> {
    const coupons = await this.couponRepository.findAll();
    const now = Date.now();

    return coupons.map((c) => ({
      ...c,
      isExpired: c.expiryDate.getTime() <= now,
    }));
  }

  /**
   * Applies a coupon code to a given order amount.
   *
   * Enforces business rules:
   * 1. Coupon code must exist in the database.
   * 2. Coupon must not be expired.
   * 3. Calculates rounded finalAmount and discount amounts.
   */
  async applyCoupon(code: string, amount: number): Promise<ApplyCouponResult> {
    const normalizedCode = code.trim().toUpperCase();

    // 1. Check coupon existence
    const coupon = await this.couponRepository.findByCode(normalizedCode);
    if (!coupon) {
      throw new NotFoundError(`Coupon code '${normalizedCode}' does not exist`);
    }

    // 2. Check coupon expiration
    const now = new Date();
    if (new Date(coupon.expiryDate).getTime() <= now.getTime()) {
      throw new BadRequestError('Coupon has expired');
    }

    // 3. Calculate discount and final amount (safely rounded to 2 decimal places)
    const rawDiscount = (amount * coupon.discount) / 100;
    const discountAmount = Math.round(rawDiscount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

    return {
      code: coupon.code,
      originalAmount: Number(amount.toFixed(2)),
      discountPercent: coupon.discount,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
    };
  }
}
