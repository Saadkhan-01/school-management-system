import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { User, type UserRole } from "../users/user.model";
import { StaffProfile, type IStaffProfile } from "./staff.model";

const SALT = 12;
const USER_POPULATE = { path: "user", select: "name email role isActive isVerified lastLoginAt createdAt" };

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = definedOnly(input);
  for (const [k, v] of Object.entries(out)) if (v === "") delete out[k];
  if (typeof out.employeeId === "string") out.employeeId = out.employeeId.toUpperCase();
  return out;
}

async function resolveStaffUser(input: Record<string, unknown>) {
  if (input.userId) {
    const u = await User.findById(String(input.userId));
    if (!u) throw new AppError(404, "USER_NOT_FOUND", "The linked user account was not found");
    if (u.role === "student" || u.role === "parent") throw new AppError(422, "WRONG_ROLE", "Students and parents cannot hold a staff profile");
    return u;
  }
  const email = String(input.email).toLowerCase();
  if (await User.findOne({ email })) throw new AppError(409, "EMAIL_TAKEN", "A user with this email already exists");
  const passwordHash = await bcrypt.hash(String(input.password), SALT);
  const role = (typeof input.role === "string" ? input.role : "receptionist") as UserRole;
  return User.create({ name: input.name, email, passwordHash, role, isVerified: true, isActive: true });
}

export async function createStaff(input: Record<string, unknown>): Promise<IStaffProfile> {
  if (await StaffProfile.findOne({ employeeId: String(input.employeeId).toUpperCase() })) {
    throw new AppError(409, "EMPLOYEE_ID_TAKEN", "A staff record with this employee ID already exists");
  }
  const user = await resolveStaffUser(input);
  if (await StaffProfile.findOne({ user: user._id })) throw new AppError(409, "PROFILE_EXISTS", "This account already has a staff profile");
  const data = clean(input);
  delete data.userId; delete data.name; delete data.email; delete data.password; delete data.role;
  return StaffProfile.create({ ...data, user: user._id });
}

export async function listStaff(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.department === "string" && query.department) filter.department = { $regex: escapeRegex(query.department), $options: "i" };
  if (typeof query.employmentStatus === "string" && query.employmentStatus) filter.employmentStatus = query.employmentStatus;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").lean();
    filter.$or = [{ employeeId: rx }, { department: rx }, { designation: rx }, ...(users.length ? [{ user: { $in: users.map((u) => u._id) } }] : [])];
  }
  const [items, total] = await Promise.all([
    StaffProfile.find(filter).populate(USER_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StaffProfile.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getStaff(id: string) {
  requireObjectId(id, "Staff");
  const profile = await StaffProfile.findById(id).populate(USER_POPULATE).lean();
  if (!profile) throw new AppError(404, "STAFF_NOT_FOUND", "Staff profile not found");
  return profile;
}

export async function updateStaff(id: string, input: Record<string, unknown>): Promise<IStaffProfile> {
  requireObjectId(id, "Staff");
  const data = clean(input);
  const name = data.name; delete data.name;
  if (data.employeeId) {
    const clash = await StaffProfile.findOne({ employeeId: data.employeeId, _id: { $ne: id } });
    if (clash) throw new AppError(409, "EMPLOYEE_ID_TAKEN", "Another staff record already has this employee ID");
  }
  const profile = await StaffProfile.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!profile) throw new AppError(404, "STAFF_NOT_FOUND", "Staff profile not found");
  if (name) await User.findByIdAndUpdate(profile.user, { $set: { name } });
  return profile;
}
