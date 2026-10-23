import { ICoupon } from '../types/coupon.types';
import { ICouponRepository, CreateCouponRepositoryInput } from './ICouponRepository';
import { CouponModel, ICouponDocument } from '../models/coupon.model';

export class MongoCouponRepository implements ICouponRepository {
  private toEntity(doc: ICouponDocument): ICoupon {
    return {
      id: doc._id.toString(),
      code: doc.code,
      discount: doc.discount,
      expiryDate: doc.expiryDate,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findAll(): Promise<ICoupon[]> {
    const docs = await CouponModel.find().sort({ createdAt: -1 });
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByCode(code: string): Promise<ICoupon | null> {
    const normalized = code.trim().toUpperCase();
    const doc = await CouponModel.findOne({ code: normalized });
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: CreateCouponRepositoryInput): Promise<ICoupon> {
    const normalized = data.code.trim().toUpperCase();
    const doc = await CouponModel.create({
      code: normalized,
      discount: data.discount,
      expiryDate: data.expiryDate,
    });
    return this.toEntity(doc);
  }

  async clear(): Promise<void> {
    await CouponModel.deleteMany({});
  }
}
