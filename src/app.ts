import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ICouponRepository } from './repositories/ICouponRepository';
import { InMemoryCouponRepository } from './repositories/InMemoryCouponRepository';
import { CouponService } from './services/coupon.service';
import { CouponController } from './controllers/coupon.controller';
import { createCouponRouter } from './routes/coupon.routes';
import { errorHandler } from './middlewares/errorHandler';

export interface AppOptions {
  repository?: ICouponRepository;
  storageType?: 'mongodb' | 'memory';
}

export const createApp = (options?: AppOptions): Application => {
  const app: Application = express();

  // Security & Utility Middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false, // allow flexible development testing
    })
  );
  app.use(
    cors({
      origin: '*', // Allow requests from any frontend client during testing
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger (disabled during test runs)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Repository & Service Initialization
  const repository = options?.repository || new InMemoryCouponRepository();
  const couponService = new CouponService(repository);
  const couponController = new CouponController(couponService);
  const couponRouter = createCouponRouter(couponController);

  // Health Check Endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Coupon API is running smoothly',
      storage: options?.storageType || (repository instanceof InMemoryCouponRepository ? 'memory' : 'mongodb'),
      version: '1.0.0',
      endpoints: {
        createCoupon: 'POST /coupons',
        listCoupons: 'GET /coupons',
        applyCoupon: 'POST /coupons/apply',
        health: 'GET /health',
      },
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Coupon Routes on both /coupons (prompt requirement) and /api/coupons (common convention)
  app.use('/coupons', couponRouter);
  app.use('/api/coupons', couponRouter);

  // 404 Handler for undefined routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
