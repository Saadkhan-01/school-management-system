import crypto from "crypto";
import { env, paymentGatewayConfigured } from "../../config/env";
import { AppError } from "../../utils/AppError";

/**
 * Online payment provider — STRUCTURE ONLY (§12, Phase 7).
 *
 * A real integration needs, from an eligible provider (e.g. Stripe, or a
 * local gateway the school contracts with):
 *  1. PAYMENT_PROVIDER — the provider's name (selects the adapter).
 *  2. PAYMENT_GATEWAY_KEY — publishable/API key (backend creates checkout
 *     sessions/orders with the SECRET key server-side only).
 *  3. PAYMENT_GATEWAY_SECRET — secret API key (never shipped to the frontend).
 *  4. PAYMENT_WEBHOOK_SECRET — the signing secret used to verify webhook
 *     signatures; without it NO webhook is trusted.
 * Then implement a real adapter against this interface: createCheckoutSession
 * calls the provider's API, and verifyWebhook validates the provider's
 * signature scheme over the RAW request body. Only a verified webhook (or a
 * trusted server-side status fetch) may create a "verified" online Payment —
 * the frontend saying "success" must never mark an invoice paid (§40 rule 8).
 *
 * Until those env vars exist, the single implementation below is
 * "unconfigured": checkout → 503 PAYMENT_GATEWAY_NOT_CONFIGURED, webhook →
 * 503 (no secret to verify with), and nothing is ever marked paid.
 */
export interface CheckoutSessionRequest {
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  studentId: string;
}
export interface CheckoutSessionResult {
  provider: string;
  gatewayRef: string;
  checkoutUrl: string;
}
export interface WebhookVerification {
  ok: boolean;
  eventId?: string;
  eventType?: string;
  payloadHash?: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  verifyWebhook(rawBody: string, signature: string | undefined): WebhookVerification;
}

class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = env.paymentProvider || "unconfigured";
  readonly configured = paymentGatewayConfigured;

  async createCheckoutSession(_req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    throw new AppError(
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Online payments are not configured. Set PAYMENT_PROVIDER, PAYMENT_GATEWAY_KEY, PAYMENT_GATEWAY_SECRET and PAYMENT_WEBHOOK_SECRET in backend/.env (see backend/.env.example) and implement the provider adapter in modules/payments/payment-provider.ts. Manual payments remain available.",
    );
  }

  verifyWebhook(rawBody: string, signature: string | undefined): WebhookVerification {
    if (!env.paymentWebhookSecret) {
      throw new AppError(503, "PAYMENT_GATEWAY_NOT_CONFIGURED", "Webhook endpoint is disabled: PAYMENT_WEBHOOK_SECRET is not configured, so no delivery can be verified or trusted.");
    }
    if (!paymentGatewayConfigured) {
      throw new AppError(503, "PAYMENT_GATEWAY_NOT_CONFIGURED", "Payment provider is not fully configured (PAYMENT_PROVIDER / PAYMENT_GATEWAY_KEY / PAYMENT_GATEWAY_SECRET missing); webhooks are not processed.");
    }
    // Generic HMAC-SHA256 verification (hex digest in the
    // `x-webhook-signature` header). A real adapter replaces this with the
    // provider's exact scheme; the contract — bad signature ⇒ not ok — stays.
    const expected = crypto.createHmac("sha256", env.paymentWebhookSecret).update(rawBody).digest("hex");
    const provided = (signature ?? "").trim().toLowerCase();
    const ok = provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) return { ok: false };
    let eventId: string | undefined;
    let eventType: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as { id?: string; eventId?: string; type?: string };
      eventId = parsed.id ?? parsed.eventId;
      eventType = parsed.type;
    } catch { /* non-JSON body: no event id to deduplicate on */ }
    return {
      ok: true,
      eventId,
      eventType,
      payloadHash: crypto.createHash("sha256").update(rawBody).digest("hex"),
    };
  }
}

/** The one provider instance. Swapping in a real adapter happens here only. */
export const paymentProvider: PaymentProvider = new UnconfiguredPaymentProvider();
