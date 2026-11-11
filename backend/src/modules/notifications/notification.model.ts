import mongoose, { Schema, type Document } from "mongoose";

/**
 * Notification (§24, §29 notifications) — Phase 9.
 * In-app notifications are PERSISTED here first (§35 rule: never rely only on
 * live socket events — offline users must still see them). The service layer
 * additionally emits each record over Socket.IO to the recipient's room and
 * passes it to the external-channel stubs (email/SMS/WhatsApp — unconfigured
 * no-ops, see channels.ts). A notification write failure never fails the
 * business operation that triggered it.
 */
export const NOTIFICATION_TYPES = [
  "student-absence",
  "assignment-created",
  "assignment-deadline",
  "assignment-graded",
  "exam-scheduled",
  "result-published",
  "fee-invoice-generated",
  "payment-verified",
  "payment-rejected",
  "leave-decided",
  "announcement",
  "message",
  "admission-status",
  "admission-enrolled",
  "complaint-updated",
  "certificate-issued",
  "appointment",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntity?: { kind: string; id?: mongoose.Types.ObjectId };
  isRead: boolean;
  readAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const notificationSchema = new Schema<INotification>({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  relatedEntity: {
    kind: { type: String, trim: true, maxlength: 60 },
    id: { type: Schema.Types.ObjectId },
  },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
export const Notification = (mongoose.models.Notification as mongoose.Model<INotification>) || mongoose.model<INotification>("Notification", notificationSchema);
