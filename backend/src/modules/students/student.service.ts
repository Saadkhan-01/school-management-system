import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { nextAdmissionNumber } from "../../utils/admissionNumber";
import { escapeRegex, pageOptions } from "../website/website.service";
import type { UserRole } from "../users/user.model";
import { Student, type IStudent } from "./student.model";

/**
 * Student Management (§7, docs/permissions.md "Students CRUD"):
 *   Admin ● full · Principal ◐ read · Teacher ◐ assigned-classes read ·
 *   Student ◐ own record · Parent ◐ verified-linked children ·
 *   Librarian ◐ borrow read (limited fields) · Receptionist ◐ limited search.
 * Limited roles receive a reduced field set — no date of birth, guardian contact
 * details, address or notes — enforced here in the service, not by hiding UI.
 */
export const LIMITED_STUDENT_FIELDS = "admissionNumber firstName lastName gender status createdAt updatedAt";
const FULL_POPULATE = { path: "user", select: "name email role isActive" };

type Actor = { id: string; role: UserRole };
const LIMITED_ROLES: UserRole[] = ["receptionist", "librarian"];

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = definedOnly(input);
  for (const [k, v] of Object.entries(out)) if (v === "") delete out[k];
  if (typeof out.admissionNumber === "string") out.admissionNumber = out.admissionNumber.toUpperCase();
  return out;
}

/** Student ids the actor may see, or null for unrestricted (admin/principal/limited-search roles). */
async function scopedStudentIds(actor: Actor): Promise<string[] | null> {
  if (actor.role === "student") {
    const self = await Student.findOne({ user: actor.id }).select("_id").lean();
    return self ? [String(self._id)] : [];
  }
  if (actor.role === "parent") {
    const { ParentStudent } = await import("../parents/parent.model");
    const links = await ParentStudent.find({ parentUser: actor.id, verified: true }).select("student").lean();
    return links.map((l) => String(l.student));
  }
  if (actor.role === "teacher") {
    const { TeacherProfile } = await import("../teachers/teacher.model");
    const { TeacherAssignment } = await import("../academics/academic.models");
    const { Enrollment } = await import("../enrollments/enrollment.model");
    const profile = await TeacherProfile.findOne({ user: actor.id }).select("_id").lean();
    if (!profile) return [];
    const assignments = await TeacherAssignment.find({ teacher: profile._id }).select("schoolClass section session").lean();
    if (assignments.length === 0) return [];
    const enrollments = await Enrollment.find({
      status: "active",
      $or: assignments.map((a) => ({ schoolClass: a.schoolClass, section: a.section, session: a.session })),
    }).select("student").lean();
    return [...new Set(enrollments.map((e) => String(e.student)))];
  }
  return null;
}

export async function createStudent(input: Record<string, unknown>) {
  const data = clean(input);
  if (data.userId) { data.user = data.userId; delete data.userId; }
  // 1:1 guard (unique sparse index on Student.user is the backstop): a login
  // account already linked to a student record cannot front a second one.
  if (data.user) {
    const linked = await Student.findOne({ user: data.user }).select("_id admissionNumber").lean();
    if (linked) throw new AppError(409, "USER_ALREADY_LINKED", `This login account is already linked to student ${linked.admissionNumber}`, { studentId: String(linked._id) });
  }
  if (!data.admissionNumber) data.admissionNumber = await nextAdmissionNumber();
  // Collision-safe: the unique index is the guard; retry with a fresh sequence on 11000.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Student.create(data);
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        const key = JSON.stringify((err as { keyValue?: unknown }).keyValue ?? "");
        if (key.includes("admissionNumber") && !input.admissionNumber) { data.admissionNumber = await nextAdmissionNumber(); continue; }
        throw new AppError(409, "DUPLICATE_KEY", "A student with this admission number (or linked user) already exists", (err as { keyValue?: unknown }).keyValue);
      }
      throw err;
    }
  }
  throw new AppError(409, "DUPLICATE_KEY", "Could not generate a unique admission number after several attempts");
}

export async function listStudents(query: Record<string, unknown>, actor: Actor) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.gender === "string" && query.gender) filter.gender = query.gender;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    filter.$or = [{ firstName: rx }, { lastName: rx }, { admissionNumber: rx }, { guardianName: rx }, { guardianEmail: rx }];
  }
  const scoped = await scopedStudentIds(actor);
  if (scoped !== null) filter._id = { $in: scoped };
  const limited = LIMITED_ROLES.includes(actor.role);
  const q = Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  if (limited) q.select(LIMITED_STUDENT_FIELDS); else q.populate(FULL_POPULATE);
  const [items, total] = await Promise.all([q.lean(), Student.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) }, limited };
}

export async function getStudent(id: string, actor: Actor) {
  requireObjectId(id, "Student");
  const scoped = await scopedStudentIds(actor);
  if (scoped !== null && !scoped.includes(id)) throw new AppError(403, "FORBIDDEN", "This student record is outside your permitted scope");
  const limited = LIMITED_ROLES.includes(actor.role);
  const q = Student.findById(id);
  if (limited) q.select(LIMITED_STUDENT_FIELDS); else q.populate(FULL_POPULATE);
  const student = await q.lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  return student;
}

export async function updateStudent(id: string, input: Record<string, unknown>): Promise<IStudent> {
  requireObjectId(id, "Student");
  const data = clean(input);
  if (data.userId) { data.user = data.userId; delete data.userId; }
  if (data.user) {
    const linked = await Student.findOne({ user: data.user, _id: { $ne: id } }).select("_id admissionNumber").lean();
    if (linked) throw new AppError(409, "USER_ALREADY_LINKED", `This login account is already linked to student ${linked.admissionNumber}`, { studentId: String(linked._id) });
  }
  const student = await Student.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  return student;
}

/** Deactivation path (§7: prefer deactivation over delete for records with history). */
export async function setStudentStatus(id: string, status: IStudent["status"]): Promise<IStudent> {
  requireObjectId(id, "Student");
  const student = await Student.findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true });
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  return student;
}
