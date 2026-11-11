import mongoose, { Schema, type Document } from "mongoose";

/**
 * Marks (§19, §29 marks) — one record per (examSchedule, student), enforced
 * by a unique index. obtainedMarks ≤ the schedule's maxMarks is validated in
 * the marks service (422 MARKS_EXCEED_MAX) because maxMarks lives on the
 * schedule. Every correction appends a change-history entry; published
 * results lock marks entirely (service check → 409).
 */
export interface MarkChange {
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  oldMarks: number;
  newMarks: number;
  note?: string;
}
export interface IMark extends Document {
  exam: mongoose.Types.ObjectId;
  examSchedule: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  obtainedMarks: number;
  enteredBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  changeHistory: MarkChange[];
  createdAt: Date;
  updatedAt: Date;
}
const changeSchema = new Schema<MarkChange>({
  changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, required: true, default: Date.now },
  oldMarks: { type: Number, required: true },
  newMarks: { type: Number, required: true },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });
const markSchema = new Schema<IMark>({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
  examSchedule: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  obtainedMarks: { type: Number, required: true, min: 0 },
  enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  changeHistory: { type: [changeSchema], default: [] },
}, { timestamps: true });
markSchema.index({ examSchedule: 1, student: 1 }, { unique: true, name: "one_mark_per_schedule_student" });
markSchema.index({ exam: 1, student: 1 });
export const Mark = (mongoose.models.Mark as mongoose.Model<IMark>) || mongoose.model<IMark>("Mark", markSchema);
