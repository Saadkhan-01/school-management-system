import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { User, type IUser, type UserRole } from "./user.model";
import { publicUser } from "../auth/auth.service";

const SALT = 12;

/**
 * User Management (§7) — Admin only at the route layer (docs/permissions.md:
 * "Manage users/roles" is Admin ●, every other role ○).
 * Deactivation is preferred over deletion: accounts with historical linkage
 * (login history, or a student/parent/teacher/staff profile) cannot be
 * hard-deleted — the service returns 409 and directs the admin to deactivate.
 */

export async function createUser(input: { name: string; email: string; password: string; role: UserRole; isActive?: boolean; isVerified?: boolean }) {
  const email = input.email.toLowerCase();
  if (await User.findOne({ email })) throw new AppError(409, "EMAIL_TAKEN", "A user with this email already exists");
  const passwordHash = await bcrypt.hash(input.password, SALT);
  const u = await User.create({ name: input.name, email, passwordHash, role: input.role, isActive: input.isActive ?? true, isVerified: input.isVerified ?? true });
  return publicUser(u);
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.role === "string" && query.role) filter.role = query.role;
  if (typeof query.isActive === "string" && query.isActive) filter.isActive = query.isActive === "true";
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [docs, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: docs.map(publicUser), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getUser(id: string) {
  requireObjectId(id, "User");
  const u = await User.findById(id);
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return publicUser(u);
}

export async function updateUser(id: string, input: { name?: string; email?: string; role?: UserRole; isVerified?: boolean }) {
  requireObjectId(id, "User");
  const update = definedOnly(input as Record<string, unknown>) as Partial<IUser>;
  if (update.email) {
    update.email = String(update.email).toLowerCase();
    const clash = await User.findOne({ email: update.email, _id: { $ne: id } });
    if (clash) throw new AppError(409, "EMAIL_TAKEN", "Another user already has this email");
  }
  const u = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return publicUser(u);
}

export async function setUserActive(id: string, isActive: boolean, actorId: string) {
  requireObjectId(id, "User");
  if (id === actorId && !isActive) throw new AppError(422, "CANNOT_DEACTIVATE_SELF", "You cannot deactivate your own account");
  const u = await User.findByIdAndUpdate(id, { $set: { isActive, ...(isActive ? {} : { refreshTokenHash: null }) } }, { new: true });
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return publicUser(u);
}

/** Admin password reset (§7): sets a new password and revokes all refresh sessions. */
export async function adminResetPassword(id: string, newPassword: string) {
  requireObjectId(id, "User");
  const u = await User.findById(id);
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  u.passwordHash = await bcrypt.hash(newPassword, SALT);
  u.refreshTokenHash = null;
  u.passwordResetTokenHash = null;
  u.passwordResetExpires = null;
  await u.save();
  return { id: String(u._id), passwordReset: true };
}

export async function getLoginHistory(id: string, query: Record<string, unknown>) {
  requireObjectId(id, "User");
  const { page, limit } = pageOptions(query);
  const u = await User.findById(id).select("loginHistory lastLoginAt name email role");
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  const all = [...u.loginHistory].sort((a, b) => b.at.getTime() - a.at.getTime());
  const items = all.slice((page - 1) * limit, page * limit);
  return { items, meta: { page, limit, total: all.length, pages: Math.ceil(all.length / limit) }, user: { id: String(u._id), name: u.name, email: u.email, role: u.role, lastLoginAt: u.lastLoginAt } };
}

/**
 * Guarded hard delete: refused (409) when the account has any historical
 * linkage — login history or an ERP profile — because those records must be
 * preserved (§40 rule 9). Deactivation is the supported alternative.
 */
export async function deleteUser(id: string, actorId: string) {
  requireObjectId(id, "User");
  if (id === actorId) throw new AppError(422, "CANNOT_DELETE_SELF", "You cannot delete your own account");
  const u = await User.findById(id);
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  const reasons: string[] = [];
  if (u.loginHistory.length > 0) reasons.push("login history");
  // Lazy imports avoid a module cycle (profile models do not import this service).
  const [{ Student }, { ParentProfile }, { TeacherProfile }, { StaffProfile }] = await Promise.all([
    import("../students/student.model"), import("../parents/parent.model"), import("../teachers/teacher.model"), import("../staff/staff.model"),
  ]);
  const [student, parent, teacher, staff] = await Promise.all([
    Student.findOne({ user: id }).select("_id").lean(),
    ParentProfile.findOne({ user: id }).select("_id").lean(),
    TeacherProfile.findOne({ user: id }).select("_id").lean(),
    StaffProfile.findOne({ user: id }).select("_id").lean(),
  ]);
  if (student) reasons.push("a student profile");
  if (parent) reasons.push("a parent profile");
  if (teacher) reasons.push("a teacher profile");
  if (staff) reasons.push("a staff profile");
  if (reasons.length > 0) {
    throw new AppError(409, "USER_HAS_HISTORY", `This account has ${reasons.join(" and ")} and must not be hard-deleted. Deactivate it instead — deactivation preserves all historical records.`, { reasons });
  }
  await User.findByIdAndDelete(id);
  return { deleted: true };
}
