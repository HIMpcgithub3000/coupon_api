import { ICoupon } from '../types/coupon.types';

export interface CreateCouponRepositoryInput {
  code: string;
  discount: number;
  expiryDate: Date;
}

export interface ICouponRepository {
  findAll(): Promise<ICoupon[]>;
  findByCode(code: string): Promise<ICoupon | null>;
  create(data: CreateCouponRepositoryInput): Promise<ICoupon>;
  clear?(): Promise<void>; // For testing cleanups
}
