
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { notImplemented } from "../utils/AppError";
/** Honest stub router: route exists, auth required, but feature is Phase 2+ — returns 501, never fake data. */
export function stubRouter(feature: string): Router {
  const r = Router();
  r.all("*", authenticate, (_req, _res, next) => next(notImplemented(feature)));
  return r;
}
/** Public stub (website CMS reads, public admission/enquiry) — still 501 until Phase 2 implements them. */
export function publicStubRouter(feature: string): Router {
  const r = Router();
  r.all("*", (_req, _res, next) => next(notImplemented(feature)));
  return r;
}
