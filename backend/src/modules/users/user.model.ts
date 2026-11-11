
import mongoose, { Schema, type Document } from "mongoose";
export const USER_ROLES = ["admin","principal","teacher","student","parent","accountant","librarian","receptionist"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export interface LoginEvent { at: Date; ip?: string; userAgent?: string; success: boolean; }
export interface IUser extends Document {
  name: string; email: string; phone?: string; passwordHash: string; role: UserRole;
  isActive: boolean; isVerified: boolean;
  refreshTokenHash?: string | null;
  passwordResetTokenHash?: string | null; passwordResetExpires?: Date | null;
  loginHistory: LoginEvent[]; lastLoginAt?: Date;
  createdAt: Date; updatedAt: Date;
}
const loginEvent = new Schema<LoginEvent>({ at: { type: Date, default: Date.now }, ip: String, userAgent: String, success: { type: Boolean, required: true } }, { _id: false });
const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, maxlength: 40 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, required: true, index: true },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  refreshTokenHash: { type: String, default: null, select: false },
  passwordResetTokenHash: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null },
  loginHistory: { type: [loginEvent], default: [] },
  lastLoginAt: Date,
}, { timestamps: true });
userSchema.methods.toJSON = function () { const o = this.toObject() as Record<string, unknown>; delete o.passwordHash; delete o.refreshTokenHash; delete o.passwordResetTokenHash; return o; };
export const User = mongoose.models.User as mongoose.Model<IUser> || mongoose.model<IUser>("User", userSchema);
