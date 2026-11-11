
import bcrypt from "bcryptjs";
import { User, type IUser } from "../users/user.model";
import { AppError } from "../../utils/AppError";
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens";
import { env } from "../../config/env";
const SALT = 12;
export const publicUser = (u: IUser) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone ?? null, role: u.role, isActive: u.isActive, isVerified: u.isVerified, lastLoginAt: u.lastLoginAt });
async function issueTokens(u: IUser) {
  const accessToken = signAccessToken(String(u._id), u.role);
  const refreshToken = signRefreshToken(String(u._id));
  u.refreshTokenHash = hashToken(refreshToken); await u.save();
  return { accessToken, refreshToken };
}
export async function registerUser(input: { name: string; email: string; password: string; role: IUser["role"] }) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AppError(409, "EMAIL_TAKEN", "A user with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, SALT);
  const u = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role, isVerified: true });
  return publicUser(u);
}
export async function login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const u = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const fail = async () => { if (u) { u.loginHistory.push({ at: new Date(), ...meta, success: false }); await u.save(); } throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"); };
  if (!u) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (!u.isActive) throw new AppError(403, "ACCOUNT_INACTIVE", "This account is deactivated. Contact the school administration.");
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) await fail();
  u.loginHistory.push({ at: new Date(), ...meta, success: true }); u.lastLoginAt = new Date();
  const tokens = await issueTokens(u);
  return { user: publicUser(u), ...tokens };
}
export async function refresh(refreshToken: string) {
  let sub: string; try { sub = verifyRefreshToken(refreshToken).sub; } catch { throw new AppError(401, "TOKEN_EXPIRED_OR_INVALID", "Refresh session expired — please log in again"); }
  const u = await User.findById(sub).select("+refreshTokenHash");
  if (!u || !u.isActive || !u.refreshTokenHash || u.refreshTokenHash !== hashToken(refreshToken)) throw new AppError(401, "TOKEN_EXPIRED_OR_INVALID", "Refresh session is no longer valid");
  const tokens = await issueTokens(u); return { user: publicUser(u), ...tokens };
}
export async function logout(userId: string) { await User.findByIdAndUpdate(userId, { refreshTokenHash: null }); }
export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const u = await User.findOne({ email: email.toLowerCase() });
  if (!u) return {}; // never reveal whether an email exists
  const raw = randomToken(); u.passwordResetTokenHash = hashToken(raw); u.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); await u.save();
  // TODO: send via the configured SMTP channel (SMTP_HOST/SMTP_USER/SMTP_PASSWORD, Phase 9 channels.ts — a no-op until configured). Until a mailer is configured, the token is only exposed in non-production for local testing.
  return env.isProduction ? {} : { resetToken: raw };
}
export async function resetPassword(token: string, newPassword: string) {
  const u = await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } });
  if (!u) throw new AppError(400, "RESET_TOKEN_INVALID", "Reset token is invalid or expired");
  u.passwordHash = await bcrypt.hash(newPassword, SALT); u.passwordResetTokenHash = null; u.passwordResetExpires = null; u.refreshTokenHash = null; await u.save();
}
export async function changePassword(userId: string, current: string, next: string) {
  const u = await User.findById(userId).select("+passwordHash");
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new AppError(400, "CURRENT_PASSWORD_WRONG", "Current password is incorrect");
  u.passwordHash = await bcrypt.hash(next, SALT); u.refreshTokenHash = null; await u.save();
}
export async function getMe(userId: string) { const u = await User.findById(userId); if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found"); return publicUser(u); }

/**
 * Self-service profile update (§6, Phase 6). Only `name` and `phone` may ever
 * change here — the Zod schema is strict, so role/email/isActive in the body
 * fail validation (422) before this runs. The phone is mirrored into whichever
 * ERP profile the account owns (parent/teacher/staff/student) so the portals
 * and the admin people-views stay consistent; profiles are imported lazily to
 * avoid a module cycle (user.service already imports publicUser from here).
 */
export async function updateMyProfile(userId: string, input: { name?: string; phone?: string }) {
  const u = await User.findById(userId);
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (input.name !== undefined) u.name = input.name.trim();
  if (input.phone !== undefined) u.phone = input.phone.trim() || undefined;
  await u.save();
  if (input.phone !== undefined) {
    const phone = u.phone;
    const [{ ParentProfile }, { TeacherProfile }, { StaffProfile }, { Student }] = await Promise.all([
      import("../parents/parent.model"), import("../teachers/teacher.model"), import("../staff/staff.model"), import("../students/student.model"),
    ]);
    await Promise.all([
      ParentProfile.updateOne({ user: userId }, { $set: { phone } }),
      TeacherProfile.updateOne({ user: userId }, { $set: { phone } }),
      StaffProfile.updateOne({ user: userId }, { $set: { phone } }),
      Student.updateOne({ user: userId }, { $set: { phone } }),
    ]);
  }
  return publicUser(u);
}
