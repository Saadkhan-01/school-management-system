import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { type Actor } from "../academic-scope";
import { Expense, OtherIncome } from "./finance.model";
import { Invoice } from "../fees/fee.model";
import { Payment } from "../payments/payment.model";
import { PayrollRun } from "../payroll/payroll.model";

/**
 * Finance service (§12): expenses, other income, summaries, dashboards.
 *
 * INCOME RULE (documented, applied consistently): "fee income" in every
 * summary/dashboard = the sum of payments in status "verified" (by their
 * verifiedAt date). Pending-verification, rejected and reversed payments
 * never count as income. "Other income" = OtherIncome records. Expenses =
 * Expense records. Payroll is reported separately (paid runs only count as
 * an outflow in the payroll overview; salary expense categories in Expense
 * are operational entries and are NOT auto-created by payroll — no double
 * counting is invented).
 * Hard delete: refused (409) for every finance record — corrections edit the
 * record (updatedAt + recordedBy trail), verified money moves by reversal.
 */

/* ---------------- Expenses ---------------- */

export async function createExpense(actor: Actor, input: Record<string, unknown>) {
  const doc = await Expense.create({ ...definedOnly(input as Record<string, unknown>), recordedBy: actor.id });
  return Expense.findById(doc._id).populate({ path: "recordedBy", select: "name email role" }).lean();
}
export async function listExpenses(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.category === "string" && query.category) filter.category = query.category;
  if (typeof query.from === "string" && query.from) filter.date = { ...((filter.date as object) ?? {}), $gte: new Date(query.from) };
  if (typeof query.to === "string" && query.to) filter.date = { ...((filter.date as object) ?? {}), $lte: new Date(query.to) };
  const [items, total] = await Promise.all([
    Expense.find(filter).populate({ path: "recordedBy", select: "name email role" }).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Expense.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function updateExpense(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Expense");
  const doc = await Expense.findByIdAndUpdate(id, { $set: definedOnly(input as Record<string, unknown>) }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  return Expense.findById(doc._id).populate({ path: "recordedBy", select: "name email role" }).lean();
}
export async function deleteExpense(id: string) {
  requireObjectId(id, "Expense");
  const doc = await Expense.findById(id).select("_id").lean();
  if (!doc) throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  throw new AppError(409, "FINANCE_RECORDS_NOT_DELETABLE", "Finance records are never hard-deleted (audit trail, §12). Correct the record by editing it, so the change history stays visible.");
}

/* ---------------- Other income ---------------- */

export async function createIncome(actor: Actor, input: Record<string, unknown>) {
  const doc = await OtherIncome.create({ ...definedOnly(input as Record<string, unknown>), recordedBy: actor.id });
  return OtherIncome.findById(doc._id).populate({ path: "recordedBy", select: "name email role" }).lean();
}
export async function listIncome(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.category === "string" && query.category) filter.category = query.category;
  if (typeof query.from === "string" && query.from) filter.date = { ...((filter.date as object) ?? {}), $gte: new Date(query.from) };
  if (typeof query.to === "string" && query.to) filter.date = { ...((filter.date as object) ?? {}), $lte: new Date(query.to) };
  const [items, total] = await Promise.all([
    OtherIncome.find(filter).populate({ path: "recordedBy", select: "name email role" }).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    OtherIncome.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function updateIncome(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Income record");
  const doc = await OtherIncome.findByIdAndUpdate(id, { $set: definedOnly(input as Record<string, unknown>) }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "INCOME_NOT_FOUND", "Income record not found");
  return OtherIncome.findById(doc._id).populate({ path: "recordedBy", select: "name email role" }).lean();
}
export async function deleteIncome(id: string) {
  requireObjectId(id, "Income record");
  const doc = await OtherIncome.findById(id).select("_id").lean();
  if (!doc) throw new AppError(404, "INCOME_NOT_FOUND", "Income record not found");
  throw new AppError(409, "FINANCE_RECORDS_NOT_DELETABLE", "Finance records are never hard-deleted (audit trail, §12). Correct the record by editing it instead.");
}

/* ---------------- Aggregates ---------------- */

async function sumVerifiedPayments(from?: Date, to?: Date): Promise<number> {
  const filter: Record<string, unknown> = { status: "verified" };
  if (from || to) {
    filter.verifiedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  const rows = await Payment.aggregate<{ _id: null; total: number }>([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total ?? 0;
}
async function sumModel(model: typeof Expense | typeof OtherIncome, from?: Date, to?: Date): Promise<number> {
  const filter: Record<string, unknown> = {};
  if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const rows = await (model as typeof Expense).aggregate<{ _id: null; total: number }>([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total ?? 0;
}

function periodBounds(kind: "day" | "month" | "year", now = new Date()) {
  const start = new Date(now);
  if (kind === "day") start.setHours(0, 0, 0, 0);
  if (kind === "month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  if (kind === "year") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  return { from: start, to: now };
}

/**
 * Income vs expense summary (§12/§27): daily / monthly / yearly windows plus
 * an optional explicit range. All figures are real aggregates (minor units).
 */
export async function financeSummary(query: { from?: Date; to?: Date }) {
  const windows = {
    daily: periodBounds("day"),
    monthly: periodBounds("month"),
    yearly: periodBounds("year"),
  } as const;
  const out: Record<string, unknown> = { generatedAt: new Date().toISOString(), moneyUnit: "minor (integer) — divide by 100 for major units" };
  for (const [key, w] of Object.entries(windows)) {
    const [feeIncome, otherIncome, expenses] = await Promise.all([
      sumVerifiedPayments(w.from, w.to), sumModel(OtherIncome, w.from, w.to), sumModel(Expense, w.from, w.to),
    ]);
    out[key] = { from: w.from, to: w.to, feeIncome, otherIncome, totalIncome: feeIncome + otherIncome, expenses, net: feeIncome + otherIncome - expenses };
  }
  if (query.from || query.to) {
    const [feeIncome, otherIncome, expenses] = await Promise.all([
      sumVerifiedPayments(query.from, query.to), sumModel(OtherIncome, query.from, query.to), sumModel(Expense, query.from, query.to),
    ]);
    out.range = { from: query.from ?? null, to: query.to ?? null, feeIncome, otherIncome, totalIncome: feeIncome + otherIncome, expenses, net: feeIncome + otherIncome - expenses };
  }
  out.incomeRule = "Fee income counts VERIFIED payments only (by verifiedAt). Pending/rejected/reversed payments never count as income.";
  return out;
}

/** Outstanding-fees aggregate shared by both dashboards (real invoice data; overdue computed from dueDate). */
async function outstandingFees() {
  const now = new Date();
  const open = await Invoice.find({ status: { $in: ["unpaid", "partially-paid", "overdue"] } }).select("totalDue amountPaid dueDate status").lean();
  let pendingTotal = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  for (const inv of open) {
    const balance = inv.totalDue - inv.amountPaid;
    if (balance <= 0) continue;
    pendingTotal += balance;
    if (inv.dueDate < now) { overdueCount++; overdueTotal += balance; }
  }
  return { pendingTotal, overdueCount, overdueTotal, openInvoices: open.length };
}

/**
 * Accountant dashboard (§12) — Phase 4 pattern: every figure is a real
 * aggregate over Phase 7 collections; nothing is hardcoded.
 */
export async function accountantDashboard() {
  const month = periodBounds("month");
  const [totalCollection, monthlyCollection, fees, awaitingVerification, expensesTotal, monthlyExpenses, otherIncomeTotal, payrollAgg] = await Promise.all([
    sumVerifiedPayments(),
    sumVerifiedPayments(month.from, month.to),
    outstandingFees(),
    Payment.countDocuments({ status: "pending-verification" }),
    sumModel(Expense),
    sumModel(Expense, month.from, month.to),
    sumModel(OtherIncome),
    PayrollRun.aggregate<{ _id: string; totalNet: number; count: number }>([
      { $group: { _id: "$status", totalNet: { $sum: "$net" }, count: { $sum: 1 } } },
    ]),
  ]);
  const payrollByStatus: Record<string, { count: number; totalNet: number }> = {};
  for (const row of payrollAgg) payrollByStatus[row._id] = { count: row.count, totalNet: row.totalNet };
  return {
    generatedAt: new Date().toISOString(),
    moneyUnit: "minor (integer)",
    collections: { total: totalCollection, thisMonth: monthlyCollection },
    fees: { pendingTotal: fees.pendingTotal, overdueCount: fees.overdueCount, overdueTotal: fees.overdueTotal, openInvoices: fees.openInvoices },
    manualPaymentsAwaitingVerification: awaitingVerification,
    expenses: { total: expensesTotal, thisMonth: monthlyExpenses },
    otherIncome: { total: otherIncomeTotal },
    payroll: {
      draftRuns: payrollByStatus.draft ?? { count: 0, totalNet: 0 },
      paidRuns: payrollByStatus.paid ?? { count: 0, totalNet: 0 },
      note: "Payroll figures aggregate PayrollRun records; salary structures are managed under /payroll.",
    },
  };
}

/** Principal fee overview (§8/§12): read-only collection summary — no expense detail, no salary data (matrix). */
export async function principalFeesOverview() {
  const month = periodBounds("month");
  const [totalCollection, monthlyCollection, fees] = await Promise.all([
    sumVerifiedPayments(), sumVerifiedPayments(month.from, month.to), outstandingFees(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    moneyUnit: "minor (integer)",
    collections: { total: totalCollection, thisMonth: monthlyCollection },
    fees: { pendingTotal: fees.pendingTotal, overdueCount: fees.overdueCount, overdueTotal: fees.overdueTotal, openInvoices: fees.openInvoices },
  };
}
