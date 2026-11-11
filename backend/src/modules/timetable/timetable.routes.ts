import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { entryCreateSchema, entryUpdateSchema } from "./timetable.validation";
import * as svc from "./timetable.service";

/**
 * Timetable (§18) under /api/v1/timetable.
 * Writes: Admin only. Reads: Admin/Principal full; Teacher own/assigned;
 * Student/Parent only through /by-student/:studentId (scope-checked).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

r.get("/by-student/:studentId", authenticate, authorize("admin", "principal", "teacher", "student", "parent"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.byStudent(actor(req), req.params.studentId, typeof req.query.sessionId === "string" ? req.query.sessionId : undefined) });
}));
r.get("/by-teacher/:teacherId", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { entries: await svc.byTeacher(actor(req), req.params.teacherId, typeof req.query.sessionId === "string" ? req.query.sessionId : undefined) } });
}));
r.post("/", authenticate, authorize("admin"), validate(entryCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { entry: await svc.createEntry(req.body) } });
}));
r.get("/", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  const out = await svc.listEntries(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { entries: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal", "teacher"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { entry: await svc.getEntry(actor(req), req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(entryUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { entry: await svc.updateEntry(req.params.id, req.body) } });
}));
r.delete("/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteEntry(req.params.id) });
}));

export default r;
