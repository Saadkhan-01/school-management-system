import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { teacherCreateSchema, teacherUpdateSchema } from "./teacher.validation";
import * as svc from "./teacher.service";

/** Teachers (§7). Admin full; Principal read-only. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.post("/", authenticate, authorize("admin"), validate(teacherCreateSchema), requireDb, wrap(async (req, res) => {
  const teacher = await svc.createTeacher(req.body as Record<string, unknown>);
  res.status(201).json({ success: true, data: { teacher } });
}));
r.get("/", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const out = await svc.listTeachers(req.query as Record<string, unknown>);
  res.json({ success: true, data: { teachers: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { teacher: await svc.getTeacher(req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(teacherUpdateSchema), requireDb, wrap(async (req, res) => {
  const teacher = await svc.updateTeacher(req.params.id, req.body as Record<string, unknown>);
  res.json({ success: true, data: { teacher } });
}));

export default r;
