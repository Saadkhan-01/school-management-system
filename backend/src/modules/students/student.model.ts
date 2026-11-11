import mongoose, { Schema, type Document } from "mongoose";

/**
 * Student (§29 students) — the enrolled learner record. Created either directly by
 * Admin (Student Management) or by admission conversion (§16). `admissionNumber`
 * is unique and generated as ADM-<year>-<sequence> when not supplied
 * (see utils/admissionNumber.ts). `user` is an optional login account: young
 * students may not have one yet; the link is set when a student account is created.
 * Historical records are preserved — withdrawal/graduation are statuses, not deletes.
 */
export const STUDENT_STATUSES = ["active", "inactive", "transferred", "withdrawn", "graduated"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export interface IStudent extends Document {
  admissionNumber: string;
  user?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  bloodGroup?: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  guardianName: string;
  guardianRelation?: string;
  guardianEmail?: string;
  guardianPhone: string;
  previousSchool?: string;
  status: StudentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>({
  admissionNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
  // One login account fronts exactly ONE student record: every "own record"
  // resolver (portal, academic scope, finance) uses findOne({ user }), so a
  // second link would make that resolution arbitrary. Sparse+unique — most
  // student records have no login account at all. (Phase 10 §36 finding.)
  user: { type: Schema.Types.ObjectId, ref: "User", unique: true, sparse: true, index: true },
  firstName: { type: String, required: true, trim: true, maxlength: 80, index: true },
  lastName: { type: String, required: true, trim: true, maxlength: 80, index: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: GENDERS, required: true },
  bloodGroup: { type: String, trim: true, maxlength: 10 },
  photoUrl: { type: String, trim: true, maxlength: 1000 },
  email: { type: String, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, trim: true, maxlength: 500 },
  city: { type: String, trim: true, maxlength: 120 },
  guardianName: { type: String, required: true, trim: true, maxlength: 120 },
  guardianRelation: { type: String, trim: true, maxlength: 60 },
  guardianEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
  guardianPhone: { type: String, required: true, trim: true, maxlength: 40 },
  previousSchool: { type: String, trim: true, maxlength: 200 },
  status: { type: String, enum: STUDENT_STATUSES, default: "active", index: true },
  notes: { type: String, trim: true, maxlength: 2000 },
}, { timestamps: true });
studentSchema.index({ firstName: 1, lastName: 1 });

export const Student = (mongoose.models.Student as mongoose.Model<IStudent>) || mongoose.model<IStudent>("Student", studentSchema);
