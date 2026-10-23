import { ICoupon } from '../types/coupon.types';
import { ICouponRepository, CreateCouponRepositoryInput } from './ICouponRepository';

export class InMemoryCouponRepository implements ICouponRepository {
  private coupons: Map<string, ICoupon> = new Map();
  private idCounter = 1;

  async findAll(): Promise<ICoupon[]> {
    const list = Array.from(this.coupons.values());
    // Sort by createdAt descending
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByCode(code: string): Promise<ICoupon | null> {
    const normalized = code.trim().toUpperCase();
    const coupon = this.coupons.get(normalized);
    return coupon ? { ...coupon } : null;
  }

  async create(data: CreateCouponRepositoryInput): Promise<ICoupon> {
    const normalized = data.code.trim().toUpperCase();
    const now = new Date();
    const newCoupon: ICoupon = {
      id: `coupon_${this.idCounter++}_${Date.now()}`,
      code: normalized,
      discount: data.discount,
      expiryDate: new Date(data.expiryDate),
      createdAt: now,
      updatedAt: now,
    };

    this.coupons.set(normalized, newCoupon);
    return { ...newCoupon };
  }

  async clear(): Promise<void> {
    this.coupons.clear();
    this.idCounter = 1;
  }
}
