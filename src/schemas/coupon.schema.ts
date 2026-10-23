import { z } from 'zod';

export const createCouponSchema = z.object({
  code: z
    .string({
      required_error: 'Coupon code is required',
      invalid_type_error: 'Coupon code must be a string',
    })
    .trim()
    .min(1, 'Coupon code cannot be empty')
    .min(2, 'Coupon code must be at least 2 characters')
    .max(30, 'Coupon code cannot exceed 30 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code can only contain alphanumeric characters, hyphens, and underscores')
    .transform((val) => val.toUpperCase()),

  discount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z
      .number({
        required_error: 'Discount percent is required',
        invalid_type_error: 'Discount percent must be a number',
      })
      .refine((val) => Number.isFinite(val), 'Discount percent must be a finite number')
      .refine(
        (val) => val >= 1 && val <= 90,
        'Discount percent must be between 1 and 90'
      )
  ),

  expiryDate: z
    .string({
      required_error: 'Expiry date is required',
      invalid_type_error: 'Expiry date must be a valid date string',
    })
    .or(z.date())
    .refine((val) => {
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    }, 'Expiry date must be a valid date (e.g. YYYY-MM-DD or ISO 8601)')
    .transform((val) => new Date(val))
    .refine(
      (val) => val.getTime() > Date.now(),
      'Expiry date must be in the future'
    ),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;

/**
 * Validates apply coupon body with granular error messages for:
 * 1. missing amount
 * 2. negative amount
 * 3. not a number amount
 * 4. missing coupon code
 */
export function validateApplyCouponInput(body: any): {
  isValid: boolean;
  error?: string;
  data?: { code: string; amount: number };
} {
  // Check code
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a JSON object containing code and amount' };
  }

  const { code, amount } = body;

  if (code === undefined || code === null || String(code).trim() === '') {
    return { isValid: false, error: 'Coupon code is required' };
  }

  if (typeof code !== 'string') {
    return { isValid: false, error: 'Coupon code must be a string' };
  }

  // Check amount: missing, negative, or not a number
  if (amount === undefined || amount === null || amount === '') {
    return { isValid: false, error: 'Amount is missing. Please provide an order amount.' };
  }

  // Handle typeof number or numeric string
  if (typeof amount !== 'number' && typeof amount !== 'string') {
    return { isValid: false, error: 'Amount is not a number. Please provide a valid numeric value.' };
  }

  const parsedAmount = typeof amount === 'number' ? amount : Number(amount.trim());

  if (isNaN(parsedAmount) || !Number.isFinite(parsedAmount)) {
    return { isValid: false, error: 'Amount is not a number. Please provide a valid numeric value.' };
  }

  if (parsedAmount < 0) {
    return { isValid: false, error: 'Amount cannot be negative. Please provide a positive order amount.' };
  }

  return {
    isValid: true,
    data: {
      code: code.trim().toUpperCase(),
      amount: parsedAmount,
    },
  };
}
