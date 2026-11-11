
import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import * as v from "./library.validation";
import * as svc from "./library.service";
/** Library (§14) under /api/v1/library. Writes: Librarian + Admin (matrix: Library ●). Catalogue: all borrow-view roles, availability counts only. Route order: authenticate → authorize → validate → requireDb. */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const WRITE = ["admin", "librarian"] as const;
const CATALOGUE = ["admin", "librarian", "principal", "teacher", "student", "parent"] as const;

r.get("/catalogue", authenticate, authorize(...CATALOGUE), requireDb, wrap(async (req, res) => { const out = await svc.catalogue(req.query as Record<string, unknown>); res.json({ success: true, data: { catalogue: out.items }, meta: out.meta }); }));
r.get("/reports/summary", authenticate, authorize("admin", "librarian", "principal"), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: await svc.reportSummary() }); }));
r.get("/categories", authenticate, authorize(...WRITE, "principal"), requireDb, wrap(async (_req, res) => { res.json({ success: true, data: { categories: await svc.listCategories() } }); }));
r.post("/categories", authenticate, authorize(...WRITE), validate(v.categoryCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { category: await svc.createCategory(req.body) } }); }));
r.patch("/categories/:id", authenticate, authorize(...WRITE), validate(v.categoryUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { category: await svc.updateCategory(req.params.id, req.body) } }); }));
r.post("/books", authenticate, authorize(...WRITE), validate(v.bookCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { book: await svc.createBook(req.body) } }); }));
r.get("/books", authenticate, authorize(...WRITE, "principal"), requireDb, wrap(async (req, res) => { const out = await svc.listBooks(req.query as Record<string, unknown>); res.json({ success: true, data: { books: out.items }, meta: out.meta }); }));
r.patch("/books/:id", authenticate, authorize(...WRITE), validate(v.bookUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { book: await svc.updateBook(req.params.id, req.body) } }); }));
r.post("/copies", authenticate, authorize(...WRITE), validate(v.copyCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { copy: await svc.createCopy(req.body) } }); }));
r.get("/copies", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => { const out = await svc.listCopies(req.query as Record<string, unknown>); res.json({ success: true, data: { copies: out.items }, meta: out.meta }); }));
r.patch("/copies/:id", authenticate, authorize(...WRITE), validate(v.copyUpdateSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { copy: await svc.updateCopy(req.params.id, req.body) } }); }));
r.post("/issues", authenticate, authorize(...WRITE), validate(v.issueCreateSchema), requireDb, wrap(async (req, res) => { res.status(201).json({ success: true, data: { issue: await svc.issueBook(actor(req), req.body) } }); }));
r.post("/issues/:id/return", authenticate, authorize(...WRITE), validate(v.returnSchema), requireDb, wrap(async (req, res) => { res.json({ success: true, data: { issue: await svc.returnBook(req.body, req.params.id) } }); }));
r.get("/issues", authenticate, authorize("admin", "librarian", "principal", "student", "parent"), requireDb, wrap(async (req, res) => { const out = await svc.listIssues(actor(req), req.query as Record<string, unknown>); res.json({ success: true, data: { issues: out.items }, meta: out.meta }); }));
r.get("/overdue", authenticate, authorize(...WRITE, "principal"), requireDb, wrap(async (req, res) => { const out = await svc.listIssues(actor(req), { ...req.query, overdue: "true" }); res.json({ success: true, data: { issues: out.items }, meta: out.meta }); }));
export default r;
