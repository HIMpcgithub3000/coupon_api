import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Operational errors (e.g. 400, 404, 409)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const val = err.keyValue ? err.keyValue[key] : '';
    res.status(409).json({
      success: false,
      message: `A record with ${key} '${val}' already exists`,
    });
    return;
  }

  // Malformed JSON parsing error from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body',
    });
    return;
  }

  // Unhandled / unexpected errors
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
