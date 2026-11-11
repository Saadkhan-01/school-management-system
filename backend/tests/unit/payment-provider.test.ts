import { describe, it, expect } from "vitest";
import { paymentProvider } from "../../src/modules/payments/payment-provider";

/**
 * §36/§12 — the payment provider in its (current, production) UNCONFIGURED
 * state. The honesty contract: checkout never succeeds, webhooks are never
 * trusted, and nothing can be marked paid without real gateway credentials.
 * (The configured-provider HMAC branch activates only when the school
 * supplies PAYMENT_* credentials and a real adapter is implemented.)
 */
describe("payment provider — unconfigured state", () => {
  it("reports itself unconfigured", () => {
    expect(paymentProvider.configured).toBe(false);
  });

  it("checkout refuses with 503 PAYMENT_GATEWAY_NOT_CONFIGURED", async () => {
    await expect(
      paymentProvider.createCheckoutSession({ invoiceId: "x".repeat(24), invoiceNumber: "INV-2026-000001", amountMinor: 1000, studentId: "y".repeat(24) }),
    ).rejects.toMatchObject({ statusCode: 503, code: "PAYMENT_GATEWAY_NOT_CONFIGURED" });
  });

  it("webhook verification refuses with 503 when no webhook secret exists", () => {
    expect(() => paymentProvider.verifyWebhook(JSON.stringify({ id: "evt_1" }), "deadbeef"))
      .toThrowError(expect.objectContaining({ statusCode: 503, code: "PAYMENT_GATEWAY_NOT_CONFIGURED" }));
  });
});
