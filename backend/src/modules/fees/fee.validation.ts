import { z } from "zod";
import { ADJUSTMENT_TYPES } from "./fee.model";
import { SCHOLARSHIP_TYPES } from "./fee.model";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Must be a valid id");
/** Money: integer minor units only (see fee.model.ts convention). Decimals are rejected with 422. */
const money = (min: number) => z.number({ invalid_type_error: "Amount must be a number of integer minor units" }).int("Amounts must be integer minor units (no decimals)").min(min, `Amount must be at least ${min} minor units`).max(1_000_000_000_000);

const lineItem = z.object({
  label: z.string().trim().min(1).max(120),
  amount: money(0),
});
const lateFeePolicy = z.object({
  type: z.enum(["flat", "percent"]),
  value: z.number().min(0).max(100000),
  graceDays: z.number().int().min(0).max(365),
}).refine((p) => p.type !== "percent" || p.value <= 100, { message: "A percent late fee cannot exceed 100" });

export const feeStructureCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sessionId: objectId,
  classId: objectId,
  sectionId: objectId.optional(),
  lineItems: z.array(lineItem).min(1).max(50),
  lateFeePolicy: lateFeePolicy.optional(),
  partialPaymentsAllowed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  periodLabel: z.string().trim().max(80).optional(),
});

export const feeStructureUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  sectionId: objectId.nullable().optional(),
  lineItems: z.array(lineItem).min(1).max(50).optional(),
  lateFeePolicy: lateFeePolicy.optional(),
  partialPaymentsAllowed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  periodLabel: z.string().trim().max(80).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const scholarshipCreateSchema = z.object({
  studentId: objectId,
  sessionId: objectId.optional(),
  type: z.enum(SCHOLARSHIP_TYPES),
  value: z.number().min(0).max(1_000_000_000),
  reason: z.string().trim().min(3).max(500),
  isActive: z.boolean().optional(),
}).refine((v) => v.type !== "percent" || v.value <= 100, { message: "A percent scholarship cannot exceed 100" })
  .refine((v) => Number.isInteger(v.value), { message: "Scholarship value must be an integer (percent points or minor units)" });

export const scholarshipUpdateSchema = z.object({
  value: z.number().min(0).max(1_000_000_000).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const invoiceGenerateSchema = z.object({
  studentId: objectId,
  feeStructureId: objectId,
  enrollmentId: objectId.optional(),
  dueDate: z.coerce.date(),
  periodLabel: z.string().trim().max(80).optional(),
});

export const invoiceBulkSchema = z.object({
  feeStructureId: objectId,
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  dueDate: z.coerce.date(),
  periodLabel: z.string().trim().max(80).optional(),
});

export const invoiceAdjustmentSchema = z.object({
  label: z.string().trim().min(2).max(160),
  amount: money(1),
  type: z.enum(ADJUSTMENT_TYPES),
  scholarshipId: objectId.optional(),
  note: z.string().trim().max(500).optional(),
});

export const invoiceCancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  sessionId: objectId.optional(),
  classId: objectId.optional(),
  sectionId: objectId.optional(),
  studentId: objectId.optional(),
  invoiceId: objectId.optional(),
}).passthrough();
