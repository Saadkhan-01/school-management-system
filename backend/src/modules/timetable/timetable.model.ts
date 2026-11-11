import mongoose, { Schema, type Document } from "mongoose";

/**
 * TimetableEntry (§18, §29 timetables) — one scheduled period.
 * Conflict rules are enforced in the service with clear 409 codes AND backed
 * by unique indexes: one entry per (session, class, section, weekday, period),
 * per (session, teacher, weekday, period) and per
 * (session, classroom, weekday, period). Times are "HH:MM" 24h strings
 * (lexicographic comparison is chronological for this format).
 */
export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface ITimetableEntry extends Document {
  session: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  classroom?: mongoose.Types.ObjectId;
  weekday: Weekday;
  periodNumber: number;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
}

const entrySchema = new Schema<ITimetableEntry>({
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: "TeacherProfile", required: true, index: true },
  classroom: { type: Schema.Types.ObjectId, ref: "Classroom", index: true },
  weekday: { type: String, enum: WEEKDAYS, required: true, index: true },
  periodNumber: { type: Number, required: true, min: 1, max: 20 },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
}, { timestamps: true });
entrySchema.index({ session: 1, schoolClass: 1, section: 1, weekday: 1, periodNumber: 1 }, { unique: true, name: "one_entry_per_class_period" });
entrySchema.index({ session: 1, teacher: 1, weekday: 1, periodNumber: 1 }, { unique: true, name: "one_entry_per_teacher_period" });
entrySchema.index({ session: 1, classroom: 1, weekday: 1, periodNumber: 1 }, { unique: true, sparse: true, name: "one_entry_per_classroom_period" });

export const TimetableEntry = (mongoose.models.TimetableEntry as mongoose.Model<ITimetableEntry>) || mongoose.model<ITimetableEntry>("TimetableEntry", entrySchema);
