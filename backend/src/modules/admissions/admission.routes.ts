import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { admissionEnrollSchema, admissionStatusSchema, publicApplicationSchema } from "./admission.validation";
import * as svc from "./admission.service";

const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const publicFormLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many submissions — please try again later" } } });

/** Public online admission application (§16). Saved with status "Submitted" + history. */
r.post("/public", publicFormLimiter, validate(publicApplicationSchema), requireDb, wrap(async (req, res) => {
  const app = await svc.submitApplication(req.body);
  res.status(201).json({ success: true, data: { id: String(app._id), status: app.status, submittedAt: app.createdAt, message: "Application received with status 'Submitted'. The school office will review it and contact the guardian." } });
}));

/** Office views — Receptionist intake, Admin/Principal oversight (§15/§16). */
r.get("/", authenticate, authorize("admin", "principal", "receptionist"), requireDb, wrap(async (req, res) => {
  const out = await svc.listApplications(req.query as Record<string, unknown>);
  res.json({ success: true, data: { applications: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal", "receptionist"), requireDb, wrap(async (req, res) => {
  const application = await svc.getApplication(req.params.id);
  res.json({ success: true, data: { application } });
}));

/** Status transitions are validated in the service (sequence + deciding role).
 *  "Enrolled" is not a plain status change — it returns 422 pointing at the enroll endpoint. */
r.patch("/:id/status", authenticate, authorize("admin", "principal", "receptionist"), validate(admissionStatusSchema), requireDb, wrap(async (req, res) => {
  const application = await svc.updateApplicationStatus(req.params.id, req.body.status, req.body.note, { id: req.user!.id, role: req.user!.role });
  res.json({ success: true, data: { application } });
}));

/** Phase 4 conversion (§16 steps 6–12) — Admin only. Creates the Student (generated
 *  admission number), the verified parent account/link and the Enrollment together. */
r.post("/:id/enroll", authenticate, authorize("admin"), validate(admissionEnrollSchema), requireDb, wrap(async (req, res) => {
  const result = await svc.enrollApplication(req.params.id, req.body, { id: req.user!.id, role: req.user!.role });
  res.status(201).json({ success: true, data: result });
}));

export default r;
