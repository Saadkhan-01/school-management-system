import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { nextReceiptNumber } from "../../utils/financeNumbers";
import { type Actor } from "../academic-scope";
import { assertInvoiceVisible, invoiceStudentScope, mustInvoice, recomputeInvoiceFromPayments } from "../fees/fee.service";
import { Payment, Receipt, PaymentReversal, PaymentWebhookEvent, type IPayment } from "./payment.model";
import { paymentProvider } from "./payment-provider";
import { notify } from "../notifications/notification.service";
import { logActivity } from "../audit/audit.service";

/**
 * Payments service (§12). The verification state machine:
 *   pending-verification ──verify──▶ verified ──reverse──▶ reversed
 *   pending-verification ──reject──▶ rejected (invoice untouched)
 * "refunded" is reserved for a future gateway-refund flow; manual refunds
 * use reversal so the audit trail (PaymentReversal + voided receipt) is kept.
 * amountPaid on the invoice is ALWAYS recomputed from the verified set after
 * a transition — never incremented by hand (§40 rules 8/9).
 */

const PAYMENT_POPULATE = [
  { path: "invoice", select: "invoiceNumber totalDue amountPaid status dueDate" },
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "submittedBy", select: "name email role" },
  { path: "verifiedBy", select: "name email role" },
];
const RECEIPT_POPULATE = [
  { path: "invoice", select: "invoiceNumber totalDue" },
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "payment", select: "method status reference" },
  { path: "issuedBy", select: "name email role" },
];

async function mustPayment(id: string): Promise<IPayment> {
  requireObjectId(id, "Payment");
  const p = await Payment.findById(id);
  if (!p) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  return p;
}

/**
 * Submit a manual/offline payment against an invoice (§12 manual flow).
 * Parent: own child's invoice only (verified link, via assertInvoiceVisible).
 * Rules: invoice not cancelled; amount ≤ outstanding balance (422
 * OVERPAYMENT); a partial amount is accepted ONLY when the invoice's fee
 * structure allows partial payments (422 PARTIAL_NOT_ALLOWED) — paying the
 * full balance is always allowed.
 */
export async function submitManualPayment(actor: Actor, input: { invoiceId: string; amount: number; method: "manual" | "cash" | "bank-transfer"; reference?: string; proofFileName?: string; proofUrl?: string; note?: string }) {
  const invoice = await mustInvoice(input.invoiceId);
  await assertInvoiceVisible(actor, invoice);
  if (invoice.status === "cancelled") throw new AppError(409, "INVOICE_CANCELLED", "This invoice is cancelled and cannot accept payments");
  const fresh = await recomputeInvoiceFromPayments(invoice.id);
  const balance = fresh.totalDue - fresh.amountPaid;
  if (balance <= 0) throw new AppError(409, "INVOICE_ALREADY_PAID", "This invoice is already fully paid");
  if (input.amount > balance) {
    throw new AppError(422, "OVERPAYMENT", `Payment amount (${input.amount} minor units) exceeds the outstanding balance (${balance} minor units)`);
  }
  if (input.amount < balance && !fresh.partialPaymentsAllowed) {
    throw new AppError(422, "PARTIAL_NOT_ALLOWED", "Partial payments are not allowed for this fee structure. Please pay the full outstanding balance.");
  }
  const doc = await Payment.create({
    invoice: invoice._id,
    student: invoice.student,
    amount: input.amount,
    method: input.method,
    status: "pending-verification",
    submittedBy: actor.id,
    reference: input.reference,
    proofFileName: input.proofFileName,
    proofUrl: input.proofUrl,
    note: input.note,
  });
  return Payment.findById(doc._id).populate(PAYMENT_POPULATE).lean();
}

export async function listPayments(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (actor.role === "parent" || actor.role === "student") {
    const scope = await invoiceStudentScope(actor, typeof query.studentId === "string" ? query.studentId : undefined);
    filter.student = scope.studentIds && scope.studentIds.length === 1 ? scope.studentIds[0] : { $in: scope.studentIds ?? [] };
  } else if (typeof query.studentId === "string" && query.studentId) {
    filter.student = query.studentId;
  }
  if (typeof query.invoiceId === "string" && query.invoiceId) filter.invoice = query.invoiceId;
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.method === "string" && query.method) filter.method = query.method;
  const [items, total] = await Promise.all([
    Payment.find(filter).populate(PAYMENT_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getPayment(actor: Actor, id: string) {
  const p = await mustPayment(id);
  await assertInvoiceVisible(actor, { student: p.student });
  return Payment.findById(p._id).populate(PAYMENT_POPULATE).lean();
}

async function createReceiptWithRetry(payment: IPayment, issuedBy: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Receipt.create({
        receiptNumber: await nextReceiptNumber(),
        payment: payment._id,
        invoice: payment.invoice,
        student: payment.student,
        amount: payment.amount,
        method: payment.method,
        status: "active",
        issuedBy,
        issuedAt: new Date(),
      });
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        const existing = await Receipt.findOne({ payment: payment._id }).lean();
        if (existing) return existing; // a receipt already exists — never duplicate
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new AppError(409, "RECEIPT_NUMBER_CONFLICT", "Could not allocate a unique receipt number after retries");
}

/**
 * Verify a pending manual payment (Accountant/Admin): creates the ONE
 * receipt for the payment and recomputes the invoice from verified payments.
 * Idempotent: verifying an already-verified payment → 409 ALREADY_VERIFIED
 * (and the unique Receipt.payment index makes a duplicate receipt
 * impossible even under a race).
 */
export async function verifyPayment(actor: Actor, id: string) {
  const payment = await mustPayment(id);
  if (payment.status === "verified") throw new AppError(409, "ALREADY_VERIFIED", "This payment has already been verified — verification is idempotent and cannot create a second receipt");
  if (payment.status !== "pending-verification") throw new AppError(409, "PAYMENT_NOT_PENDING", `A payment in status "${payment.status}" cannot be verified`);
  const invoice = await mustInvoice(String(payment.invoice));
  if (invoice.status === "cancelled") throw new AppError(409, "INVOICE_CANCELLED", "The invoice for this payment is cancelled; reject the payment instead");
  payment.status = "verified";
  payment.verifiedBy = actor.id as never;
  payment.verifiedAt = new Date();
  await payment.save();
  const receipt = await createReceiptWithRetry(payment, actor.id);
  const updatedInvoice = await recomputeInvoiceFromPayments(String(payment.invoice));
  // Phase 9 hooks (§24/§33): notify the submitting parent + audit-log the
  // verification. Both helpers never throw.
  await notify({
    userIds: [String(payment.submittedBy)], type: "payment-verified", title: "Payment verified",
    body: `Your payment of ${payment.amount} minor units for invoice ${updatedInvoice.invoiceNumber} has been verified. Receipt ${receipt.receiptNumber} is available.`,
    related: { kind: "payment", id: String(payment._id) }, createdBy: actor.id,
  });
  await logActivity({ actor, action: "payment.verify", entityKind: "payment", entityId: String(payment._id), summary: `Verified payment for invoice ${updatedInvoice.invoiceNumber}`, metadata: { amount: payment.amount, invoiceId: String(payment.invoice), receiptNumber: receipt.receiptNumber } });
  return {
    payment: await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean(),
    receipt,
    invoice: { id: String(updatedInvoice._id), invoiceNumber: updatedInvoice.invoiceNumber, totalDue: updatedInvoice.totalDue, amountPaid: updatedInvoice.amountPaid, balance: updatedInvoice.totalDue - updatedInvoice.amountPaid, status: updatedInvoice.status },
  };
}

/** Reject a pending payment — reason required; the invoice is NOT touched. */
export async function rejectPayment(actor: Actor, id: string, reason: string) {
  const payment = await mustPayment(id);
  if (payment.status === "verified") throw new AppError(409, "ALREADY_VERIFIED", "A verified payment cannot be rejected; reverse it instead so the audit trail is preserved");
  if (payment.status !== "pending-verification") throw new AppError(409, "PAYMENT_NOT_PENDING", `A payment in status "${payment.status}" cannot be rejected`);
  payment.status = "rejected";
  payment.rejectionReason = reason;
  payment.rejectedBy = actor.id as never;
  payment.rejectedAt = new Date();
  await payment.save();
  const rejected = await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean();
  // Phase 9 hooks (§24/§33): notify the submitting parent + audit-log. Never throw.
  await notify({
    userIds: [String(payment.submittedBy)], type: "payment-rejected", title: "Payment could not be verified",
    body: `Your payment submission of ${payment.amount} minor units was rejected. Reason: ${reason}`,
    related: { kind: "payment", id: String(payment._id) }, createdBy: actor.id,
  });
  await logActivity({ actor, action: "payment.reject", entityKind: "payment", entityId: String(payment._id), summary: "Rejected a pending manual payment", metadata: { amount: payment.amount, invoiceId: String(payment.invoice), reason } });
  return rejected;
}

/**
 * Reverse a verified payment (§12: refunds/reversals are NEW records, the
 * original is never deleted). Creates the PaymentReversal audit record,
 * voids the receipt, flips the payment to "reversed" and recomputes the
 * invoice — its balance reopens automatically.
 */
export async function reversePayment(actor: Actor, id: string, reason: string) {
  const payment = await mustPayment(id);
  if (payment.status === "reversed") throw new AppError(409, "ALREADY_REVERSED", "This payment has already been reversed");
  if (payment.status !== "verified") throw new AppError(409, "PAYMENT_NOT_VERIFIED", "Only a verified payment can be reversed");
  const reversal = await PaymentReversal.create({
    payment: payment._id, invoice: payment.invoice, amount: payment.amount, reason, reversedBy: actor.id,
  });
  await Receipt.findOneAndUpdate({ payment: payment._id }, { $set: { status: "void", voidReason: reason } });
  payment.status = "reversed";
  payment.reversalReason = reason;
  payment.reversedBy = actor.id as never;
  payment.reversedAt = new Date();
  await payment.save();
  const updatedInvoice = await recomputeInvoiceFromPayments(String(payment.invoice));
  await logActivity({ actor, action: "payment.reverse", entityKind: "payment", entityId: String(payment._id), summary: `Reversed a verified payment for invoice ${updatedInvoice.invoiceNumber}`, metadata: { amount: payment.amount, invoiceId: String(payment.invoice), reason } });
  return {
    payment: await Payment.findById(payment._id).populate(PAYMENT_POPULATE).lean(),
    reversal,
    invoice: { id: String(updatedInvoice._id), invoiceNumber: updatedInvoice.invoiceNumber, totalDue: updatedInvoice.totalDue, amountPaid: updatedInvoice.amountPaid, balance: updatedInvoice.totalDue - updatedInvoice.amountPaid, status: updatedInvoice.status },
  };
}

/* ---------------- Receipts ---------------- */

export async function listReceipts(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (actor.role === "parent" || actor.role === "student") {
    const scope = await invoiceStudentScope(actor, typeof query.studentId === "string" ? query.studentId : undefined);
    filter.student = scope.studentIds && scope.studentIds.length === 1 ? scope.studentIds[0] : { $in: scope.studentIds ?? [] };
  } else if (typeof query.studentId === "string" && query.studentId) {
    filter.student = query.studentId;
  }
  if (typeof query.invoiceId === "string" && query.invoiceId) filter.invoice = query.invoiceId;
  const [items, total] = await Promise.all([
    Receipt.find(filter).populate(RECEIPT_POPULATE).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Receipt.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

/** Receipt data for the PDF — receipts exist only for verified payments (§29). */
export async function getReceiptData(actor: Actor, id: string) {
  requireObjectId(id, "Receipt");
  const receipt = await Receipt.findById(id)
    .populate({ path: "invoice", select: "invoiceNumber totalDue amountPaid dueDate periodLabel" })
    .populate({ path: "student", select: "admissionNumber firstName lastName" })
    .populate({ path: "payment", select: "method status reference verifiedAt" })
    .populate({ path: "issuedBy", select: "name email role" })
    .lean();
  if (!receipt) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  await assertInvoiceVisible(actor, { student: receipt.student });
  return receipt as unknown as Record<string, unknown> & { receiptNumber: string };
}

/* ---------------- Online payments — structure only, never faked ---------------- */

/**
 * Online checkout. The provider check runs BEFORE any DB access: while the
 * gateway is unconfigured this throws 503 PAYMENT_GATEWAY_NOT_CONFIGURED
 * (probeable without a database). When a real adapter is implemented, this
 * creates a gateway checkout session and records a PENDING online payment —
 * it still must not mark anything paid; only the verified webhook does that.
 */
export async function createOnlineCheckout(actor: Actor, invoiceId: string) {
  if (!paymentProvider.configured) {
    // Throws 503 PAYMENT_GATEWAY_NOT_CONFIGURED with setup guidance.
    await paymentProvider.createCheckoutSession({ invoiceId, invoiceNumber: "", amountMinor: 0, studentId: "" });
  }
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, "DB_UNAVAILABLE", "Database is not connected. Configure MONGODB_URI (MongoDB Atlas) — see backend/.env.example");
  }
  const invoice = await mustInvoice(invoiceId);
  await assertInvoiceVisible(actor, invoice);
  const balance = invoice.totalDue - invoice.amountPaid;
  if (balance <= 0) throw new AppError(409, "INVOICE_ALREADY_PAID", "This invoice is already fully paid");
  const session = await paymentProvider.createCheckoutSession({
    invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, amountMinor: balance, studentId: String(invoice.student),
  });
  return { ...session, invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, amountMinor: balance, note: "Complete payment on the provider's hosted page. The invoice is marked paid only after the provider's signed webhook is verified server-side." };
}

/**
 * Webhook intake. NEVER marks anything paid in the unconfigured state:
 * no webhook secret → 503; provider incomplete → 503; bad signature → 401.
 * With a fully configured provider, deliveries are recorded idempotently in
 * paymentWebhookEvents (unique provider+eventId); a real adapter then maps a
 * verified event to a verified online Payment. This structure build records
 * the event and reports processed:false rather than faking a payment.
 */
export async function handleWebhook(rawBody: string, signature: string | undefined) {
  const verification = paymentProvider.verifyWebhook(rawBody, signature);
  if (!verification.ok) throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature verification failed — delivery rejected");
  if (!verification.eventId) throw new AppError(422, "WEBHOOK_EVENT_ID_MISSING", "Webhook payload carries no event id; idempotent processing is impossible, delivery rejected");
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, "DB_UNAVAILABLE", "Database is not connected. Configure MONGODB_URI (MongoDB Atlas) — see backend/.env.example");
  }
  const existing = await PaymentWebhookEvent.findOne({ provider: paymentProvider.name, eventId: verification.eventId }).lean();
  if (existing) return { received: true, duplicate: true, processed: existing.processed, note: "This event was already recorded; duplicate deliveries are acknowledged but never processed twice." };
  await PaymentWebhookEvent.create({
    provider: paymentProvider.name,
    eventId: verification.eventId,
    eventType: verification.eventType,
    payloadHash: verification.payloadHash,
    processed: false,
    note: "Recorded by the Phase 7 structure build. No real provider adapter is configured, so this event does not create or verify any payment.",
  });
  return { received: true, duplicate: false, processed: false, note: "Event recorded for idempotency. No payment was created or marked paid — a real provider adapter is required for that step." };
}
