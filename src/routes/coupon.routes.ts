import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { validateBody } from '../middlewares/validate';
import { createCouponSchema } from '../schemas/coupon.schema';

export const createCouponRouter = (couponController: CouponController): Router => {
  const router = Router();

  // POST /coupons - Create coupon with validation
  router.post('/', validateBody(createCouponSchema), couponController.createCoupon);

  // GET /coupons - List all coupons
  router.get('/', couponController.getCoupons);

  // POST /coupons/apply - Apply coupon to order amount
  router.post('/apply', couponController.applyCoupon);

  return router;
};
