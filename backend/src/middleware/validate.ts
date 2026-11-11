
import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";
export const validate = (schema: ZodSchema, part: "body" | "query" | "params" = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req[part]);
    if (!r.success) return next(new AppError(422, "VALIDATION_ERROR", "Request validation failed", r.error.flatten()));
    req[part] = r.data; return next();
  };
