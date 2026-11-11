import mongoose, { Schema, type Document } from "mongoose";
import { USER_ROLES } from "../users/user.model";

/**
 * ActivityLog (§33 audit logs, §29 activityLogs) — Phase 9.
 * One append-only record per important administrative action: who (actor +
 * role), what (action), on which record (entityKind + entityId), a human
 * summary, the request IP when known, and minimal metadata.
 *
 * SECURITY RULE: metadata/summary must NEVER contain passwords, tokens,
 * payment secrets, gateway credentials or full financial payloads — the
 * logActivity() helper in audit.service.ts is the only writer and call sites
 * pass ids/amounts/statuses only.
 */
export interface IActivityLog extends Document {
  actor?: mongoose.Types.ObjectId;
  actorRole?: (typeof USER_ROLES)[number];
  action: string;
  entityKind: string;
  entityId?: mongoose.Types.ObjectId;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}
const activityLogSchema = new Schema<IActivityLog>({
  actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
  actorRole: { type: String, enum: USER_ROLES, index: true },
  action: { type: String, required: true, trim: true, maxlength: 80, index: true },
  entityKind: { type: String, required: true, trim: true, maxlength: 60, index: true },
  entityId: { type: Schema.Types.ObjectId, index: true },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  metadata: { type: Schema.Types.Mixed },
  ip: { type: String, trim: true, maxlength: 64 },
}, { timestamps: true });
activityLogSchema.index({ createdAt: -1 });
export const ActivityLog = (mongoose.models.ActivityLog as mongoose.Model<IActivityLog>) || mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);
