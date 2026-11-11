import mongoose, { Schema, type Document } from "mongoose";

/**
 * TeacherProfile (§29 teachers) — one profile per teacher login (`user` unique),
 * `employeeId` unique across teachers. Class/subject scope lives in
 * TeacherAssignment (academics module), never on this profile.
 */
export interface ITeacherProfile extends Document {
  user: mongoose.Types.ObjectId;
  employeeId: string;
  qualification?: string;
  specialization?: string;
  subjectsNote?: string;
  phone?: string;
  address?: string;
  joiningDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teacherProfileSchema = new Schema<ITeacherProfile>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40, index: true },
  qualification: { type: String, trim: true, maxlength: 200 },
  specialization: { type: String, trim: true, maxlength: 200 },
  subjectsNote: { type: String, trim: true, maxlength: 500 },
  phone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, trim: true, maxlength: 500 },
  joiningDate: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const TeacherProfile = (mongoose.models.TeacherProfile as mongoose.Model<ITeacherProfile>) || mongoose.model<ITeacherProfile>("TeacherProfile", teacherProfileSchema);
