import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { parentCreateSchema, parentLinkSchema, parentUpdateSchema } from "./parent.validation";
import * as svc from "./parent.service";

/** Parents (§7/§11). Admin full; Principal read-only (school oversight). Link management is Admin only. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const verifySchema = z.object({ verified: z.boolean() });

r.post("/", authenticate, authorize("admin"), validate(parentCreateSchema), requireDb, wrap(async (req, res) => {
  const parent = await svc.createParent(req.body as Record<string, unknown>);
  res.status(201).json({ success: true, data: { parent } });
}));
r.get("/", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const out = await svc.listParents(req.query as Record<string, unknown>);
  res.json({ success: true, data: { parents: out.items }, meta: out.meta });
}));
r.get("/:id/students", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const links = await svc.listParentStudents(req.params.id);
  res.json({ success: true, data: { links } });
}));
r.post("/:id/students", authenticate, authorize("admin"), validate(parentLinkSchema), requireDb, wrap(async (req, res) => {
  const link = await svc.linkStudent(req.params.id, req.body, req.user!.id);
  res.status(201).json({ success: true, data: { link } });
}));
r.patch("/:id/students/:studentId/verify", authenticate, authorize("admin"), validate(verifySchema), requireDb, wrap(async (req, res) => {
  const link = await svc.setLinkVerified(req.params.id, req.params.studentId, req.body.verified, req.user!.id);
  res.json({ success: true, data: { link } });
}));
r.delete("/:id/students/:studentId", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.unlinkStudent(req.params.id, req.params.studentId) });
}));
r.get("/:id", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { parent: await svc.getParent(req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(parentUpdateSchema), requireDb, wrap(async (req, res) => {
  const parent = await svc.updateParent(req.params.id, req.body as Record<string, unknown>);
  res.json({ success: true, data: { parent } });
}));

export default r;
