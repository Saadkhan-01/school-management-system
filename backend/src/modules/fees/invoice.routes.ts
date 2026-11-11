import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import {
  invoiceGenerateSchema, invoiceBulkSchema, invoiceAdjustmentSchema, invoiceCancelSchema,
} from "./fee.validation";
import * as svc from "./fee.service";
import { renderChallanPdf } from "./invoicePdf";

/**
 * Invoices / challans (§12) under /api/v1/invoices.
 * Generation/adjustments/cancel: Admin + Accountant. Reads are scoped in the
 * service: Admin/Accountant/Principal full, Student own, Parent
 * verified-linked children only (403 otherwise — anti-IDOR, §4).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const WRITE = ["admin", "accountant"] as const;
const READ = ["admin", "accountant", "principal", "student", "parent"] as const;

r.post("/", authenticate, authorize(...WRITE), validate(invoiceGenerateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { invoice: await svc.generateInvoice(actor(req), req.body) } });
}));
r.post("/bulk", authenticate, authorize(...WRITE), validate(invoiceBulkSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.bulkGenerateInvoices(actor(req), req.body) });
}));
r.get("/", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listInvoices(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { invoices: out.items }, meta: out.meta });
}));
r.get("/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { invoice: await svc.getInvoice(actor(req), req.params.id) } });
}));
r.get("/:id/challan-pdf", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const data = await svc.getChallanData(actor(req), req.params.id);
  const doc = renderChallanPdf(data);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="challan-${data.invoiceNumber}.pdf"`);
  doc.pipe(res);
}));
r.post("/:id/adjustments", authenticate, authorize(...WRITE), validate(invoiceAdjustmentSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { invoice: await svc.addAdjustment(actor(req), req.params.id, req.body) } });
}));
r.post("/:id/apply-late-fee", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { invoice: await svc.applyLateFee(actor(req), req.params.id) } });
}));
r.post("/:id/cancel", authenticate, authorize(...WRITE), validate(invoiceCancelSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { invoice: await svc.cancelInvoice(actor(req), req.params.id, req.body.reason) } });
}));

export default r;
