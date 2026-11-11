import mongoose, { Schema, type Document } from "mongoose";

/**
 * Attendance (§9, §29 attendance) — one record per student per day.
 * Uniqueness is enforced by a unique index on (student, date) AND a unique
 * index on (enrollment, date); the service pre-checks and returns a clean 409
 * on duplicates. Corrections never overwrite history: every change appends an
 * editHistory entry with who/when/old→new.
 * `date` is always stored normalized to UTC midnight of the school day.
 */
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceEdit {
  editedBy: mongoose.Types.ObjectId;
  editedAt: Date;
  oldStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  note?: string;
}

export interface IAttendance extends Document {
  student: mongoose.Types.ObjectId;
  enrollment: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  note?: string;
  markedBy: mongoose.Types.ObjectId;
  markedAt: Date;
  editHistory: AttendanceEdit[];
  createdAt: Date;
  updatedAt: Date;
}

const editSchema = new Schema<AttendanceEdit>({
  editedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  editedAt: { type: Date, required: true, default: Date.now },
  oldStatus: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  newStatus: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const attendanceSchema = new Schema<IAttendance>({
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: ATTENDANCE_STATUSES, required: true, index: true },
  note: { type: String, trim: true, maxlength: 500 },
  markedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  markedAt: { type: Date, required: true, default: Date.now },
  editHistory: { type: [editSchema], default: [] },
}, { timestamps: true });
attendanceSchema.index({ student: 1, date: 1 }, { unique: true, name: "one_attendance_per_student_day" });
attendanceSchema.index({ enrollment: 1, date: 1 }, { unique: true, name: "one_attendance_per_enrollment_day" });
attendanceSchema.index({ schoolClass: 1, section: 1, date: 1 });

export const Attendance = (mongoose.models.Attendance as mongoose.Model<IAttendance>) || mongoose.model<IAttendance>("Attendance", attendanceSchema);

/** Normalize any date input to UTC midnight so the unique day index is reliable. */
export function normalizeDay(input: Date | string): Date {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
