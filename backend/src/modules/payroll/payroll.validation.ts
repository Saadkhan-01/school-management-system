import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
const money = z.number({ invalid_type_error: "Amount must be a number of integer minor units" })
  .int("Amounts must be integer minor units (no decimals)").min(0).max(1_000_000_000_000);
const component = z.object({ label: z.string().trim().min(1).max(120), amount: money });

export const salaryStructureCreateSchema = z.object({
  teacherId: objectId.optional(),
  staffId: objectId.optional(),
  baseSalary: money,
  allowances: z.array(component).max(30).optional(),
  deductions: z.array(component).max(30).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Boolean(v.teacherId) !== Boolean(v.staffId), { message: "Provide exactly one of teacherId or staffId" });

export const salaryStructureUpdateSchema = z.object({
  baseSalary: money.optional(),
  allowances: z.array(component).max(30).optional(),
  deductions: z.array(component).max(30).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const payrollGenerateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  note: z.string().trim().max(1000).optional(),
});

export const payrollMarkPaidSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});
