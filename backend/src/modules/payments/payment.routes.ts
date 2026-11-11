import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { manualPaymentSchema, rejectPaymentSchema, reversePaymentSchema, checkoutSchema } from "./payment.validation";
import * as svc from "./payment.service";
import { renderReceiptPdf } from "./receiptPdf";

/**
 * Payments & receipts (§12) under /api/v1/payments.
 *  - Submit manual payment: Parent (own child's invoice, service-scoped),
 *    Student is NOT a submitter (matrix: parents pay), Admin/Accountant may
 *    record office payments (still pending verification — no self-verify
 *    shortcut at creation time).
 *  - Verify / reject / reverse: Accountant + Admin only (Principal: none,
 *    per the matrix "Payments verify (manual)" row).
 *  - Reads + receipts: scoped in the service (own / verified-linked only).
 *  - Online checkout + webhook: structure only — see payment-provider.ts.
 *    Checkout checks the provider BEFORE requireDb so the honest 503
 *    PAYMENT_GATEWAY_NOT_CONFIGURED is what an unconfigured deployment
 *    returns; the webhook is a public gateway callback (no user auth —
 *    trust comes from the signature, and without a secret it rejects).
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const VERIFY = ["admin", "accountant"] as const;
const READ = ["admin", "accountant", "student", "parent"] as const;

r.post("/", authenticate, authorize("admin", "accountant", "parent"), validate(manualPaymentSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { payment: await svc.submitManualPayment(actor(req), req.body) } });
}));
r.get("/", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listPayments(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { payments: out.items }, meta: out.meta });
}));
r.get("/receipts", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const out = await svc.listReceipts(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { receipts: out.items }, meta: out.meta });
}));
r.get("/receipts/:id/pdf", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  const data = await svc.getReceiptData(actor(req), req.params.id);
  const doc = renderReceiptPdf(data);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="receipt-${data.receiptNumber}.pdf"`);
  doc.pipe(res);
}));
r.get("/:id", authenticate, authorize(...READ), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { payment: await svc.getPayment(actor(req), req.params.id) } });
}));
r.post("/:id/verify", authenticate, authorize(...VERIFY), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.verifyPayment(actor(req), req.params.id) });
}));
r.post("/:id/reject", authenticate, authorize(...VERIFY), validate(rejectPaymentSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { payment: await svc.rejectPayment(actor(req), req.params.id, req.body.reason) } });
}));
r.post("/:id/reverse", authenticate, authorize(...VERIFY), validate(reversePaymentSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.reversePayment(actor(req), req.params.id, req.body.reason) });
}));

/* Online payments — structure only (never faked). */
r.post("/online/checkout", authenticate, authorize("admin", "accountant", "parent", "student"), validate(checkoutSchema), wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { checkout: await svc.createOnlineCheckout(actor(req), req.body.invoiceId) } });
}));
r.post("/webhooks/provider", wrap(async (req, res) => {
  const rawBody = JSON.stringify(req.body ?? {});
  const signature = req.headers["x-webhook-signature"];
  const out = await svc.handleWebhook(rawBody, typeof signature === "string" ? signature : undefined);
  res.json({ success: true, data: out });
}));

export default r;
