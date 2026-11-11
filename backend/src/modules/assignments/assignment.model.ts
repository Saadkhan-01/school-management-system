import mongoose, { Schema, type Document } from "mongoose";

/**
 * Assignments, Submissions, StudyMaterials (§9/§20, §29).
 * File STORAGE is not configured in this environment (Cloudinary/S3 arrive
 * with the storage phase), so attachments are metadata only — {name, url,
 * mimeType, sizeBytes} recorded exactly as supplied by the client. No upload
 * is faked: nothing here claims a file was stored.
 */
export interface AttachmentMeta {
  name: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
}
const attachmentSchema = new Schema<AttachmentMeta>({
  name: { type: String, required: true, trim: true, maxlength: 300 },
  url: { type: String, trim: true, maxlength: 2000 },
  mimeType: { type: String, trim: true, maxlength: 120 },
  sizeBytes: { type: Number, min: 0 },
}, { _id: false });

export interface IAssignment extends Document {
  teacher: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  schoolClass: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  title: string;
  instructions?: string;
  deadline: Date;
  maxMarks?: number;
  attachments: AttachmentMeta[];
  createdAt: Date;
  updatedAt: Date;
}
const assignmentSchema = new Schema<IAssignment>({
  teacher: { type: Schema.Types.ObjectId, ref: "TeacherProfile", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  instructions: { type: String, trim: true, maxlength: 5000 },
  deadline: { type: Date, required: true, index: true },
  maxMarks: { type: Number, min: 1, max: 1000 },
  attachments: { type: [attachmentSchema], default: [] },
}, { timestamps: true });
export const Assignment = (mongoose.models.Assignment as mongoose.Model<IAssignment>) || mongoose.model<IAssignment>("Assignment", assignmentSchema);

export const SUBMISSION_STATUSES = ["submitted", "graded"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export interface ISubmission extends Document {
  assignment: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  enrollment?: mongoose.Types.ObjectId;
  content?: string;
  attachments: AttachmentMeta[];
  submittedAt: Date;
  isLate: boolean;
  status: SubmissionStatus;
  marks?: number;
  feedback?: string;
  /** Parent (and student) see marks/feedback only when this is true (§20 published feedback). */
  feedbackPublished: boolean;
  gradedBy?: mongoose.Types.ObjectId;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const submissionSchema = new Schema<ISubmission>({
  assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment" },
  content: { type: String, trim: true, maxlength: 20000 },
  attachments: { type: [attachmentSchema], default: [] },
  submittedAt: { type: Date, required: true, default: Date.now },
  isLate: { type: Boolean, default: false, index: true },
  status: { type: String, enum: SUBMISSION_STATUSES, default: "submitted", index: true },
  marks: { type: Number, min: 0 },
  feedback: { type: String, trim: true, maxlength: 5000 },
  feedbackPublished: { type: Boolean, default: false },
  gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
  gradedAt: { type: Date },
}, { timestamps: true });
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true, name: "one_submission_per_assignment_student" });
export const Submission = (mongoose.models.Submission as mongoose.Model<ISubmission>) || mongoose.model<ISubmission>("Submission", submissionSchema);

export interface IStudyMaterial extends Document {
  title: string;
  description?: string;
  schoolClass: mongoose.Types.ObjectId;
  section?: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  session: mongoose.Types.ObjectId;
  teacher?: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
}
const materialSchema = new Schema<IStudyMaterial>({
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  description: { type: String, trim: true, maxlength: 2000 },
  schoolClass: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
  section: { type: Schema.Types.ObjectId, ref: "Section", index: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
  session: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: "TeacherProfile", index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, trim: true, maxlength: 300 },
  fileUrl: { type: String, trim: true, maxlength: 2000 },
  mimeType: { type: String, trim: true, maxlength: 120 },
  sizeBytes: { type: Number, min: 0 },
}, { timestamps: true });
export const StudyMaterial = (mongoose.models.StudyMaterial as mongoose.Model<IStudyMaterial>) || mongoose.model<IStudyMaterial>("StudyMaterial", materialSchema);
