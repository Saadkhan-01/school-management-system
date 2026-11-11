import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { examCreateSchema, examUpdateSchema, scheduleCreateSchema } from "./exam.validation";
import * as svc from "./exam.service";

/**
 * Examinations (§19) under /api/v1/exams.
 * Writes/schedules: Admin. Approve/publish: Admin + Principal.
 * Reads (exam + schedule lists): staff + student/parent — note that exam
 * SCHEDULES are visible, but RESULTS stay hidden until published (see
 * /results and /marks scope rules).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const READ = ["admin", "principal", "teacher", "student", "parent"] as const;

r.post("/", authenticate, authorize("admin"), validate(examCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { exam: await svc.createExam(req.body) } });
}));
r.get("/", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listExams(req.query as Record<string, unknown>);
  res.json({ success: true, data: { exams: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { exam: await svc.getExam(req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(examUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { exam: await svc.updateExam(req.params.id, req.body) } });
}));
r.post("/:id/schedules", authenticate, authorize("admin"), validate(scheduleCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { schedule: await svc.addSchedule(req.params.id, req.body) } });
}));
r.get("/:id/schedules", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { schedules: await svc.listSchedules(req.params.id) } });
}));
r.delete("/:id/schedules/:scheduleId", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteSchedule(req.params.id, req.params.scheduleId) });
}));
r.post("/:id/approve", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { exam: await svc.approveResults(actor(req), req.params.id) } });
}));
r.post("/:id/publish", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { exam: await svc.publishResults(actor(req), req.params.id) } });
}));

export default r;
