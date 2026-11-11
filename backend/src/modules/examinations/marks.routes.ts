import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { markCorrectionSchema, marksBulkSchema } from "./exam.validation";
import * as svc from "./exam.service";

/**
 * Marks (§19) under /api/v1/marks.
 * Entry/correction: Teachers for ASSIGNED subjects/classes only (service
 * enforced, 403 otherwise) + Admin. Reads: staff scoped; student/parent only
 * for published results (service returns 404 RESULT_NOT_PUBLISHED otherwise).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.post("/bulk", authenticate, authorize("admin", "teacher"), validate(marksBulkSchema), requireDb, wrap(async (req, res) => {
  const out = await svc.enterMarksBulk(actor(req), req.body);
  res.status(201).json({ success: true, data: out });
}));
r.get("/", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  const out = await svc.listMarks(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { marks: out.items }, meta: out.meta });
}));
r.patch("/:id", authenticate, authorize("admin", "teacher"), validate(markCorrectionSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { mark: await svc.correctMark(actor(req), req.params.id, req.body) } });
}));

export default r;
