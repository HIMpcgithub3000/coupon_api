import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import { validateApplyCouponInput } from '../schemas/coupon.schema';

export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /**
   * POST /coupons
   * Creates a new coupon
   */
  createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const created = await this.couponService.createCoupon(req.body);
      res.status(201).json({
        success: true,
        message: 'Coupon created successfully',
        data: created,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /coupons
   * Lists all coupons
   */
  getCoupons = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await this.couponService.getAllCoupons();
      res.status(200).json({
        success: true,
        count: coupons.length,
        data: coupons,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /coupons/apply
   * Validates input (amount missing, negative, not a number; code missing)
   * and calculates discounted finalAmount.
   */
  applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = validateApplyCouponInput(req.body);

      if (!validation.isValid || !validation.data) {
        res.status(400).json({
          success: false,
          message: validation.error || 'Invalid request body',
        });
        return;
      }

      const { code, amount } = validation.data;
      const result = await this.couponService.applyCoupon(code, amount);

      res.status(200).json({
        success: true,
        message: 'Coupon applied successfully',
        code: result.code,
        originalAmount: result.originalAmount,
        discountPercent: result.discountPercent,
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount,
      });
    } catch (err) {
      next(err);
    }
  };
}
