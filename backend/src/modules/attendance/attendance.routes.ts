import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { bulkMarkSchema, classQuerySchema, correctionSchema, leavesQuerySchema, reportQuerySchema, rosterQuerySchema } from "./attendance.validation";
import * as svc from "./attendance.service";

/**
 * Attendance (§9) under /api/v1/attendance.
 * Route order follows the established pattern: authenticate → authorize →
 * validate → requireDb (so 401/403/422 are probeable without a database and
 * authorized+valid requests honestly return 503 DB_UNAVAILABLE).
 * Class-level scope (teacher assigned classes only) is enforced in the service.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.post("/bulk", authenticate, authorize("admin", "teacher"), validate(bulkMarkSchema), requireDb, wrap(async (req, res) => {
  const out = await svc.bulkMark(actor(req), req.body);
  res.status(201).json({ success: true, data: out });
}));
r.get("/roster", authenticate, authorize("admin", "principal", "teacher"), validate(rosterQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  const q = req.query as unknown as { classId: string; sectionId: string; sessionId: string };
  const date = typeof req.query.date === "string" ? new Date(req.query.date) : undefined;
  res.json({ success: true, data: await svc.getRoster(actor(req), { ...q, date }) });
}));
r.get("/class", authenticate, authorize("admin", "principal", "teacher"), validate(classQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.getByClass(actor(req), req.query as unknown as { classId: string; sectionId: string; sessionId: string; date: Date }) });
}));
r.get("/report", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), validate(reportQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { report: await svc.attendanceReport(actor(req), req.query as unknown as { sessionId: string; classId?: string; sectionId?: string; studentId?: string; from: Date; to: Date }) } });
}));
r.get("/approved-leaves", authenticate, authorize("admin", "principal", "teacher"), validate(leavesQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { leaves: await svc.approvedLeavesOn(actor(req), req.query as unknown as { date: Date; classId?: string; sectionId?: string; sessionId?: string }) } });
}));
r.get("/student/:studentId", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  const out = await svc.getStudentAttendance(actor(req), req.params.studentId, req.query as Record<string, unknown>);
  res.json({ success: true, data: { records: out.items, summary: out.summary }, meta: out.meta });
}));
r.put("/:id", authenticate, authorize("admin", "teacher"), validate(correctionSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { record: await svc.correctAttendance(actor(req), req.params.id, req.body) } });
}));

export default r;
