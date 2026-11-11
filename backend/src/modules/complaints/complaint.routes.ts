
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./complaint.validation";
import * as svc from "./complaint.service";
/** Complaints + Discipline (§25) under /api/v1/complaints. Discipline sub-routes are Admin/Principal ONLY per the permissions matrix (Parent/Student/Teacher = ○ → 403). */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const ALL_STAFF_PLUS = ["admin", "principal", "teacher", "student", "parent", "accountant", "librarian", "receptionist"] as const;
r.post("/discipline", authenticate, authorize("admin", "principal"), validate(v.disciplineCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { record: await svc.createDiscipline(actor(req), req.body) } }); }));
r.get("/discipline", authenticate, authorize("admin", "principal"), requireDb, wrap(async (req, res) => { const out = await svc.listDiscipline(req.query as Record<string, unknown>); res.json({ success: true, data: { records: out.items }, meta: out.meta }); }));
r.patch("/discipline/:id", authenticate, authorize("admin", "principal"), validate(v.disciplineUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { record: await svc.updateDiscipline(req.params.id, req.body) } }); }));
r.post("/", authenticate, authorize(...ALL_STAFF_PLUS), validate(v.complaintCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { complaint: await svc.createComplaint(actor(req), req.body) } }); }));
r.get("/", authenticate, authorize(...ALL_STAFF_PLUS), requireDb, wrap(async (req, res) => { const out = await svc.listComplaints(actor(req), req.query as Record<string, unknown>); res.json({ success: true, data: { complaints: out.items }, meta: out.meta }); }));
r.get("/:id", authenticate, authorize(...ALL_STAFF_PLUS), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { complaint: await svc.getComplaint(actor(req), req.params.id) } }); }));
r.post("/:id/responses", authenticate, authorize(...ALL_STAFF_PLUS), validate(v.respondSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { complaint: await svc.respond(actor(req), req.params.id, req.body.message) } }); }));
r.patch("/:id/status", authenticate, authorize("admin", "principal", "receptionist", "teacher", "accountant", "librarian"), validate(v.statusSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { complaint: await svc.transition(actor(req), req.params.id, req.body) } }); }));
export default r;
