import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { expenseCreateSchema, expenseUpdateSchema } from "./finance.validation";
import * as svc from "./finance.service";

/**
 * Expenses (§12) under /api/v1/expenses. Admin + Accountant only — salary and
 * expense detail is never exposed to other roles (matrix). DELETE exists but
 * the service refuses it with 409: finance records keep an audit trail.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const WRITE = ["admin", "accountant"] as const;

r.post("/", authenticate, authorize(...WRITE), validate(expenseCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { expense: await svc.createExpense(actor(req), req.body) } });
}));
r.get("/", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  const out = await svc.listExpenses(req.query as Record<string, unknown>);
  res.json({ success: true, data: { expenses: out.items }, meta: out.meta });
}));
r.patch("/:id", authenticate, authorize(...WRITE), validate(expenseUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { expense: await svc.updateExpense(req.params.id, req.body) } });
}));
r.delete("/:id", authenticate, authorize(...WRITE), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteExpense(req.params.id) });
}));

export default r;
