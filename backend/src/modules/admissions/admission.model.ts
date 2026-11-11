import mongoose, { Schema, type Document } from "mongoose";

/**
 * AdmissionApplication — an online admission application (§16).
 * Phase 2 scope: Submitted → Under Review → Approved / Rejected, with full status history.
 * "Enrolled" exists in the enum because Phase 4 completes the workflow (admission number,
 * parent linking, class/session assignment, fee structure) — it is NOT reachable in Phase 2.
 */
export const ADMISSION_STATUSES = ["Submitted", "Under Review", "Approved", "Rejected", "Enrolled"] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export interface AdmissionDocumentMeta { name: string; type?: string; url?: string; note?: string }

export interface IAdmissionApplication extends Document {
  studentName: string;
  dateOfBirth: Date;
  gender: "male" | "female" | "other";
  guardianName: string;
  guardianRelation?: string;
  guardianEmail: string;
  guardianPhone: string;
  previousSchool?: string;
  desiredClass: string;
  address: string;
  city?: string;
  documents: AdmissionDocumentMeta[];
  status: AdmissionStatus;
  statusHistory: Array<{ status: AdmissionStatus; by?: mongoose.Types.ObjectId; byRole?: string; note?: string; at: Date }>;
  reviewedBy?: mongoose.Types.ObjectId;
  decidedBy?: mongoose.Types.ObjectId;
  /** Phase 4 enrollment conversion (§16 steps 6–12) — set exactly once, when status becomes Enrolled. */
  enrolledStudent?: mongoose.Types.ObjectId;
  enrolledParentUser?: mongoose.Types.ObjectId;
  enrolledBy?: mongoose.Types.ObjectId;
  enrolledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<AdmissionDocumentMeta>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  type: { type: String, trim: true, maxlength: 80 },
  url: { type: String, trim: true, maxlength: 1000 },
  note: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const statusHistorySchema = new Schema({
  status: { type: String, enum: ADMISSION_STATUSES, required: true },
  by: { type: Schema.Types.ObjectId, ref: "User" },
  byRole: { type: String, maxlength: 40 },
  note: { type: String, trim: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const admissionSchema = new Schema<IAdmissionApplication>({
  studentName: { type: String, required: true, trim: true, maxlength: 120, index: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ["male", "female", "other"], required: true },
  guardianName: { type: String, required: true, trim: true, maxlength: 120 },
  guardianRelation: { type: String, trim: true, maxlength: 60 },
  guardianEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
  guardianPhone: { type: String, required: true, trim: true, maxlength: 40 },
  previousSchool: { type: String, trim: true, maxlength: 200 },
  desiredClass: { type: String, required: true, trim: true, maxlength: 60, index: true },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  city: { type: String, trim: true, maxlength: 120 },
  documents: { type: [documentSchema], default: [] },
  status: { type: String, enum: ADMISSION_STATUSES, default: "Submitted", index: true },
  statusHistory: { type: [statusHistorySchema], default: [] },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  enrolledStudent: { type: Schema.Types.ObjectId, ref: "Student" },
  enrolledParentUser: { type: Schema.Types.ObjectId, ref: "User" },
  enrolledBy: { type: Schema.Types.ObjectId, ref: "User" },
  enrolledAt: { type: Date },
}, { timestamps: true });

export const AdmissionApplication = (mongoose.models.AdmissionApplication as mongoose.Model<IAdmissionApplication>) || mongoose.model<IAdmissionApplication>("AdmissionApplication", admissionSchema);
