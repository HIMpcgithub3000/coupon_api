export interface ICoupon {
  id: string;
  code: string;
  discount: number; // 1 to 90
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  isExpired?: boolean;
  pendingSync?: boolean;
  storageSource?: 'mongodb' | 'memory';
}

export interface CreateCouponDTO {
  code: string;
  discount: number;
  expiryDate: string | Date;
}

export interface ApplyCouponDTO {
  code: string;
  amount: number;
}

export interface ApplyCouponResult {
  code: string;
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  finalAmount: number;
}
