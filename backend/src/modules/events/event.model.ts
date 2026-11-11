import mongoose, { Schema, type Document } from "mongoose";
import { USER_ROLES } from "../users/user.model";

/**
 * CalendarEvent (§23 internal events calendar, §29 events) — Phase 9.
 * This is the INTERNAL ERP calendar (holidays, exam days, parent meetings,
 * school events, internal announcements) with role audiences. It is separate
 * from the Phase 2 public website items (PublicContentItem), which stay
 * public-facing; a calendar event never appears on the public website.
 *
 * Audience: a non-empty list of roles, or ["all"]. Lists are sliced by the
 * caller's role in the service — an event targeted at teachers is invisible
 * to students/parents. Admin/Principal see everything (oversight).
 */
export const EVENT_TYPES = ["holiday", "exam", "parent-meeting", "event", "announcement"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const AUDIENCE_VALUES = [...USER_ROLES, "all"] as const;

export interface AttachmentMeta { name: string; url?: string; mimeType?: string; sizeBytes?: number }
export interface ICalendarEvent extends Document {
  title: string;
  description?: string;
  type: EventType;
  startAt: Date;
  endAt: Date;
  audience: string[];
  createdBy: mongoose.Types.ObjectId;
  attachments: AttachmentMeta[];
  createdAt: Date;
  updatedAt: Date;
}
const calendarEventSchema = new Schema<ICalendarEvent>({
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  description: { type: String, trim: true, maxlength: 3000 },
  type: { type: String, enum: EVENT_TYPES, required: true, index: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  audience: { type: [String], enum: AUDIENCE_VALUES, required: true, default: ["all"] },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  attachments: { type: [{ name: { type: String, required: true, maxlength: 200 }, url: { type: String, maxlength: 1000 }, mimeType: { type: String, maxlength: 120 }, sizeBytes: { type: Number, min: 0 } }], default: [] },
}, { timestamps: true });
calendarEventSchema.index({ startAt: 1, endAt: 1 });
export const CalendarEvent = (mongoose.models.CalendarEvent as mongoose.Model<ICalendarEvent>) || mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema);
