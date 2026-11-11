
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./inventory.validation";
import * as svc from "./inventory.service";
/** Inventory (§22) under /api/v1/inventory. Writes: Admin (matrix ●). Reads: Admin + Accountant (fees view ◐) + Principal overview. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const READ = ["admin", "accountant", "principal"] as const;
r.get("/low-stock", authenticate, authorize(...READ), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: { items: await svc.lowStock() } }); }));
r.get("/categories", authenticate, authorize(...READ), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: { categories: await svc.listCategories() } }); }));
r.post("/categories", authenticate, authorize("admin"), validate(v.categoryCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { category: await svc.createCategory(req.body) } }); }));
r.patch("/categories/:id", authenticate, authorize("admin"), validate(v.categoryUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { category: await svc.updateCategory(req.params.id, req.body) } }); }));
r.get("/suppliers", authenticate, authorize(...READ), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: { suppliers: await svc.listSuppliers() } }); }));
r.post("/suppliers", authenticate, authorize("admin"), validate(v.supplierCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { supplier: await svc.createSupplier(req.body) } }); }));
r.patch("/suppliers/:id", authenticate, authorize("admin"), validate(v.supplierUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { supplier: await svc.updateSupplier(req.params.id, req.body) } }); }));
r.post("/items", authenticate, authorize("admin"), validate(v.itemCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { item: await svc.createItem(req.body) } }); }));
r.get("/items", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listItems(req.query as Record<string, unknown>); res.json({ success: true, data: { items: out.items }, meta: out.meta }); }));
r.patch("/items/:id", authenticate, authorize("admin"), validate(v.itemUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { item: await svc.updateItem(req.params.id, req.body) } }); }));
r.post("/transactions", authenticate, authorize("admin"), validate(v.transactionCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { transaction: await svc.recordTransaction(actor(req), req.body) } }); }));
r.get("/transactions", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => { const out = await svc.listTransactions(req.query as Record<string, unknown>); res.json({ success: true, data: { transactions: out.items }, meta: out.meta }); }));
export default r;
