import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { incomeCreateSchema, incomeUpdateSchema, summaryQuerySchema } from "./finance.validation";
import * as svc from "./finance.service";

/**
 * Finance (§12) under /api/v1/finance: summary, other income, dashboards.
 * Expenses live under /api/v1/expenses (expense.routes.ts, same module).
 * Access: Admin + Accountant full; Principal gets the fee-overview dashboard
 * ONLY (matrix: expenses/payroll summaries ◐, fees overview ◐) — expense and
 * income record endpoints stay 403 for Principal.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const WRITE = ["admin", "accountant"] as const;

r.get("/summary", authenticate, authorize(...WRITE, "principal"), validate(summaryQuerySchema, "query"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { summary: await svc.financeSummary(req.query as { from?: Date; to?: Date }) } });
}));
r.get("/dashboard/accountant", authenticate, authorize("accountant", "admin"), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: { stats: await svc.accountantDashboard() } });
}));
r.get("/dashboard/principal", authenticate, authorize("principal", "admin"), requireDb, wrap(async (_req, res) => {
  res.json({ success: true, data: { stats: await svc.principalFeesOverview() } });
}));

r.post("/income", authenticate, authorize(...WRITE), validate(incomeCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { income: await svc.createIncome(actor(req), req.body) } });
}));
r.get("/income", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  const out = await svc.listIncome(req.query as Record<string, unknown>);
  res.json({ success: true, data: { income: out.items }, meta: out.meta });
}));
r.patch("/income/:id", authenticate, authorize(...WRITE), validate(incomeUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { income: await svc.updateIncome(req.params.id, req.body) } });
}));
r.delete("/income/:id", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteIncome(req.params.id) });
}));

export default r;
