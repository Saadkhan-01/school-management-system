import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { STUDENT_STATUSES } from "./student.model";
import { studentCreateSchema, studentUpdateSchema } from "./student.validation";
import * as svc from "./student.service";

/**
 * Students (§7). Reads are role-scoped in the service (docs/permissions.md):
 * admin/principal full read; receptionist/librarian limited fields; teacher
 * assigned classes; student own record; parent verified-linked children.
 * Writes are Admin only.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const statusSchema = z.object({ status: z.enum(STUDENT_STATUSES) });
const READ_ROLES = ["admin", "principal", "receptionist", "librarian", "teacher", "student", "parent"] as const;

r.post("/", authenticate, authorize("admin"), validate(studentCreateSchema), requireDb, wrap(async (req, res) => {
  const student = await svc.createStudent(req.body as Record<string, unknown>);
  res.status(201).json({ success: true, data: { student } });
}));
r.get("/", authenticate, authorize(...READ_ROLES), requireDb, wrap(async (req, res) => {
  const out = await svc.listStudents(req.query as Record<string, unknown>, { id: req.user!.id, role: req.user!.role });
  res.json({ success: true, data: { students: out.items }, meta: { ...out.meta, limitedFields: out.limited } });
}));
r.get("/:id", authenticate, authorize(...READ_ROLES), requireDb, wrap(async (req, res) => {
  const student = await svc.getStudent(req.params.id, { id: req.user!.id, role: req.user!.role });
  res.json({ success: true, data: { student } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(studentUpdateSchema), requireDb, wrap(async (req, res) => {
  const student = await svc.updateStudent(req.params.id, req.body as Record<string, unknown>);
  res.json({ success: true, data: { student } });
}));
r.patch("/:id/status", authenticate, authorize("admin"), validate(statusSchema), requireDb, wrap(async (req, res) => {
  const student = await svc.setStudentStatus(req.params.id, req.body.status);
  res.json({ success: true, data: { student } });
}));

export default r;
