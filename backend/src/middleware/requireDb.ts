
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";
export function requireDb(_req: Request, _res: Response, next: NextFunction) {
  if (mongoose.connection.readyState !== 1) return next(new AppError(503, "DB_UNAVAILABLE", "Database is not connected. Configure MONGODB_URI (MongoDB Atlas) — see backend/.env.example"));
  return next();
}
