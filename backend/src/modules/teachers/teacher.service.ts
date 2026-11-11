import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { User } from "../users/user.model";
import { TeacherProfile, type ITeacherProfile } from "./teacher.model";

const SALT = 12;
const USER_POPULATE = { path: "user", select: "name email role isActive isVerified lastLoginAt createdAt" };

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = definedOnly(input);
  for (const [k, v] of Object.entries(out)) if (v === "") delete out[k];
  if (typeof out.employeeId === "string") out.employeeId = out.employeeId.toUpperCase();
  return out;
}

async function resolveTeacherUser(input: Record<string, unknown>) {
  if (input.userId) {
    const u = await User.findById(String(input.userId));
    if (!u) throw new AppError(404, "USER_NOT_FOUND", "The linked user account was not found");
    if (u.role !== "teacher") throw new AppError(422, "WRONG_ROLE", `Linked account has role '${u.role}' — a teacher profile requires a teacher account`);
    return u;
  }
  const email = String(input.email).toLowerCase();
  if (await User.findOne({ email })) throw new AppError(409, "EMAIL_TAKEN", "A user with this email already exists");
  const passwordHash = await bcrypt.hash(String(input.password), SALT);
  return User.create({ name: input.name, email, passwordHash, role: "teacher", isVerified: true, isActive: true });
}

export async function createTeacher(input: Record<string, unknown>): Promise<ITeacherProfile> {
  if (await TeacherProfile.findOne({ employeeId: String(input.employeeId).toUpperCase() })) {
    throw new AppError(409, "EMPLOYEE_ID_TAKEN", "A teacher with this employee ID already exists");
  }
  const user = await resolveTeacherUser(input);
  if (await TeacherProfile.findOne({ user: user._id })) throw new AppError(409, "PROFILE_EXISTS", "This teacher account already has a profile");
  const data = clean(input);
  delete data.userId; delete data.name; delete data.email; delete data.password;
  return TeacherProfile.create({ ...data, user: user._id });
}

export async function listTeachers(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.isActive === "string" && query.isActive) filter.isActive = query.isActive === "true";
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    const users = await User.find({ role: "teacher", $or: [{ name: rx }, { email: rx }] }).select("_id").lean();
    filter.$or = [{ employeeId: rx }, { specialization: rx }, ...(users.length ? [{ user: { $in: users.map((u) => u._id) } }] : [])];
  }
  const [items, total] = await Promise.all([
    TeacherProfile.find(filter).populate(USER_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TeacherProfile.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getTeacher(id: string) {
  requireObjectId(id, "Teacher");
  const profile = await TeacherProfile.findById(id).populate(USER_POPULATE).lean();
  if (!profile) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher profile not found");
  return profile;
}

export async function updateTeacher(id: string, input: Record<string, unknown>): Promise<ITeacherProfile> {
  requireObjectId(id, "Teacher");
  const data = clean(input);
  const name = data.name; delete data.name;
  if (data.employeeId) {
    const clash = await TeacherProfile.findOne({ employeeId: data.employeeId, _id: { $ne: id } });
    if (clash) throw new AppError(409, "EMPLOYEE_ID_TAKEN", "Another teacher already has this employee ID");
  }
  const profile = await TeacherProfile.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!profile) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher profile not found");
  if (name) await User.findByIdAndUpdate(profile.user, { $set: { name } });
  return profile;
}
