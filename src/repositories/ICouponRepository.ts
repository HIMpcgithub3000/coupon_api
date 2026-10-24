import { ICoupon } from '../types/coupon.types';

export interface CreateCouponRepositoryInput {
  code: string;
  discount: number;
  expiryDate: Date;
}

export interface StorageStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  activeStorage: 'mongodb' | 'memory' | 'resilient';
}

export interface ICouponRepository {
  findAll(): Promise<ICoupon[]>;
  findByCode(code: string): Promise<ICoupon | null>;
  create(data: CreateCouponRepositoryInput): Promise<ICoupon>;
  clear?(): Promise<void>;
  getStatus?(): StorageStatus;
  syncPendingToMongo?(): Promise<number>;
  stopReconnectionPoll?(): void;
}
