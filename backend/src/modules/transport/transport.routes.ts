
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./transport.validation";
import * as svc from "./transport.service";
/** Transport (§21) under /api/v1/transport. Writes: Admin (matrix ●). Overview reads: Principal, Accountant (fees view). Student/Parent: own/linked allocations only (service-scoped). */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const OVERVIEW = ["admin", "principal", "accountant"] as const;

r.get("/expiring", authenticate, authorize(...OVERVIEW), validate(v.expiringQuerySchema, "query"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { expiring: await svc.expiringDocuments(Number((req.query as Record<string, unknown>).days ?? 30)) } }); }));
r.post("/buses", authenticate, authorize("admin"), validate(v.busCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { bus: await svc.createBus(req.body) } }); }));
r.get("/buses", authenticate, authorize(...OVERVIEW), requireDb, wrap(async (req, res) => { const out = await svc.listBuses(req.query as Record<string, unknown>); res.json({ success: true, data: { buses: out.items }, meta: out.meta }); }));
r.patch("/buses/:id", authenticate, authorize("admin"), validate(v.busUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { bus: await svc.updateBus(req.params.id, req.body) } }); }));
r.post("/routes", authenticate, authorize("admin"), validate(v.routeCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { route: await svc.createRoute(req.body) } }); }));
r.get("/routes", authenticate, authorize(...OVERVIEW, "student", "parent"), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: { routes: await svc.listRoutes() } }); }));
r.patch("/routes/:id", authenticate, authorize("admin"), validate(v.routeUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { route: await svc.updateRoute(req.params.id, req.body) } }); }));
r.post("/allocations", authenticate, authorize("admin"), validate(v.allocationCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { allocation: await svc.createAllocation(req.body) } }); }));
r.get("/allocations", authenticate, authorize(...OVERVIEW, "student", "parent"), requireDb, wrap(async (req, res) => { const out = await svc.listAllocations(actor(req), req.query as Record<string, unknown>); res.json({ success: true, data: { allocations: out.items }, meta: out.meta }); }));
r.post("/allocations/:id/cancel", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { allocation: await svc.cancelAllocation(req.params.id) } }); }));
r.post("/maintenance", authenticate, authorize("admin"), validate(v.maintenanceCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { record: await svc.createMaintenance(actor(req), req.body) } }); }));
r.get("/maintenance", authenticate, authorize(...OVERVIEW), requireDb, wrap(async (req, res) => { const out = await svc.listMaintenance(req.query as Record<string, unknown>); res.json({ success: true, data: { records: out.items }, meta: out.meta }); }));
export default r;
