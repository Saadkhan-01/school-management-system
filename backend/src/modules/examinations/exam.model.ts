import mongoose, { Schema, type Document } from "mongoose";

/**
 * Examinations (§19, §29 exams/examSchedules).
 * Exam.resultStatus drives the result workflow:
 *   draft → (first marks entered) in-review → approved → published.
 * Marks may be entered/corrected only while resultStatus is not "published".
 * Students/parents can read results ONLY when resultStatus === "published"
 * (enforced in the results service — unpublished returns 404).
 * `allowPositions` is the school-policy flag for class positions (§19:
 * "positions only if school policy allows") — default OFF.
 */
export const EXAM_STATUSES = ["draft", "scheduled", "ongoing", "completed"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export const RESULT_STATUSES = ["draft", "in-review", "approved", "published"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export interface IExam extends Document {
  name: string;
  type: string;
  session: mongoose.Types.ObjectId;
  classes: mongoose.Types.ObjectId[];
  startDate?: Date;
  endDate?: Date;
  status: ExamStatus;
  resultStatus: ResultStatus;
  gradingScale?: mongoose.Types.ObjectId;
  allowPositions: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  publishedBy?: mongoose.Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const examSchema = new Schema<IExam>({
  name: { type: String, required: true, trim: true, maxlength: 160, index: true },
  type: { type: String, required: true, trim: true, maxlength: 80, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  classes: { type: [{ type: Schema.Types.ObjectId, ref: "SchoolClass" }], default: [] },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: EXAM_STATUSES, default: "draft", index: true },
  resultStatus: { type: String, enum: RESULT_STATUSES, default: "draft", index: true },
  gradingScale: { type: Schema.Types.ObjectId, ref: "GradingScale" },
  allowPositions: { type: Boolean, default: false },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
  publishedAt: { type: Date },
}, { timestamps: true });
export const Exam = (mongoose.models.Exam as mongoose.Model<IExam>) || mongoose.model<IExam>("Exam", examSchema);

export interface IExamSchedule extends Document {
  exam: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  date: Date;
  startTime?: string;
  endTime?: string;
  maxMarks: number;
  createdAt: Date;
  updatedAt: Date;
}
const scheduleSchema = new Schema<IExamSchedule>({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", index: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  date: { type: Date, required: true },
  startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  maxMarks: { type: Number, required: true, min: 1, max: 1000 },
}, { timestamps: true });
scheduleSchema.index({ exam: 1, schoolClass: 1, section: 1, subject: 1 }, { unique: true, name: "one_schedule_per_exam_class_subject" });
export const ExamSchedule = (mongoose.models.ExamSchedule as mongoose.Model<IExamSchedule>) || mongoose.model<IExamSchedule>("ExamSchedule", scheduleSchema);
