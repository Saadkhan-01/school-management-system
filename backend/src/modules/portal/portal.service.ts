import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { User, type UserRole } from "../users/user.model";
import { ParentProfile, ParentStudent } from "../parents/parent.model";
import { Student } from "../students/student.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { TeacherAssignment } from "../academics/academic.models";
import { Attendance, type AttendanceStatus } from "../attendance/attendance.model";
import { Assignment, Submission } from "../assignments/assignment.model";
import { Exam } from "../examinations/exam.model";
import { TimetableEntry } from "../timetable/timetable.model";
import { LeaveApplication } from "../leave/leave.model";
import { PublicContentItem, CONTENT_AUDIENCES, type ContentAudience, type ContentItemType } from "../website/contentItem.model";
import { activeEnrollmentFor, assertStudentVisible, ownStudent, type Actor } from "../academic-scope";

/**
 * Portal aggregates (§10 Student, §11 Parent, Phase 6).
 * These endpoints compose the Phase 5 scoped services' data into one response
 * per portal home, but they re-derive scope HERE from the shared scope layer
 * (modules/academic-scope.ts) — never from a client-supplied id:
 *  - student scope = the Student record whose `user` is the caller
 *    (ownStudent); no studentId is accepted from the client at all;
 *  - parent scope = VERIFIED ParentStudent links only
 *    (parentLinkedStudentIds / assertStudentVisible). An unverified link
 *    exposes NOTHING: the child does not appear in /parent/me, and asking for
 *    its summary returns 403 FORBIDDEN — the same code the scope layer uses
 *    everywhere else (documented in docs/api-documentation.md).
 * Attendance note: the Attendance model is class/day-level (one record per
 * student per day, no subject field), so subject-wise attendance cannot be
 * computed honestly — aggregates return `subjectWise: null` plus a note
 * instead of inventing per-subject numbers.
 */

const ENROLLMENT_POPULATE = [
  { path: "session", select: "name isCurrent startDate endDate" },
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
];
const ATTENDANCE_POPULATE = [
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
];
const TIMETABLE_POPULATE = [
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
  { path: "teacher", select: "employeeId", populate: { path: "user", select: "name" } },
  { path: "classroom", select: "name" },
  { path: "session", select: "name isCurrent" },
];
const EXAM_POPULATE = [
  { path: "session", select: "name isCurrent" },
  { path: "classes", select: "name" },
];

type Lean = Record<string, unknown>;

function summarizeAttendance(rows: Array<{ status: AttendanceStatus }>) {
  const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) counts[r.status] += 1;
  const total = rows.length;
  const attended = counts.present + counts.late + counts.excused;
  return { total, counts, attendancePercentage: total === 0 ? null : Math.round((attended / total) * 10000) / 100 };
}

async function populatedEnrollment(studentId: string) {
  const enr = await activeEnrollmentFor(studentId);
  if (!enr) return null;
  return Enrollment.findById(enr._id).populate(ENROLLMENT_POPULATE).lean() as Promise<Lean | null>;
}

async function attendanceBlock(studentId: string, sessionId?: string) {
  const filter: Record<string, unknown> = { student: studentId };
  if (sessionId) filter.session = sessionId;
  const [all, recent] = await Promise.all([
    Attendance.find(filter).select("status").lean(),
    Attendance.find(filter).populate(ATTENDANCE_POPULATE).sort({ date: -1 }).limit(10).lean(),
  ]);
  return {
    summary: summarizeAttendance(all as Array<{ status: AttendanceStatus }>),
    recent,
    subjectWise: null,
    subjectWiseNote: "Attendance is recorded per class per day (the Attendance model has no subject field), so subject-wise attendance is not available — the overall figures above are computed from the real day records.",
  };
}

async function subjectsAndTeachers(enrollment: Lean | null) {
  if (!enrollment) return { subjects: [] as unknown[], teachers: [] as unknown[] };
  const rows = await TeacherAssignment.find({
    schoolClass: enrollment.schoolClass, section: enrollment.section, session: enrollment.session,
  })
    .populate({ path: "subject", select: "name code" })
    .populate({ path: "teacher", select: "employeeId", populate: { path: "user", select: "name email" } })
    .lean();
  const bySubject = new Map<string, { subject: unknown; teachers: Array<{ teacherId: string; name: string | null; employeeId: string | null }> }>();
  const byTeacher = new Map<string, { teacherId: string; name: string | null; employeeId: string | null; subjects: string[] }>();
  for (const row of rows as unknown as Array<Lean>) {
    const subject = row.subject as Lean;
    const teacher = row.teacher as Lean;
    const teacherUser = (teacher?.user ?? null) as Lean | null;
    const tEntry = {
      teacherId: String(teacher?._id ?? ""),
      name: typeof teacherUser?.name === "string" ? teacherUser.name : null,
      employeeId: typeof teacher?.employeeId === "string" ? teacher.employeeId : null,
    };
    const sKey = String(subject?._id ?? "");
    if (!bySubject.has(sKey)) bySubject.set(sKey, { subject, teachers: [] });
    if (!bySubject.get(sKey)!.teachers.some((t) => t.teacherId === tEntry.teacherId)) bySubject.get(sKey)!.teachers.push(tEntry);
    if (!byTeacher.has(tEntry.teacherId)) byTeacher.set(tEntry.teacherId, { ...tEntry, subjects: [] });
    const subjectName = typeof subject?.name === "string" ? subject.name : null;
    if (subjectName && !byTeacher.get(tEntry.teacherId)!.subjects.includes(subjectName)) byTeacher.get(tEntry.teacherId)!.subjects.push(subjectName);
  }
  return { subjects: [...bySubject.values()], teachers: [...byTeacher.values()] };
}

async function publishedExamsFor(enrollment: Lean | null) {
  if (!enrollment) return [];
  const sessionId = String((enrollment.session as Lean)?._id ?? enrollment.session);
  const classId = String((enrollment.schoolClass as Lean)?._id ?? enrollment.schoolClass);
  return Exam.find({ session: sessionId, classes: classId, resultStatus: "published" })
    .populate(EXAM_POPULATE).sort({ publishedAt: -1, createdAt: -1 }).lean();
}

async function timetableFor(enrollment: Lean | null) {
  if (!enrollment) return [];
  const sessionId = String((enrollment.session as Lean)?._id ?? enrollment.session);
  const classId = String((enrollment.schoolClass as Lean)?._id ?? enrollment.schoolClass);
  const sectionId = String((enrollment.section as Lean)?._id ?? enrollment.section);
  return TimetableEntry.find({ session: sessionId, schoolClass: classId, section: sectionId })
    .populate(TIMETABLE_POPULATE).sort({ weekday: 1, periodNumber: 1 }).lean();
}

async function accountOf(userId: string) {
  const u = await User.findById(userId).lean();
  if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return { id: String(u._id), name: u.name, email: u.email, phone: u.phone ?? null, role: u.role };
}

/* ---------------- Student aggregate: GET /portal/student/me ---------------- */

export async function getStudentPortal(actor: Actor) {
  const self = await ownStudent(actor.id);
  if (!self) {
    throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your login yet. Ask the school office to link your account to your student record.");
  }
  const studentId = String(self._id);
  const enrollment = await populatedEnrollment(studentId);
  const sessionId = enrollment ? String((enrollment.session as Lean)?._id ?? enrollment.session) : undefined;
  const [{ subjects, teachers }, attendance, timetable, publishedExams] = await Promise.all([
    subjectsAndTeachers(enrollment),
    attendanceBlock(studentId, sessionId),
    timetableFor(enrollment),
    publishedExamsFor(enrollment),
  ]);

  let upcomingAssignments: unknown[] = [];
  let upcomingAssignmentsCount = 0;
  let pendingAssignmentsCount = 0;
  if (enrollment) {
    const classId = String((enrollment.schoolClass as Lean)?._id ?? enrollment.schoolClass);
    const sectionId = String((enrollment.section as Lean)?._id ?? enrollment.section);
    const filter = { schoolClass: classId, section: sectionId, session: sessionId, deadline: { $gte: new Date() } };
    const [list, count] = await Promise.all([
      Assignment.find(filter)
        .populate({ path: "subject", select: "name code" })
        .populate({ path: "teacher", select: "employeeId", populate: { path: "user", select: "name" } })
        .sort({ deadline: 1 }).limit(10).lean(),
      Assignment.countDocuments(filter),
    ]);
    upcomingAssignments = list;
    upcomingAssignmentsCount = count;
    // Pending = upcoming assignments (ALL of them, not just the listed page) with no submission yet.
    const allUpcomingIds = await Assignment.find(filter).select("_id").lean();
    const submittedCount = await Submission.countDocuments({ student: studentId, assignment: { $in: allUpcomingIds.map((a) => a._id) } });
    pendingAssignmentsCount = Math.max(0, count - submittedCount);
  }

  return {
    account: await accountOf(actor.id),
    student: {
      id: studentId,
      admissionNumber: self.admissionNumber,
      firstName: self.firstName,
      lastName: self.lastName,
      fullName: `${self.firstName} ${self.lastName}`.trim(),
      dateOfBirth: self.dateOfBirth,
      gender: self.gender,
      bloodGroup: self.bloodGroup ?? null,
      photoUrl: self.photoUrl ?? null,
      email: self.email ?? null,
      phone: self.phone ?? null,
      status: self.status,
    },
    enrollment,
    subjects,
    teachers,
    attendance,
    assignments: { upcomingCount: upcomingAssignmentsCount, pendingCount: pendingAssignmentsCount, upcoming: upcomingAssignments },
    publishedExams,
    timetable,
  };
}

/* ---------------- Parent aggregates: GET /portal/parent/me + child summary ---------------- */

export async function getParentPortal(actor: Actor) {
  const [account, profile, links] = await Promise.all([
    accountOf(actor.id),
    ParentProfile.findOne({ user: actor.id }).lean(),
    ParentStudent.find({ parentUser: actor.id }).lean(),
  ]);
  const verifiedLinks = links.filter((l) => l.verified);
  const unverifiedCount = links.length - verifiedLinks.length;
  const children = [];
  for (const link of verifiedLinks) {
    const student = await Student.findById(link.student).select("admissionNumber firstName lastName status").lean();
    if (!student) continue; // a dangling link exposes nothing
    const enrollment = await populatedEnrollment(String(student._id));
    children.push({
      studentId: String(student._id),
      name: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber: student.admissionNumber,
      status: student.status,
      relationship: link.relationship,
      isPrimaryContact: link.isPrimaryContact,
      enrollment,
    });
  }
  return {
    account,
    profile: profile ? {
      phone: profile.phone ?? null, alternatePhone: profile.alternatePhone ?? null,
      address: profile.address ?? null, city: profile.city ?? null,
      occupation: profile.occupation ?? null, relationNote: profile.relationNote ?? null,
    } : null,
    children,
    unverifiedLinks: {
      count: unverifiedCount,
      note: unverifiedCount > 0
        ? "Some links are not verified yet. Unverified links expose no child data at all — the school office verifies links before anything becomes visible."
        : null,
    },
  };
}

/**
 * Per-child summary. Scope gate FIRST: assertStudentVisible throws 403
 * FORBIDDEN unless a VERIFIED ParentStudent link exists for (parent, child) —
 * the scope layer's existing convention (403, not 404), applied identically by
 * attendance/assignments/results. Nothing about the child is read before it.
 */
export async function getChildSummary(actor: Actor, studentId: string) {
  requireObjectId(studentId, "Student");
  await assertStudentVisible(actor, studentId);
  const student = await Student.findById(studentId).lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  const enrollment = await populatedEnrollment(studentId);
  const sessionId = enrollment ? String((enrollment.session as Lean)?._id ?? enrollment.session) : undefined;
  const [attendance, timetable, publishedExams] = await Promise.all([
    attendanceBlock(studentId, sessionId),
    timetableFor(enrollment),
    publishedExamsFor(enrollment),
  ]);

  let assignments: unknown[] = [];
  let pendingAssignmentsCount = 0;
  if (enrollment) {
    const classId = String((enrollment.schoolClass as Lean)?._id ?? enrollment.schoolClass);
    const sectionId = String((enrollment.section as Lean)?._id ?? enrollment.section);
    const list = await Assignment.find({ schoolClass: classId, section: sectionId, session: sessionId })
      .populate({ path: "subject", select: "name code" })
      .populate({ path: "teacher", select: "employeeId", populate: { path: "user", select: "name" } })
      .sort({ deadline: -1 }).limit(50).lean() as unknown as Array<Lean>;
    const subs = await Submission.find({ student: studentId, assignment: { $in: list.map((a) => a._id) } }).lean();
    const subByAssignment = new Map(subs.map((s) => [String(s.assignment), s as unknown as Lean]));
    assignments = list.map((a) => {
      const sub = subByAssignment.get(String(a._id)) ?? null;
      let submission: Lean | null = null;
      if (sub) {
        submission = { id: String(sub._id), status: sub.status, isLate: sub.isLate, submittedAt: sub.submittedAt };
        // Published-feedback rule (§20), same as the assignments service: marks/feedback only when feedbackPublished.
        if (sub.feedbackPublished === true) {
          submission.marks = sub.marks ?? null;
          submission.feedback = sub.feedback ?? null;
          submission.feedbackPublished = true;
        } else {
          submission.feedbackPublished = false;
          submission.feedbackNote = "Feedback has not been published by the teacher yet";
        }
      }
      if (!submission) pendingAssignmentsCount += 1;
      return { ...a, submission, isPending: !submission };
    });
  }

  const leaves = await LeaveApplication.find({ applicantUser: actor.id, student: studentId })
    .sort({ createdAt: -1 }).limit(10).lean();

  return {
    student: {
      id: studentId,
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      status: student.status,
    },
    enrollment,
    attendance,
    publishedExams,
    assignments: { items: assignments, pendingCount: pendingAssignmentsCount },
    timetable,
    leaves,
  };
}

/* ---------------- Announcements for logged-in users (§23) ---------------- */

/**
 * Which PublicContentItem audiences a role may see in the portal. Pure and
 * exported so the rule is testable without a database:
 *  - everyone signed in sees `public` + `all`;
 *  - `students` / `parents` reach ONLY that role;
 *  - `staff` reaches school staff roles (teacher, principal, accountant,
 *    librarian, receptionist) and Admin;
 *  - role-targeted items (`students`, `parents`, `teachers`) NEVER reach
 *    other roles — e.g. a `parents` announcement is invisible to students.
 */
export function audiencesForRole(role: UserRole): ContentAudience[] {
  switch (role) {
    case "admin":
      return [...CONTENT_AUDIENCES];
    case "principal":
      return ["public", "all", "staff", "teachers", "students", "parents"];
    case "student":
      return ["public", "all", "students"];
    case "parent":
      return ["public", "all", "parents"];
    case "teacher":
      return ["public", "all", "teachers", "staff"];
    default:
      return ["public", "all", "staff"];
  }
}

export async function listPortalAnnouncements(actor: Actor, type: ContentItemType = "announcement") {
  const audiences = audiencesForRole(actor.role);
  const now = new Date();
  const items = await PublicContentItem.find({
    type,
    status: "published",
    audience: { $in: audiences },
    $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }],
  }).sort({ isFeatured: -1, publishAt: -1, createdAt: -1 }).limit(100).lean();
  return { items, audiences, role: actor.role };
}
