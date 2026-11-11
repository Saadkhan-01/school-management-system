import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { announcementsQuerySchema } from "./portal.validation";
import type { ContentItemType } from "../website/contentItem.model";
import * as svc from "./portal.service";

/**
 * Portals (§10/§11, Phase 6) under /api/v1/portal.
 * Route order follows the established pattern: authenticate → authorize →
 * validate → requireDb, so 401 (no token), 403 (wrong role — e.g. a Teacher
 * token on /parent/me, a Parent token on /student/me) and 422 (bad query) are
 * all probeable without a database, and authorized+valid requests honestly
 * return 503 DB_UNAVAILABLE when MongoDB is not connected.
 * Record-level scope (own student record; verified parent links only) is
 * enforced in the service via modules/academic-scope.ts.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.get("/student/me", authenticate, authorize("student"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.getStudentPortal(actor(req)) });
}));

r.get("/parent/me", authenticate, authorize("parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.getParentPortal(actor(req)) });
}));

r.get("/parent/children/:studentId/summary", authenticate, authorize("parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.getChildSummary(actor(req), req.params.studentId) });
}));

/** Announcements for ANY signed-in role; the service slices by audience so a
 *  role-targeted item never reaches another role. */
r.get("/announcements", authenticate, validate(announcementsQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  const type = (req.query.type as ContentItemType | undefined) ?? "announcement";
  const out = await svc.listPortalAnnouncements(actor(req), type);
  res.json({ success: true, data: { announcements: out.items, audiences: out.audiences, role: out.role } });
}));

export default r;
