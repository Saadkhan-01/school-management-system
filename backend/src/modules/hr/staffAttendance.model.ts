
import mongoose, { Schema, type Document } from "mongoose";
/** Staff attendance (§13) — Phase 8 HR extra. Complements Phase 5 student Attendance and reuses Phase 5 Leave (staff leave is NOT duplicated here). Unique (user, date) — duplicates are refused 409 in the service and backed by the unique index. */
export const STAFF_ATTENDANCE_STATUSES = ["present","absent","late","on-leave"] as const;
export interface IStaffAttendance extends Document { user: mongoose.Types.ObjectId; date: Date; status: (typeof STAFF_ATTENDANCE_STATUSES)[number]; note?: string; markedBy: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date }
const s = new Schema<IStaffAttendance>({ user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, date: { type: Date, required: true, index: true }, status: { type: String, enum: STAFF_ATTENDANCE_STATUSES, required: true }, note: { type: String, trim: true, maxlength: 300 }, markedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
s.index({ user: 1, date: 1 }, { unique: true, name: "one_staff_attendance_per_user_date" });
export const StaffAttendance = (mongoose.models.StaffAttendance as mongoose.Model<IStaffAttendance>) || mongoose.model<IStaffAttendance>("StaffAttendance", s);
