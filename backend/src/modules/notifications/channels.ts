import { logger } from "../../utils/logger";
import { env, externalChannelsConfigured } from "../../config/env";

/**
 * External notification channels (§24: email, SMS, WhatsApp) — Phase 9
 * STRUCTURE ONLY, mirroring the Phase 7 payment-provider pattern.
 *
 * Each channel has an interface and a single UNCONFIGURED implementation.
 * When the provider env vars are absent, dispatch is an explicit no-op that
 * logs at debug level — a send is NEVER faked, and no record is ever marked
 * "sent". A real integration implements the interface behind the same env
 * gate (SMTP_* for email, SMS_* for SMS, WHATSAPP_* for WhatsApp, see
 * backend/.env.example) and is selected in `getChannels()`.
 */
export interface OutboundMessage {
  toUserId: string;
  title: string;
  body: string;
  type: string;
}
export interface NotificationChannel {
  name: "email" | "sms" | "whatsapp";
  configured: boolean;
  send(msg: OutboundMessage): Promise<void>;
}

class UnconfiguredChannel implements NotificationChannel {
  configured = false;
  constructor(public name: NotificationChannel["name"]) {}
  async send(msg: OutboundMessage): Promise<void> {
    logger.debug(`[notifications] ${this.name} channel not configured — skipping external send for user ${msg.toUserId} (in-app notification already persisted)`);
  }
}

export function getChannels(): NotificationChannel[] {
  // No real adapters exist yet: every channel resolves to its unconfigured
  // implementation until a provider is implemented + configured via env.
  void env;
  return [new UnconfiguredChannel("email"), new UnconfiguredChannel("sms"), new UnconfiguredChannel("whatsapp")];
}

export async function dispatchExternalChannels(msg: OutboundMessage): Promise<void> {
  if (!externalChannelsConfigured.any) return; // fast no-op — nothing configured at all
  for (const channel of getChannels()) {
    try { await channel.send(msg); } catch (err) { logger.warn(`[notifications] ${channel.name} dispatch failed (ignored)`, err); }
  }
}
