import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { salaryStructureCreateSchema, salaryStructureUpdateSchema, payrollGenerateSchema, payrollMarkPaidSchema } from "./payroll.validation";
import * as svc from "./payroll.service";
import { renderPayslipPdf } from "./payslipPdf";

/**
 * HR & Payroll (§13) under /api/v1/payroll.
 * Salary structures + generation + mark-paid: Admin + Accountant ONLY —
 * Teachers, the Principal, Librarians and Receptionists get 403 at the
 * route layer (matrix: payroll ● admin/accountant; Principal ◐ summaries
 * via /finance/dashboard/principal, never salary detail).
 * Runs list + payslip PDF: managers see all; any other authenticated staff
 * role is force-scoped to their OWN runs in the service (403 for another
 * employee's payslip). Students/parents have no payroll access at all.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const MANAGE = ["admin", "accountant"] as const;
const OWN_READ = ["admin", "accountant", "principal", "teacher", "librarian", "receptionist"] as const;

r.get("/employees", authenticate, authorize(...MANAGE), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: await svc.payrollEmployees() });
}));
r.post("/structures", authenticate, authorize(...MANAGE), validate(salaryStructureCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { salaryStructure: await svc.createSalaryStructure(actor(req), req.body) } });
}));
r.get("/structures", authenticate, authorize(...MANAGE), requireDb, wrap(async (req, res) => {
  const out = await svc.listSalaryStructures(req.query as Record<string, unknown>);
  res.json({ success: true, data: { salaryStructures: out.items }, meta: out.meta });
}));
r.patch("/structures/:id", authenticate, authorize(...MANAGE), validate(salaryStructureUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { salaryStructure: await svc.updateSalaryStructure(req.params.id, req.body) } });
}));

r.post("/runs/generate", authenticate, authorize(...MANAGE), validate(payrollGenerateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: await svc.generatePayroll(actor(req), req.body) });
}));
r.get("/runs", authenticate, authorize(...OWN_READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listPayrollRuns(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { payrollRuns: out.items }, meta: out.meta });
}));
r.post("/runs/:id/mark-paid", authenticate, authorize(...MANAGE), validate(payrollMarkPaidSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { payrollRun: await svc.markRunPaid(actor(req), req.params.id, req.body.note) } });
}));
r.get("/runs/:id/payslip-pdf", authenticate, authorize(...OWN_READ), requireDb, wrap(async (req, res) => {
  const data = await svc.getPayslipData(actor(req), req.params.id);
  const doc = renderPayslipPdf(data);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="payslip-${data.year}-${String(data.month).padStart(2, "0")}.pdf"`);
  doc.pipe(res);
}));

export default r;
