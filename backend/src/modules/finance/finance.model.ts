import mongoose, { Schema, type Document } from "mongoose";

/**
 * Finance records (§12 Finance & expenses, §29 expenses) — Phase 7.
 * Money convention: integer minor units (see fee.model.ts).
 * Expenses and other income are operational records with a full audit trail
 * (recordedBy + timestamps). They are never hard-deleted once created in a
 * way that would rewrite history: DELETE is refused with 409 by the service
 * — corrections are made by editing with a note, and verified-fee income is
 * represented by Payments/Receipts, never by these collections.
 * "Other income" = non-fee income (donations, rentals, misc). Fee income is
 * NOT duplicated here: the finance summary counts verified Payments as fee
 * income (documented rule in finance.service.ts).
 */

export const EXPENSE_CATEGORIES = [
  "salaries", "utilities", "maintenance", "supplies", "transport", "food",
  "events", "technology", "rent", "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const INCOME_CATEGORIES = ["donation", "rental", "sale", "grant", "other"] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export const FINANCE_METHODS = ["cash", "bank-transfer", "cheque", "online", "other"] as const;
export type FinanceMethod = (typeof FINANCE_METHODS)[number];

export interface IExpense extends Document {
  category: ExpenseCategory;
  amount: number;
  date: Date;
  payee: string;
  method: FinanceMethod;
  note?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const expenseSchema = new Schema<IExpense>({
  category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
  amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
  date: { type: Date, required: true, index: true },
  payee: { type: String, required: true, trim: true, maxlength: 200 },
  method: { type: String, enum: FINANCE_METHODS, required: true, default: "cash" },
  note: { type: String, trim: true, maxlength: 1000 },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const Expense = (mongoose.models.Expense as mongoose.Model<IExpense>) || mongoose.model<IExpense>("Expense", expenseSchema);

export interface IOtherIncome extends Document {
  category: IncomeCategory;
  amount: number;
  date: Date;
  source: string;
  method: FinanceMethod;
  note?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const incomeSchema = new Schema<IOtherIncome>({
  category: { type: String, enum: INCOME_CATEGORIES, required: true, index: true },
  amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
  date: { type: Date, required: true, index: true },
  source: { type: String, required: true, trim: true, maxlength: 200 },
  method: { type: String, enum: FINANCE_METHODS, required: true, default: "cash" },
  note: { type: String, trim: true, maxlength: 1000 },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const OtherIncome = (mongoose.models.OtherIncome as mongoose.Model<IOtherIncome>) || mongoose.model<IOtherIncome>("OtherIncome", incomeSchema);
