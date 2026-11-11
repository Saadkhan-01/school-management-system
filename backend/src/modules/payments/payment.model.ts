import mongoose, { Schema, type Document } from "mongoose";

/**
 * Payments, Receipts, Reversals, Webhook events (§12, §29) — Phase 7.
 * Money convention: integer minor units everywhere (see fee.model.ts).
 *
 * Integrity rules enforced here + in payment.service.ts:
 *  - A Payment NEVER marks an invoice paid by itself. Only a payment in
 *    status "verified" counts toward Invoice.amountPaid, and that figure is
 *    recomputed from the verified set after every verification / reversal.
 *  - Manual payments start as "pending-verification". Verification is
 *    idempotent: verifying an already-verified payment returns 409 — a
 *    second receipt can never be created (Receipt.payment is UNIQUE).
 *  - Verified payments are never deleted. A refund/reversal is a separate
 *    PaymentReversal record; the original payment keeps its history with
 *    status "reversed" and its receipt is voided, not removed (§40 rule 9).
 *  - PaymentWebhookEvent (provider, eventId) is UNIQUE — duplicate gateway
 *    deliveries are acknowledged but never processed twice (§12).
 *  - Proof is METADATA ONLY (reference text + file name/url strings):
 *    Cloudinary/S3 storage (§34) is not configured, so no file is uploaded
 *    or claimed to be stored anywhere.
 */

export const PAYMENT_METHODS = ["online", "manual", "cash", "bank-transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["pending-verification", "verified", "rejected", "refunded", "reversed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface IPayment extends Document {
  invoice: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  submittedBy: mongoose.Types.ObjectId;
  reference?: string;
  proofFileName?: string;
  proofUrl?: string;
  note?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  gatewayProvider?: string;
  gatewayRef?: string;
  reversalReason?: string;
  reversedBy?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const paymentSchema = new Schema<IPayment>({
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Amounts must be integer minor units" } },
  method: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
  status: { type: String, enum: PAYMENT_STATUSES, default: "pending-verification", index: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reference: { type: String, trim: true, maxlength: 200 },
  proofFileName: { type: String, trim: true, maxlength: 300 },
  proofUrl: { type: String, trim: true, maxlength: 1000 },
  note: { type: String, trim: true, maxlength: 1000 },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  verifiedAt: { type: Date },
  rejectionReason: { type: String, trim: true, maxlength: 1000 },
  rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
  rejectedAt: { type: Date },
  gatewayProvider: { type: String, trim: true, maxlength: 80 },
  gatewayRef: { type: String, trim: true, maxlength: 200 },
  reversalReason: { type: String, trim: true, maxlength: 1000 },
  reversedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reversedAt: { type: Date },
}, { timestamps: true });
export const Payment = (mongoose.models.Payment as mongoose.Model<IPayment>) || mongoose.model<IPayment>("Payment", paymentSchema);

/* ---------------- Receipts — generated ONLY on verification ---------------- */

export const RECEIPT_STATUSES = ["active", "void"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export interface IReceipt extends Document {
  receiptNumber: string;
  payment: mongoose.Types.ObjectId;
  invoice: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  status: ReceiptStatus;
  issuedBy: mongoose.Types.ObjectId;
  issuedAt: Date;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
const receiptSchema = new Schema<IReceipt>({
  receiptNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
  payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true, unique: true, index: true },
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: PAYMENT_METHODS, required: true },
  status: { type: String, enum: RECEIPT_STATUSES, default: "active", index: true },
  issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  issuedAt: { type: Date, required: true, default: Date.now },
  voidReason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });
export const Receipt = (mongoose.models.Receipt as mongoose.Model<IReceipt>) || mongoose.model<IReceipt>("Receipt", receiptSchema);

/* ---------------- Reversals — the audit record behind a reversed payment ---------------- */

export interface IPaymentReversal extends Document {
  payment: mongoose.Types.ObjectId;
  invoice: mongoose.Types.ObjectId;
  amount: number;
  reason: string;
  reversedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const reversalSchema = new Schema<IPaymentReversal>({
  payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true, unique: true, index: true },
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  reversedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
export const PaymentReversal = (mongoose.models.PaymentReversal as mongoose.Model<IPaymentReversal>) || mongoose.model<IPaymentReversal>("PaymentReversal", reversalSchema);

/* ---------------- Gateway webhook events — idempotency log (§12) ---------------- */

export interface IPaymentWebhookEvent extends Document {
  provider: string;
  eventId: string;
  eventType?: string;
  payloadHash: string;
  processed: boolean;
  note?: string;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const webhookSchema = new Schema<IPaymentWebhookEvent>({
  provider: { type: String, required: true, trim: true, maxlength: 80 },
  eventId: { type: String, required: true, trim: true, maxlength: 300 },
  eventType: { type: String, trim: true, maxlength: 120 },
  payloadHash: { type: String, required: true, maxlength: 128 },
  processed: { type: Boolean, default: false },
  note: { type: String, trim: true, maxlength: 1000 },
  receivedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });
webhookSchema.index({ provider: 1, eventId: 1 }, { unique: true, name: "one_event_per_provider_event_id" });
export const PaymentWebhookEvent = (mongoose.models.PaymentWebhookEvent as mongoose.Model<IPaymentWebhookEvent>) || mongoose.model<IPaymentWebhookEvent>("PaymentWebhookEvent", webhookSchema);
