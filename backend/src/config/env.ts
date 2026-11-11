
import dotenv from "dotenv";
dotenv.config();
export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  mongoUri: process.env.MONGODB_URI ?? "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-only-refresh-secret-change-me",
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  /**
   * Online payments (§12) — STRUCTURE ONLY. The gateway is considered
   * configured ONLY when PAYMENT_PROVIDER names a provider AND its key,
   * secret and webhook secret are all present. Until then the checkout
   * endpoint returns 503 PAYMENT_GATEWAY_NOT_CONFIGURED and the webhook
   * endpoint rejects every call — nothing is ever marked paid by an
   * unconfigured or unverifiable path.
   */
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "",
  paymentGatewayKey: process.env.PAYMENT_GATEWAY_KEY ?? "",
  paymentGatewaySecret: process.env.PAYMENT_GATEWAY_SECRET ?? "",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? "",
  /**
   * External notification channels (§24 email/SMS/WhatsApp) — Phase 9
   * STRUCTURE ONLY, same pattern as payments: a channel counts as configured
   * only when its provider env vars are present (see .env.example). Until
   * then dispatch is an explicit no-op — a send is never faked.
   */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  smsProvider: process.env.SMS_PROVIDER ?? "",
  smsApiKey: process.env.SMS_API_KEY ?? "",
  whatsappProvider: process.env.WHATSAPP_PROVIDER ?? "",
  whatsappApiKey: process.env.WHATSAPP_API_KEY ?? "",
};
export const externalChannelsConfigured = {
  email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  sms: Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY),
  whatsapp: Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY),
  get any() { return this.email || this.sms || this.whatsapp; },
};
export const paymentGatewayConfigured = Boolean(
  env.paymentProvider && env.paymentGatewayKey && env.paymentGatewaySecret && env.paymentWebhookSecret,
);
if (env.isProduction && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET || !env.mongoUri)) {
  throw new Error("Missing required production env vars: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, MONGODB_URI");
}
