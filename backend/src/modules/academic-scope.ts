import { AppError } from "../utils/AppError";
import type { UserRole } from "./users/user.model";
import { TeacherProfile } from "./teachers/teacher.model";
import { TeacherAssignment } from "./academics/academic.models";
import { ParentStudent } from "./parents/parent.model";
import { Student } from "./students/student.model";
import { Enrollment } from "./enrollments/enrollment.model";

/**
 * Phase 5 shared ownership-scope helpers (§4, docs/permissions.md).
 * Every Phase 5 service resolves the caller's scope through these functions so
 * changing an ID in a URL never grants access:
 *  - teacher scope = TeacherAssignment rows for the caller's TeacherProfile;
 *  - parent scope  = verified ParentStudent links only;
 *  - student scope = the Student record whose `user` is the caller.
 */
export type Actor = { id: string; role: UserRole };

export async function getTeacherProfile(userId: string) {
  return TeacherProfile.findOne({ user: userId }).lean();
}

export async function requireTeacherProfile(userId: string) {
  const profile = await getTeacherProfile(userId);
  if (!profile) throw new AppError(403, "FORBIDDEN", "No teacher profile is linked to your account");
  return profile;
}

export interface ClassKey { schoolClass: string; section: string; session: string; subject?: string }

export async function teacherAssignments(userId: string) {
  const profile = await getTeacherProfile(userId);
  if (!profile) return { profile: null, assignments: [] as Array<{ schoolClass: unknown; section: unknown; session: unknown; subject: unknown }> };
  const assignments = await TeacherAssignment.find({ teacher: profile._id }).lean();
  return { profile, assignments };
}

/** Throws 403 unless the teacher is assigned to the given class/section/session (and subject, when supplied). Admin bypasses. */
export async function assertTeacherAssigned(actor: Actor, key: ClassKey) {
  if (actor.role === "admin") return;
  if (actor.role !== "teacher") throw new AppError(403, "FORBIDDEN", "Only teachers (or Admin) may perform this action");
  const { assignments } = await teacherAssignments(actor.id);
  const ok = assignments.some((a) =>
    String(a.schoolClass) === key.schoolClass && String(a.section) === key.section && String(a.session) === key.session &&
    (key.subject ? String(a.subject) === key.subject : true));
  if (!ok) throw new AppError(403, "FORBIDDEN", "You are not assigned to this class/section/subject");
}

export async function parentLinkedStudentIds(userId: string): Promise<string[]> {
  const links = await ParentStudent.find({ parentUser: userId, verified: true }).select("student").lean();
  return links.map((l) => String(l.student));
}

export async function ownStudent(userId: string) {
  return Student.findOne({ user: userId }).lean();
}

/**
 * Can the actor see this student's academic records?
 * admin/principal: yes · student: own record · parent: verified link ·
 * teacher: the student has an enrollment inside the teacher's assigned
 * class/section/session combinations. Throws 403 otherwise.
 */
export async function assertStudentVisible(actor: Actor, studentId: string) {
  if (actor.role === "admin" || actor.role === "principal") return;
  if (actor.role === "student") {
    const self = await ownStudent(actor.id);
    if (self && String(self._id) === studentId) return;
    throw new AppError(403, "FORBIDDEN", "You can only access your own records");
  }
  if (actor.role === "parent") {
    const ids = await parentLinkedStudentIds(actor.id);
    if (ids.includes(studentId)) return;
    throw new AppError(403, "FORBIDDEN", "This student is not linked to your account");
  }
  if (actor.role === "teacher") {
    const { assignments } = await teacherAssignments(actor.id);
    if (assignments.length > 0) {
      const hit = await Enrollment.findOne({
        student: studentId,
        $or: assignments.map((a) => ({ schoolClass: a.schoolClass, section: a.section, session: a.session })),
      }).select("_id").lean();
      if (hit) return;
    }
    throw new AppError(403, "FORBIDDEN", "This student is outside your assigned classes");
  }
  throw new AppError(403, "FORBIDDEN", "Your role cannot access student academic records");
}

/** Active enrollment of a student in a session (or their latest active enrollment when no session is given). */
export async function activeEnrollmentFor(studentId: string, sessionId?: string) {
  const filter: Record<string, unknown> = { student: studentId, status: "active" };
  if (sessionId) filter.session = sessionId;
  return Enrollment.findOne(filter).sort({ createdAt: -1 }).lean();
}
