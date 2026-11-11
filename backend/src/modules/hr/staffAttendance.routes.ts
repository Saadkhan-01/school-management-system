
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./staffAttendance.validation";
import * as svc from "./staffAttendance.service";
/** Staff attendance (§13) under /api/v1/staff-attendance. Marking: Admin + Principal (HR/leave-approve scope in matrix). Reads: managers all; every other staff role own records only (service-forced). Students/Parents: 403 at route level. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const STAFF = ["admin", "principal", "teacher", "accountant", "librarian", "receptionist"] as const;
r.post("/", authenticate, authorize("admin", "principal"), validate(v.markSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { record: await svc.mark(actor(req), req.body) } }); }));
r.post("/bulk", authenticate, authorize("admin", "principal"), validate(v.bulkMarkSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: await svc.bulkMark(actor(req), req.body) }); }));
r.get("/", authenticate, authorize(...STAFF), requireDb, wrap(async (req, res) => { const out = await svc.list(actor(req), req.query as Record<string, unknown>); res.json({ success: true, data: { records: out.items }, meta: out.meta }); }));
r.patch("/:id", authenticate, authorize("admin", "principal"), validate(v.updateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { record: await svc.update(actor(req), req.params.id, req.body) } }); }));
export default r;
