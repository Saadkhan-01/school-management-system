import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { staffCreateSchema, staffUpdateSchema } from "./staff.validation";
import * as svc from "./staff.service";

/** Staff / HR profiles (§7, §13). Admin full; Principal read-only (staff statistics/oversight). Salary data is Phase 7 and is not part of this profile API. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

r.post("/", authenticate, authorize("admin"), validate(staffCreateSchema), requireDb, wrap(async (req, res) => {
  const staff = await svc.createStaff(req.body as Record<string, unknown>);
  res.status(201).json({ success: true, data: { staff } });
}));
r.get("/", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  const out = await svc.listStaff(req.query as Record<string, unknown>);
  res.json({ success: true, data: { staff: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { staff: await svc.getStaff(req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin"), validate(staffUpdateSchema), requireDb, wrap(async (req, res) => {
  const staff = await svc.updateStaff(req.params.id, req.body as Record<string, unknown>);
  res.json({ success: true, data: { staff } });
}));

export default r;
