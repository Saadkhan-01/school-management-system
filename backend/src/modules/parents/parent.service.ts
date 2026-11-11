import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { User } from "../users/user.model";
import { Student } from "../students/student.model";
import { ParentProfile, ParentStudent, type IParentProfile } from "./parent.model";

const SALT = 12;
const USER_POPULATE = { path: "user", select: "name email role isActive isVerified lastLoginAt createdAt" };

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = definedOnly(input);
  for (const [k, v] of Object.entries(out)) if (v === "") delete out[k];
  return out;
}

/** Resolve the parent account: existing userId (must be role parent) or a fresh verified account. */
async function resolveParentUser(input: Record<string, unknown>) {
  if (input.userId) {
    const u = await User.findById(String(input.userId));
    if (!u) throw new AppError(404, "USER_NOT_FOUND", "The linked user account was not found");
    if (u.role !== "parent") throw new AppError(422, "WRONG_ROLE", `Linked account has role '${u.role}' — a parent profile requires a parent account`);
    return u;
  }
  const email = String(input.email).toLowerCase();
  if (await User.findOne({ email })) throw new AppError(409, "EMAIL_TAKEN", "A user with this email already exists");
  const passwordHash = await bcrypt.hash(String(input.password), SALT);
  return User.create({ name: input.name, email, passwordHash, role: "parent", isVerified: true, isActive: true });
}

export async function createParent(input: Record<string, unknown>): Promise<IParentProfile> {
  const user = await resolveParentUser(input);
  const existing = await ParentProfile.findOne({ user: user._id });
  if (existing) throw new AppError(409, "PROFILE_EXISTS", "This parent account already has a profile");
  const data = clean(input);
  delete data.userId; delete data.name; delete data.email; delete data.password;
  return ParentProfile.create({ ...data, user: user._id });
}

export async function listParents(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  let userIds: string[] | null = null;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    const users = await User.find({ role: "parent", $or: [{ name: rx }, { email: rx }] }).select("_id").lean();
    userIds = users.map((u) => String(u._id));
    filter.$or = [{ phone: rx }, ...(userIds.length ? [{ user: { $in: userIds } }] : [])];
    if (!userIds.length && !query.search) delete filter.$or;
  }
  const [items, total] = await Promise.all([
    ParentProfile.find(filter).populate(USER_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ParentProfile.countDocuments(filter),
  ]);
  // Attach linked-children counts (verified links only count toward access, but show both honestly).
  const withCounts = await Promise.all(items.map(async (p) => {
    const links = await ParentStudent.countDocuments({ parentProfile: p._id });
    const verifiedLinks = await ParentStudent.countDocuments({ parentProfile: p._id, verified: true });
    return { ...p, linkedChildren: links, verifiedChildren: verifiedLinks };
  }));
  return { items: withCounts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getParent(id: string) {
  requireObjectId(id, "Parent");
  const profile = await ParentProfile.findById(id).populate(USER_POPULATE).lean();
  if (!profile) throw new AppError(404, "PARENT_NOT_FOUND", "Parent profile not found");
  const links = await ParentStudent.find({ parentProfile: id }).populate({ path: "student", select: "admissionNumber firstName lastName gender status" }).lean();
  return { ...profile, links };
}

export async function updateParent(id: string, input: Record<string, unknown>): Promise<IParentProfile> {
  requireObjectId(id, "Parent");
  const data = clean(input);
  const name = data.name; delete data.name;
  const profile = await ParentProfile.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!profile) throw new AppError(404, "PARENT_NOT_FOUND", "Parent profile not found");
  if (name) await User.findByIdAndUpdate(profile.user, { $set: { name } });
  return profile;
}

/* ---------------- Parent ↔ Student links (verified only grant access) ---------------- */

export async function linkStudent(parentProfileId: string, input: { studentId: string; relationship?: string; isPrimaryContact?: boolean; verified?: boolean }, actorId: string) {
  requireObjectId(parentProfileId, "Parent");
  requireObjectId(input.studentId, "Student");
  const profile = await ParentProfile.findById(parentProfileId);
  if (!profile) throw new AppError(404, "PARENT_NOT_FOUND", "Parent profile not found");
  const student = await Student.findById(input.studentId).select("_id").lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  const existing = await ParentStudent.findOne({ parentUser: profile.user, student: input.studentId });
  if (existing) throw new AppError(409, "LINK_EXISTS", "This parent is already linked to this student");
  const verified = input.verified ?? true; // Admin-created links are verified by the school (§4).
  return ParentStudent.create({
    parentUser: profile.user,
    parentProfile: profile._id,
    student: input.studentId,
    relationship: input.relationship || "Guardian",
    isPrimaryContact: input.isPrimaryContact ?? false,
    verified,
    verifiedBy: verified ? actorId : undefined,
    verifiedAt: verified ? new Date() : undefined,
  });
}

export async function listParentStudents(parentProfileId: string) {
  requireObjectId(parentProfileId, "Parent");
  const profile = await ParentProfile.findById(parentProfileId).select("_id").lean();
  if (!profile) throw new AppError(404, "PARENT_NOT_FOUND", "Parent profile not found");
  return ParentStudent.find({ parentProfile: parentProfileId })
    .populate({ path: "student", select: "admissionNumber firstName lastName gender status dateOfBirth" })
    .populate({ path: "parentUser", select: "name email" })
    .sort({ createdAt: -1 }).lean();
}

export async function unlinkStudent(parentProfileId: string, studentId: string) {
  requireObjectId(parentProfileId, "Parent");
  requireObjectId(studentId, "Student");
  const deleted = await ParentStudent.findOneAndDelete({ parentProfile: parentProfileId, student: studentId });
  if (!deleted) throw new AppError(404, "LINK_NOT_FOUND", "Parent–student link not found");
  return { deleted: true };
}

export async function setLinkVerified(parentProfileId: string, studentId: string, verified: boolean, actorId: string) {
  requireObjectId(parentProfileId, "Parent");
  requireObjectId(studentId, "Student");
  const link = await ParentStudent.findOneAndUpdate(
    { parentProfile: parentProfileId, student: studentId },
    { $set: { verified, verifiedBy: verified ? actorId : undefined, verifiedAt: verified ? new Date() : undefined } },
    { new: true },
  );
  if (!link) throw new AppError(404, "LINK_NOT_FOUND", "Parent–student link not found");
  return link;
}
