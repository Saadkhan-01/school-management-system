import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestDb, stopTestDb } from "../helpers/testDb";
import { api, bearer } from "../helpers/api";
import { buildSchool, loginAs, type SchoolFixture } from "../helpers/seed";
import { Notification } from "../../src/modules/notifications/notification.model";
import { ActivityLog } from "../../src/modules/audit/audit.model";

/**
 * §36 — Finance suite: fee structure → invoice (INV format, server totals) →
 * duplicate/bulk rules → parent manual payment → overpayment 422 → verify →
 * receipt (RCP format) + balance → double verify 409 → reversal reopens →
 * cancel-with-verified-payment 409 → online checkout unconfigured 503.
 * Also asserts the Phase 9 wiring: payment-verified notification + audit row.
 * All money is integer minor units (575000 = 5,750.00).
 */
describe("§36 Finance", () => {
  let fx: SchoolFixture;
  let tok: Record<string, string> = {};
  let structureId = "";
  let invoiceId = "";
  let invoiceNumber = "";
  let paymentId = "";
  const TOTAL = 575000; // 500000 tuition + 75000 transport

  beforeAll(async () => {
    await startTestDb();
    fx = await buildSchool();
    for (const [key, u] of Object.entries({ admin: fx.admin, accountant: fx.accountant, parent: fx.parent, teacher: fx.teacher })) {
      tok[key] = (await loginAs(u.email, u.password)).token;
    }
  }, 300_000);
  afterAll(async () => { await stopTestDb(); });

  it("fee structure: created by accountant with server-computed total", async () => {
    const res = await api().post("/api/v1/fees/structures").set(bearer(tok.accountant)).send({
      name: "Term 1 fees", sessionId: fx.sessionId, classId: fx.classId, sectionId: fx.sectionId,
      lineItems: [{ label: "Tuition", amount: 500000 }, { label: "Transport", amount: 75000 }],
      partialPaymentsAllowed: true, periodLabel: "Term 1",
    });
    expect(res.status).toBe(201);
    structureId = res.body.data.feeStructure._id;
    expect(res.body.data.feeStructure.totalAmount).toBe(TOTAL);
  });

  it("invoice generation: INV-<year>-<6-digit> number and server-side totals; client cannot set totals", async () => {
    const res = await api().post("/api/v1/invoices").set(bearer(tok.accountant)).send({
      studentId: fx.studentA._id, feeStructureId: structureId, dueDate: "2027-01-31", periodLabel: "Term 1",
    });
    expect(res.status).toBe(201);
    const inv = res.body.data.invoice;
    invoiceId = inv._id; invoiceNumber = inv.invoiceNumber;
    expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(inv.totalDue).toBe(TOTAL);
    expect(inv.amountPaid).toBe(0);
    expect(inv.balance).toBe(TOTAL);
    expect(inv.status).toBe("unpaid");
  });

  it("duplicate single generate → 409 INVOICE_ALREADY_EXISTS; bulk generate skips already-invoiced students", async () => {
    const dupe = await api().post("/api/v1/invoices").set(bearer(tok.accountant)).send({
      studentId: fx.studentA._id, feeStructureId: structureId, dueDate: "2027-01-31", periodLabel: "Term 1",
    });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error.code).toBe("INVOICE_ALREADY_EXISTS");

    const bulk = await api().post("/api/v1/invoices/bulk").set(bearer(tok.accountant)).send({
      feeStructureId: structureId, classId: fx.classId, dueDate: "2027-01-31", periodLabel: "Term 1",
    });
    expect(bulk.status).toBe(200);
    const out = bulk.body.data.result ?? bulk.body.data;
    expect(out.created).toBe(1); // only student B
    expect(out.skipped).toBe(1);  // student A already invoiced
    expect(out.totalEnrolled).toBe(2);
  });

  it("parent submits a manual payment → 201 pending-verification; overpayment → 422", async () => {
    const over = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({
      invoiceId, amount: TOTAL + 1, method: "bank-transfer", reference: "TXN-OVER",
    });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe("OVERPAYMENT");

    const ok = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({
      invoiceId, amount: 200000, method: "bank-transfer", reference: "TXN-1001",
    });
    expect(ok.status).toBe(201);
    paymentId = ok.body.data.payment._id;
    expect(ok.body.data.payment.status).toBe("pending-verification");
    // Pending money must NOT reduce the balance yet
    const inv = await api().get(`/api/v1/invoices/${invoiceId}`).set(bearer(tok.accountant));
    expect(inv.body.data.invoice.balance).toBe(TOTAL);
    expect(inv.body.data.invoice.amountPaid).toBe(0);
  });

  it("a parent cannot pay another family's invoice (scope) and a teacher cannot submit payments at all", async () => {
    const bulk = await api().get("/api/v1/invoices").set(bearer(tok.accountant)).query({ studentId: fx.studentB._id });
    const bInvoice = (bulk.body.data.invoices as Array<{ _id: string }>)[0];
    expect(bInvoice).toBeTruthy();
    const foreign = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({ invoiceId: bInvoice._id, amount: 1000, method: "cash" });
    expect(foreign.status).toBe(403);
    const asTeacher = await api().post("/api/v1/payments").set(bearer(tok.teacher)).send({ invoiceId, amount: 1000, method: "cash" });
    expect(asTeacher.status).toBe(403);
  });

  it("accountant verifies → receipt RCP-<year>-<6-digit>, invoice balance drops; notification + audit rows are written", async () => {
    const verify = await api().post(`/api/v1/payments/${paymentId}/verify`).set(bearer(tok.accountant));
    expect(verify.status).toBe(200);
    expect(verify.body.data.payment.status).toBe("verified");
    const receipt = verify.body.data.receipt;
    expect(receipt.receiptNumber).toMatch(/^RCP-\d{4}-\d{6}$/);
    expect(receipt.amount).toBe(200000);

    const inv = await api().get(`/api/v1/invoices/${invoiceId}`).set(bearer(tok.accountant));
    expect(inv.body.data.invoice.amountPaid).toBe(200000);
    expect(inv.body.data.invoice.balance).toBe(TOTAL - 200000);
    expect(inv.body.data.invoice.status).toBe("partially-paid");

    // Phase 9 hook: the submitting parent received a payment-verified notification
    const notif = await Notification.findOne({ recipient: fx.parentUserId, type: "payment-verified" }).lean();
    expect(notif).toBeTruthy();
    expect(notif!.title).toMatch(/verified/i);
    // Audit: a payment.verify activity-log row exists (and invoice.generate was logged earlier)
    const audit = await ActivityLog.findOne({ action: "payment.verify" }).lean();
    expect(audit).toBeTruthy();
    const genAudit = await ActivityLog.findOne({ action: "invoice.generate" }).lean();
    expect(genAudit).toBeTruthy();
  });

  it("double verify → 409 ALREADY_VERIFIED (no second receipt)", async () => {
    const again = await api().post(`/api/v1/payments/${paymentId}/verify`).set(bearer(tok.accountant));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_VERIFIED");
    const receipts = await api().get("/api/v1/payments/receipts").set(bearer(tok.accountant));
    const mine = (receipts.body.data.receipts as Array<{ payment: string | { _id: string } }>)
      .filter((r) => String(typeof r.payment === "object" ? r.payment._id : r.payment) === paymentId);
    expect(mine.length).toBe(1);
  });

  it("cancel invoice WITH a verified payment → 409; reversal reopens the balance; then cancel succeeds", async () => {
    const cancelBlocked = await api().post(`/api/v1/invoices/${invoiceId}/cancel`).set(bearer(tok.accountant)).send({ reason: "Issued in error" });
    expect(cancelBlocked.status).toBe(409);
    expect(cancelBlocked.body.error.code).toBe("INVOICE_HAS_VERIFIED_PAYMENTS");

    const reverse = await api().post(`/api/v1/payments/${paymentId}/reverse`).set(bearer(tok.accountant)).send({ reason: "Bank reversed the transfer" });
    expect(reverse.status).toBe(200);
    expect(reverse.body.data.payment.status).toBe("reversed");
    const inv = await api().get(`/api/v1/invoices/${invoiceId}`).set(bearer(tok.accountant));
    expect(inv.body.data.invoice.amountPaid).toBe(0);
    expect(inv.body.data.invoice.balance).toBe(TOTAL);
    expect(inv.body.data.invoice.status).toBe("unpaid");

    const cancel = await api().post(`/api/v1/invoices/${invoiceId}/cancel`).set(bearer(tok.accountant)).send({ reason: "Issued in error" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.invoice.status).toBe("cancelled");
    // Paying a cancelled invoice → 409
    const payCancelled = await api().post("/api/v1/payments").set(bearer(tok.parent)).send({ invoiceId, amount: 1000, method: "cash" });
    expect(payCancelled.status).toBe(409);
    expect(payCancelled.body.error.code).toBe("INVOICE_CANCELLED");
  });

  it("online checkout with NO gateway configured → 503 PAYMENT_GATEWAY_NOT_CONFIGURED (never a fake success)", async () => {
    // Fresh unpaid invoice for student B
    const list = await api().get("/api/v1/invoices").set(bearer(tok.accountant)).query({ studentId: fx.studentB._id });
    const bInvoice = (list.body.data.invoices as Array<{ _id: string }>)[0];
    const res = await api().post("/api/v1/payments/online/checkout").set(bearer(tok.accountant)).send({ invoiceId: bInvoice._id });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PAYMENT_GATEWAY_NOT_CONFIGURED");
    // And the invoice is untouched — no fake payment was recorded
    const after = await api().get(`/api/v1/invoices/${bInvoice._id}`).set(bearer(tok.accountant));
    expect(after.body.data.invoice.amountPaid).toBe(0);
    expect(after.body.data.invoice.status).toBe("unpaid");
  });

  it("webhook while the gateway is UNCONFIGURED → 503 (endpoint disabled — no secret exists to verify any delivery)", async () => {
    // Design (§12/§40): with no PAYMENT_WEBHOOK_SECRET configured, NO delivery
    // can be trusted, so the endpoint refuses everything with 503 rather than
    // processing unsigned events. The bad-signature → 401 branch only exists
    // once a provider is configured; it is covered by the provider unit tests
    // in tests/unit/payment-provider.test.ts.
    const res = await api().post("/api/v1/payments/webhooks/provider")
      .set("x-webhook-signature", "deadbeef")
      .send({ id: "evt_fake_1", type: "payment.succeeded" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PAYMENT_GATEWAY_NOT_CONFIGURED");
  });
});
