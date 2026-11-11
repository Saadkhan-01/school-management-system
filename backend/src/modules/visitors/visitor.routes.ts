
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./visitor.validation";
import * as svc from "./visitor.service";
/** Visitors (§15) under /api/v1/visitors. Receptionist + Admin ONLY — the receptionist scope stays narrow: no finance/payroll/confidential-academic routes are exposed to this role anywhere (matrix). */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const SCOPE = ["admin", "receptionist"] as const;
r.get("/dashboard", authenticate, authorize(...SCOPE), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: await svc.dashboard() }); }));
r.post("/", authenticate, authorize(...SCOPE), validate(v.visitorCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { visitor: await svc.checkIn(actor(req), req.body) } }); }));
r.get("/", authenticate, authorize(...SCOPE), requireDb, wrap(async (req, res) => { const out = await svc.list(req.query as Record<string, unknown>); res.json({ success: true, data: { visitors: out.items }, meta: out.meta }); }));
r.post("/:id/checkout", authenticate, authorize(...SCOPE), validate(v.checkoutSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { visitor: await svc.checkOut(req.params.id, req.body) } }); }));
export default r;
