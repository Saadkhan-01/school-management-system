import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, FINANCE_METHODS } from "./finance.model";

const money = z.number({ invalid_type_error: "Amount must be a number of integer minor units" })
  .int("Amounts must be integer minor units (no decimals)").min(1, "Amount must be at least 1 minor unit").max(1_000_000_000_000);

export const expenseCreateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money,
  date: z.coerce.date(),
  payee: z.string().trim().min(2).max(200),
  method: z.enum(FINANCE_METHODS).optional(),
  note: z.string().trim().max(1000).optional(),
});
export const expenseUpdateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amount: money.optional(),
  date: z.coerce.date().optional(),
  payee: z.string().trim().min(2).max(200).optional(),
  method: z.enum(FINANCE_METHODS).optional(),
  note: z.string().trim().max(1000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const incomeCreateSchema = z.object({
  category: z.enum(INCOME_CATEGORIES),
  amount: money,
  date: z.coerce.date(),
  source: z.string().trim().min(2).max(200),
  method: z.enum(FINANCE_METHODS).optional(),
  note: z.string().trim().max(1000).optional(),
});
export const incomeUpdateSchema = z.object({
  category: z.enum(INCOME_CATEGORIES).optional(),
  amount: money.optional(),
  date: z.coerce.date().optional(),
  source: z.string().trim().min(2).max(200).optional(),
  method: z.enum(FINANCE_METHODS).optional(),
  note: z.string().trim().max(1000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const summaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).passthrough();
