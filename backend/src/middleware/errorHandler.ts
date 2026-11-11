
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message, details: err.details ?? undefined } });
  const e = err as { name?: string; code?: number; keyValue?: Record<string, unknown> };
  if (e && e.code === 11000) return res.status(409).json({ success: false, error: { code: "DUPLICATE_KEY", message: "A record with the same unique value already exists", details: e.keyValue } });
  if (e && e.name === "CastError") return res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "An identifier in the request is not valid" } });
  if (e && e.name === "ValidationError") return res.status(422).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Record validation failed", details: (err as Error).message } });
  logger.error(`Unhandled error on ${req.method} ${req.path}`, err);
  return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}
export function notFoundHandler(req: Request, res: Response) { return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } }); }
