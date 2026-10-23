import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponDocument extends Document {
  code: string;
  discount: number;
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICouponDocument>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      minlength: [2, 'Coupon code must be at least 2 characters'],
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
    },
    discount: {
      type: Number,
      required: [true, 'Discount percent is required'],
      min: [1, 'Discount percent must be at least 1'],
      max: [90, 'Discount percent cannot exceed 90'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const CouponModel = mongoose.model<ICouponDocument>('Coupon', CouponSchema);
