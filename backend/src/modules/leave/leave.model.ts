import mongoose, { Schema, type Document } from "mongoose";

/**
 * LeaveApplication (§9 teacher leave, §13 HR leave, §11 parent leave for a
 * child). One collection for both kinds:
 *  - staff leave: `student` is null; applicantUser is the teacher/staff member;
 *  - student leave: a Parent applies for a verified-linked child (`student` set).
 * Decisions are recorded (decidedBy/decidedAt/decisionNote) and history is
 * never deleted. Approved student leave is surfaced to attendance marking via
 * GET /api/v1/attendance/approved-leaves and GET /api/v1/leave/approved.
 */
export const LEAVE_TYPES = ["sick", "casual", "annual", "emergency", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface ILeaveApplication extends Document {
  applicantUser: mongoose.Types.ObjectId;
  applicantRole: string;
  student?: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: LeaveStatus;
  decidedBy?: mongoose.Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}
const leaveSchema = new Schema<ILeaveApplication>({
  applicantUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  applicantRole: { type: String, required: true, trim: true, maxlength: 30, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", index: true, default: null },
  leaveType: { type: String, enum: LEAVE_TYPES, required: true },
  fromDate: { type: Date, required: true, index: true },
  toDate: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: LEAVE_STATUSES, default: "pending", index: true },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  decidedAt: { type: Date },
  decisionNote: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });
leaveSchema.index({ status: 1, fromDate: 1, toDate: 1 });
export const LeaveApplication = (mongoose.models.LeaveApplication as mongoose.Model<ILeaveApplication>) || mongoose.model<ILeaveApplication>("LeaveApplication", leaveSchema);
