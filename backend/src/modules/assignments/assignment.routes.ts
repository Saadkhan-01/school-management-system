import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { assignmentCreateSchema, assignmentUpdateSchema, gradeSchema, materialCreateSchema, submissionCreateSchema } from "./assignment.validation";
import * as svc from "./assignment.service";

/**
 * Assignments & submissions (§9/§20) under /api/v1/assignments.
 * Attachments are metadata only until file storage is configured (§34) —
 * see assignment.model.ts. Scope is enforced in the service.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const hint = (req: Request) => (typeof req.query.studentId === "string" ? req.query.studentId : undefined);

/* Grading route is registered before /:id so "submissions" is never parsed as an assignment id. */
r.patch("/submissions/:submissionId/grade", authenticate, authorize("admin", "teacher"), validate(gradeSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { submission: await svc.gradeSubmission(actor(req), req.params.submissionId, req.body) } });
}));
r.post("/", authenticate, authorize("admin", "teacher"), validate(assignmentCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { assignment: await svc.createAssignment(actor(req), req.body) } });
}));
r.get("/", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  const out = await svc.listAssignments(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { assignments: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { assignment: await svc.getAssignment(actor(req), req.params.id, hint(req)) } });
}));
r.patch("/:id", authenticate, authorize("admin", "teacher"), validate(assignmentUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { assignment: await svc.updateAssignment(actor(req), req.params.id, req.body) } });
}));
r.post("/:id/submissions", authenticate, authorize("student"), validate(submissionCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { submission: await svc.submitAssignment(actor(req), req.params.id, req.body) } });
}));
r.get("/:id/submissions", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { submissions: await svc.listSubmissions(actor(req), req.params.id) } });
}));
r.get("/:id/my-submission", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { submission: await svc.getMySubmission(actor(req), req.params.id, hint(req)) } });
}));

export default r;

/** Study materials (§20) under /api/v1/study-materials — metadata/file-URL records; upload storage is a later phase. */
export const studyMaterialRouter = Router();
studyMaterialRouter.post("/", authenticate, authorize("admin", "teacher"), validate(materialCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { material: await svc.createMaterial(actor(req), req.body) } });
}));
studyMaterialRouter.get("/", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  const out = await svc.listMaterials(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { materials: out.items }, meta: out.meta });
}));
studyMaterialRouter.delete("/:id", authenticate, authorize("admin", "teacher"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteMaterial(actor(req), req.params.id) });
}));
