import mongoose, { Schema, type Document } from "mongoose";

/**
 * Fees & Invoices (§12, §29 feeStructures / invoices / scholarships) — Phase 7.
 *
 * MONEY CONVENTION (applies to ALL Phase 7 modules — fees, payments, finance,
 * payroll): every monetary amount is an INTEGER count of minor units
 * (e.g. 150000 means 1,500.00 in the school's currency). Floats are never
 * stored: Zod schemas require `.int()`, Mongoose schemas validate
 * `Number.isInteger`, and percentages are applied with integer arithmetic
 * (Math.floor on the computed minor-unit result). The frontend formats
 * minor units for display only (services/finance.ts `fmtMoney`).
 *
 * Invoice invariants (§29/§40):
 *  - invoiceNumber is unique: INV-<year>-<6-digit sequence> (see
 *    utils/financeNumbers.ts; the unique index is the real guard, creation
 *    retries on a duplicate key).
 *  - amountPaid is DERIVED from verified payments only — it is recomputed by
 *    recomputeInvoiceFromPayments() in fee.service.ts after every payment
 *    verification/reversal, never hand-edited and never set by a client.
 *  - balance = totalDue - amountPaid (computed on read; totalDue itself is
 *    recomputed server-side from the line-item snapshot and adjustments).
 *  - status "overdue" is COMPUTED (dueDate passed + balance > 0), never
 *    hand-set by a client; the stored status is refreshed by the service.
 *  - an invoice with verified payments can never be cancelled or deleted;
 *    verified financial records are never deleted at all (§40 rule 9).
 */

export interface FeeLineItem { label: string; amount: number }
export interface LateFeePolicy { type: "flat" | "percent"; value: number; graceDays: number }

export interface IFeeStructure extends Document {
  name: string;
  session: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;
  lineItems: FeeLineItem[];
  totalAmount: number;
  lateFeePolicy: LateFeePolicy;
  partialPaymentsAllowed: boolean;
  isActive: boolean;
  periodLabel?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<FeeLineItem>({
  label: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
}, { _id: false });

const feeStructureSchema = new Schema<IFeeStructure>({
  name: { type: String, required: true, trim: true, maxlength: 160, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", index: true },
  lineItems: { type: [lineItemSchema], required: true, validate: { validator: (v: FeeLineItem[]) => v.length > 0, message: "At least one line item is required" } },
  totalAmount: { type: Number, required: true, min: 0 },
  lateFeePolicy: {
    type: new Schema<LateFeePolicy>({
      type: { type: String, enum: ["flat", "percent"], required: true },
      value: { type: Number, required: true, min: 0 },
      graceDays: { type: Number, required: true, min: 0, max: 365 },
    }, { _id: false }),
    required: true,
    default: () => ({ type: "flat", value: 0, graceDays: 0 }),
  },
  partialPaymentsAllowed: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
  periodLabel: { type: String, trim: true, maxlength: 80 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const FeeStructure = (mongoose.models.FeeStructure as mongoose.Model<IFeeStructure>) || mongoose.model<IFeeStructure>("FeeStructure", feeStructureSchema);

/* ---------------- Scholarships / discounts (§12) ---------------- */

export const SCHOLARSHIP_TYPES = ["percent", "flat"] as const;
export type ScholarshipType = (typeof SCHOLARSHIP_TYPES)[number];

export interface IScholarship extends Document {
  student: mongoose.Types.ObjectId;
  session?: mongoose.Types.ObjectId;
  type: ScholarshipType;
  value: number;
  reason: string;
  isActive: boolean;
  approvedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const scholarshipSchema = new Schema<IScholarship>({
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", index: true },
  type: { type: String, enum: SCHOLARSHIP_TYPES, required: true },
  value: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  isActive: { type: Boolean, default: true, index: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const Scholarship = (mongoose.models.Scholarship as mongoose.Model<IScholarship>) || mongoose.model<IScholarship>("Scholarship", scholarshipSchema);

/* ---------------- Invoices ---------------- */

export const INVOICE_STATUSES = ["unpaid", "partially-paid", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const ADJUSTMENT_TYPES = ["discount", "scholarship", "late-fee", "charge"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export interface InvoiceAdjustment {
  label: string;
  amount: number; // always a positive magnitude in minor units; `type` carries the sign
  type: AdjustmentType;
  scholarship?: mongoose.Types.ObjectId;
  appliedBy: mongoose.Types.ObjectId;
  appliedAt: Date;
  note?: string;
}
export interface InvoiceHistoryEntry {
  at: Date;
  by?: mongoose.Types.ObjectId;
  action: string;
  detail?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  student: mongoose.Types.ObjectId;
  enrollment: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  feeStructure: mongoose.Types.ObjectId;
  periodLabel?: string;
  lineItems: FeeLineItem[];
  adjustments: InvoiceAdjustment[];
  subtotal: number;
  totalDue: number;
  amountPaid: number;
  dueDate: Date;
  status: InvoiceStatus;
  partialPaymentsAllowed: boolean;
  lateFeePolicy: LateFeePolicy;
  issuedBy: mongoose.Types.ObjectId;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  history: InvoiceHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const adjustmentSchema = new Schema<InvoiceAdjustment>({
  label: { type: String, required: true, trim: true, maxlength: 160 },
  amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
  type: { type: String, enum: ADJUSTMENT_TYPES, required: true },
  scholarship: { type: Schema.Types.ObjectId, ref: "Scholarship" },
  appliedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  appliedAt: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const historySchema = new Schema<InvoiceHistoryEntry>({
  at: { type: Date, required: true, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true, maxlength: 80 },
  detail: { type: String, maxlength: 1000 },
}, { _id: false });

const invoiceSchema = new Schema<IInvoice>({
  invoiceNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  feeStructure: { type: Schema.Types.ObjectId, ref: "FeeStructure", required: true, index: true },
  periodLabel: { type: String, trim: true, maxlength: 80 },
  lineItems: { type: [lineItemSchema], required: true },
  adjustments: { type: [adjustmentSchema], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  totalDue: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, required: true, min: 0, default: 0 },
  dueDate: { type: Date, required: true, index: true },
  status: { type: String, enum: INVOICE_STATUSES, default: "unpaid", index: true },
  partialPaymentsAllowed: { type: Boolean, default: false },
  lateFeePolicy: {
    type: new Schema<LateFeePolicy>({
      type: { type: String, enum: ["flat", "percent"], required: true },
      value: { type: Number, required: true, min: 0 },
      graceDays: { type: Number, required: true, min: 0, max: 365 },
    }, { _id: false }),
    required: true,
  },
  issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
  cancelledAt: { type: Date },
  cancelReason: { type: String, trim: true, maxlength: 500 },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });
// Bulk-generation guard (§12): one invoice per student per fee structure per period.
invoiceSchema.index(
  { student: 1, feeStructure: 1, periodLabel: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } }, name: "one_invoice_per_student_structure_period" },
);
export const Invoice = (mongoose.models.Invoice as mongoose.Model<IInvoice>) || mongoose.model<IInvoice>("Invoice", invoiceSchema);

/** Sign of an adjustment: discounts/scholarships reduce the bill; late fees and charges increase it. */
export function adjustmentSign(type: AdjustmentType): 1 | -1 {
  return type === "discount" || type === "scholarship" ? -1 : 1;
}

/** Pure total computation — the ONLY place invoice totals are derived. */
export function computeInvoiceTotals(lineItems: FeeLineItem[], adjustments: InvoiceAdjustment[]): { subtotal: number; totalDue: number } {
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const adj = adjustments.reduce((s, a) => s + adjustmentSign(a.type) * a.amount, 0);
  return { subtotal, totalDue: Math.max(0, subtotal + adj) };
}

/** Pure status computation — overdue is derived from dueDate + unpaid balance, never hand-set. */
export function computeInvoiceStatus(inv: { totalDue: number; amountPaid: number; dueDate: Date; status: InvoiceStatus }, now = new Date()): InvoiceStatus {
  if (inv.status === "cancelled") return "cancelled";
  const balance = inv.totalDue - inv.amountPaid;
  if (balance <= 0) return "paid";
  if (now.getTime() > inv.dueDate.getTime()) return "overdue";
  return inv.amountPaid > 0 ? "partially-paid" : "unpaid";
}
