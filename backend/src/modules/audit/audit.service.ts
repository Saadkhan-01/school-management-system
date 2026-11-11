import mongoose from "mongoose";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { ActivityLog } from "./audit.model";
import type { Actor } from "../academic-scope";

/**
 * Audit logging (§33) — Phase 9.
 *
 * logActivity() is deliberately FAIL-SAFE: it swallows every error
 * (including "no DB connected") so an audit write can NEVER fail the
 * business operation it describes. Call sites simply `await logActivity(...)`
 * after the mutation succeeds.
 *
 * Keys that must never be logged (passwords, tokens, secrets) are stripped
 * defensively even if a call site passes them by mistake.
 */
const FORBIDDEN_KEYS = /password|token|secret|authorization|cookie|card|cvv/i;

function sanitize(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface LogActivityInput {
  actor?: Actor | { id?: string; role?: string } | null;
  action: string;
  entityKind: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) return; // no DB — nothing to write to; never throw
    await ActivityLog.create({
      actor: input.actor?.id && mongoose.isValidObjectId(input.actor.id) ? input.actor.id : undefined,
      actorRole: input.actor?.role,
      action: input.action,
      entityKind: input.entityKind,
      entityId: input.entityId && mongoose.isValidObjectId(input.entityId) ? input.entityId : undefined,
      summary: input.summary.slice(0, 500),
      metadata: sanitize(input.metadata),
      ip: input.ip,
    });
  } catch (err) {
    logger.warn("logActivity failed (ignored — audit must never fail the operation)", err);
  }
}

/** Admin-only viewer query (route enforces the role; matrix: audit logs = Admin ●, all others ○). */
export async function listActivityLogs(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.action === "string" && query.action) filter.action = query.action;
  if (typeof query.entityKind === "string" && query.entityKind) filter.entityKind = query.entityKind;
  if (typeof query.actorRole === "string" && query.actorRole) filter.actorRole = query.actorRole;
  if (typeof query.actorId === "string" && query.actorId) { requireObjectId(query.actorId, "Actor"); filter.actor = query.actorId; }
  if (typeof query.entityId === "string" && query.entityId) { requireObjectId(query.entityId, "Entity"); filter.entityId = query.entityId; }
  const from = typeof query.from === "string" ? new Date(query.from) : null;
  const to = typeof query.to === "string" ? new Date(query.to) : null;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) range.$gte = from;
    if (to && !Number.isNaN(to.getTime())) range.$lte = to;
    if (Object.keys(range).length) filter.createdAt = range;
  }
  const [items, total] = await Promise.all([
    ActivityLog.find(filter).populate({ path: "actor", select: "name email role" }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ActivityLog.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function assertAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Activity logs are restricted to Admin");
}
