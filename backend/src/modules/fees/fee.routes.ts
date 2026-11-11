import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import {
  feeStructureCreateSchema, feeStructureUpdateSchema,
  scholarshipCreateSchema, scholarshipUpdateSchema,
} from "./fee.validation";
import * as svc from "./fee.service";

/**
 * Fee structures + scholarships (§12) under /api/v1/fees.
 * Writes: Admin + Accountant (permissions matrix: Fees/invoices ● for both).
 * Reads: Admin + Accountant full, Principal overview (read-only).
 * Route order everywhere: authenticate → authorize → validate → requireDb.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const WRITE = ["admin", "accountant"] as const;
const READ = ["admin", "accountant", "principal"] as const;

r.get("/reference-data", authenticate, authorize(...READ), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: await svc.financeReferenceData() });
}));
r.get("/student-lookup", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { students: await svc.financeStudentLookup(String(req.query.search ?? "")) } });
}));

r.post("/structures", authenticate, authorize(...WRITE), validate(feeStructureCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { feeStructure: await svc.createFeeStructure(actor(req), req.body) } });
}));
r.get("/structures", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listFeeStructures(req.query as Record<string, unknown>);
  res.json({ success: true, data: { feeStructures: out.items }, meta: out.meta });
}));
r.get("/structures/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { feeStructure: await svc.getFeeStructure(req.params.id) } });
}));
r.patch("/structures/:id", authenticate, authorize(...WRITE), validate(feeStructureUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { feeStructure: await svc.updateFeeStructure(req.params.id, req.body) } });
}));
r.delete("/structures/:id", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteFeeStructure(req.params.id) });
}));

r.post("/scholarships", authenticate, authorize(...WRITE), validate(scholarshipCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { scholarship: await svc.createScholarship(actor(req), req.body) } });
}));
r.get("/scholarships", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listScholarships(req.query as Record<string, unknown>);
  res.json({ success: true, data: { scholarships: out.items }, meta: out.meta });
}));
r.patch("/scholarships/:id", authenticate, authorize(...WRITE), validate(scholarshipUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { scholarship: await svc.updateScholarship(req.params.id, req.body) } });
}));

export default r;
