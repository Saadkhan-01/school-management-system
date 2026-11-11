import mongoose, { Schema, type Document } from "mongoose";

/**
 * ParentProfile (§29 parents) — one profile per parent login account (`user` unique).
 * The account itself lives in `users` with role "parent"; this document carries the
 * ERP profile data. Children are connected ONLY through ParentStudent links, and
 * only verified links grant access (§4, docs/permissions.md).
 */
export interface IParentProfile extends Document {
  user: mongoose.Types.ObjectId;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  occupation?: string;
  relationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const parentProfileSchema = new Schema<IParentProfile>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  phone: { type: String, trim: true, maxlength: 40 },
  alternatePhone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, trim: true, maxlength: 500 },
  city: { type: String, trim: true, maxlength: 120 },
  occupation: { type: String, trim: true, maxlength: 120 },
  relationNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

export const ParentProfile = (mongoose.models.ParentProfile as mongoose.Model<IParentProfile>) || mongoose.model<IParentProfile>("ParentProfile", parentProfileSchema);

/**
 * ParentStudent (§29 parentStudents) — the verified parent↔child link.
 * Compound unique (parentUser, student): a pair can be linked once. Access checks
 * elsewhere must require `verified === true`; links created by Admin in the ERP
 * (or by admission conversion) are verified at creation and record who verified.
 */
export interface IParentStudent extends Document {
  parentUser: mongoose.Types.ObjectId;
  parentProfile: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  relationship: string;
  isPrimaryContact: boolean;
  verified: boolean;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parentStudentSchema = new Schema<IParentStudent>({
  parentUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  parentProfile: { type: Schema.Types.ObjectId, ref: "ParentProfile", required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  relationship: { type: String, required: true, trim: true, maxlength: 60, default: "Guardian" },
  isPrimaryContact: { type: Boolean, default: false },
  verified: { type: Boolean, default: false, index: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  verifiedAt: { type: Date },
}, { timestamps: true });
parentStudentSchema.index({ parentUser: 1, student: 1 }, { unique: true });

export const ParentStudent = (mongoose.models.ParentStudent as mongoose.Model<IParentStudent>) || mongoose.model<IParentStudent>("ParentStudent", parentStudentSchema);
