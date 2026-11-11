import mongoose, { Schema, type Document } from "mongoose";

/**
 * StaffProfile (§29 staff, §13 HR) — employment record for a non-teaching (or
 * administrative) employee. The linked `user` carries the login role
 * (principal/accountant/librarian/receptionist/admin); this profile carries HR
 * data: unique employeeId, department, designation, joining date, employment
 * status. Salary structures and payroll are Phase 7 — not stored here.
 */
export const EMPLOYMENT_STATUSES = ["active", "on-leave", "suspended", "terminated", "retired"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export interface IStaffProfile extends Document {
  user: mongoose.Types.ObjectId;
  employeeId: string;
  department: string;
  designation: string;
  joiningDate?: Date;
  employmentStatus: EmploymentStatus;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const staffProfileSchema = new Schema<IStaffProfile>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40, index: true },
  department: { type: String, required: true, trim: true, maxlength: 120, index: true },
  designation: { type: String, required: true, trim: true, maxlength: 120 },
  joiningDate: { type: Date },
  employmentStatus: { type: String, enum: EMPLOYMENT_STATUSES, default: "active", index: true },
  phone: { type: String, trim: true, maxlength: 40 },
  address: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

export const StaffProfile = (mongoose.models.StaffProfile as mongoose.Model<IStaffProfile>) || mongoose.model<IStaffProfile>("StaffProfile", staffProfileSchema);
