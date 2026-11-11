import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { enrollSchema, promoteSchema, transferSchema, withdrawSchema } from "./enrollment.validation";
import * as svc from "./enrollment.service";
import { logActivity } from "../audit/audit.service";

/** Enrollments (§17). Admin manages; Principal read-only oversight. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.post("/", authenticate, authorize("admin"), validate(enrollSchema), requireDb, wrap(async (req, res) => {
  const enrollment = await svc.enrollStudent(req.body);
  await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: "enrollment.create", entityKind: "enrollment", entityId: String(enrollment._id), summary: "Created a student enrollment", metadata: { studentId: req.body.studentId, sessionId: req.body.sessionId, classId: req.body.classId, sectionId: req.body.sectionId }, ip: req.ip });
  res.status(201).json({ success: true, data: { enrollment } });
}));
r.get("/", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const out = await svc.listEnrollments(req.query as Record<string, unknown>);
  res.json({ success: true, data: { enrollments: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { enrollment: await svc.getEnrollment(req.params.id) } });
}));
r.post("/:id/transfer", authenticate, authorize("admin"), validate(transferSchema), requireDb, wrap(async (req, res) => {
  const enrollment = await svc.transferEnrollment(req.params.id, req.body);
  await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: "enrollment.transfer", entityKind: "enrollment", entityId: String((enrollment as { _id?: unknown } | null)?._id ?? req.params.id), summary: "Transferred an enrollment to a new class/section", metadata: { fromEnrollmentId: req.params.id, classId: req.body.classId, sectionId: req.body.sectionId }, ip: req.ip });
  res.status(201).json({ success: true, data: { enrollment } });
}));
r.post("/:id/withdraw", authenticate, authorize("admin"), validate(withdrawSchema), requireDb, wrap(async (req, res) => {
  const enrollment = await svc.withdrawEnrollment(req.params.id, req.body);
  await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: "enrollment.withdraw", entityKind: "enrollment", entityId: req.params.id, summary: "Withdrew an enrollment", metadata: {}, ip: req.ip });
  res.json({ success: true, data: { enrollment } });
}));
r.post("/:id/promote", authenticate, authorize("admin"), validate(promoteSchema), requireDb, wrap(async (req, res) => {
  const enrollment = await svc.promoteEnrollment(req.params.id, req.body);
  await logActivity({ actor: { id: req.user!.id, role: req.user!.role }, action: "enrollment.promote", entityKind: "enrollment", entityId: String((enrollment as { _id?: unknown } | null)?._id ?? req.params.id), summary: "Promoted a student to the next session", metadata: { fromEnrollmentId: req.params.id, toSessionId: req.body.toSessionId, toClassId: req.body.toClassId, toSectionId: req.body.toSectionId }, ip: req.ip });
  res.status(201).json({ success: true, data: { enrollment } });
}));

export default r;
