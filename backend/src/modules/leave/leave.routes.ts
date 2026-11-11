import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { leaveCreateSchema, leaveDecisionSchema } from "./leave.validation";
import * as svc from "./leave.service";

/**
 * Leave applications (§9/§11/§13) under /api/v1/leave.
 * Create: staff roles for themselves; Parent for a verified-linked child.
 * Decide: Admin + Principal. Lists are scoped in the service.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.get("/approved", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  const date = typeof req.query.date === "string" ? new Date(req.query.date) : new Date();
  if (Number.isNaN(date.getTime())) { res.status(422).json({ success: false, error: { code: "VALIDATION_ERROR", message: "date must be a valid date" } }); return; }
  res.json({ success: true, data: { leaves: await svc.approvedOn(date) } });
}));
r.post("/", authenticate, authorize("admin", "principal", "teacher", "accountant", "librarian", "receptionist", "parent"), validate(leaveCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { leave: await svc.createLeave(actor(req), req.body) } });
}));
r.get("/", authenticate, authorize("admin", "principal", "teacher", "accountant", "librarian", "receptionist", "parent"), requireDb, wrap(async (req, res) => {
  const out = await svc.listLeave(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { leaves: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal", "teacher", "accountant", "librarian", "receptionist", "parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { leave: await svc.getLeave(actor(req), req.params.id) } });
}));
r.patch("/:id/decide", authenticate, authorize("admin", "principal"), validate(leaveDecisionSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { leave: await svc.decideLeave(actor(req), req.params.id, req.body) } });
}));

export default r;
