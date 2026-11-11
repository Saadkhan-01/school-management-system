import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { Enrollment } from "../enrollments/enrollment.model";
import { Attendance, normalizeDay, type AttendanceStatus } from "./attendance.model";
import { assertStudentVisible, assertTeacherAssigned, type Actor } from "../academic-scope";
import { logActivity } from "../audit/audit.service";
import { notify, userIdsForStudents } from "../notifications/notification.service";

/**
 * Attendance service (§9). Business rules enforced here (not just in the UI):
 *  - teachers may mark/correct ONLY classes they are assigned to
 *    (TeacherAssignment), Admin may mark any class;
 *  - every marked student must hold an ACTIVE enrollment in exactly that
 *    class/section/session — otherwise 422;
 *  - one record per student per day: pre-check + unique indexes → 409;
 *  - corrections append to editHistory (who/when/old→new), never overwrite;
 *  - reads are scope-checked per role (student own, parent verified-linked,
 *    teacher assigned, admin/principal full).
 */
const POPULATE = [
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "markedBy", select: "name email role" },
];

interface BulkInput { classId: string; sectionId: string; sessionId: string; date: Date; records: Array<{ studentId: string; status: AttendanceStatus; note?: string }> }

export async function bulkMark(actor: Actor, input: BulkInput) {
  await assertTeacherAssigned(actor, { schoolClass: input.classId, section: input.sectionId, session: input.sessionId });
  const day = normalizeDay(input.date);
  const studentIds = input.records.map((r) => r.studentId);
  const enrollments = await Enrollment.find({
    student: { $in: studentIds }, schoolClass: input.classId, section: input.sectionId, session: input.sessionId, status: "active",
  }).select("_id student").lean();
  const byStudent = new Map(enrollments.map((e) => [String(e.student), e]));
  const missing = studentIds.filter((id) => !byStudent.has(id));
  if (missing.length > 0) throw new AppError(422, "ENROLLMENT_MISMATCH", "Some students have no active enrollment in this class/section/session", { studentIds: missing });
  const existing = await Attendance.find({ student: { $in: studentIds }, date: day }).select("student").lean();
  if (existing.length > 0) throw new AppError(409, "ATTENDANCE_ALREADY_MARKED", "Attendance is already marked for this date for some students. Use the correction endpoint to change a status.", { studentIds: existing.map((e) => String(e.student)) });
  const now = new Date();
  const docs = input.records.map((r) => ({
    student: r.studentId, enrollment: byStudent.get(r.studentId)!._id,
    schoolClass: input.classId, section: input.sectionId, session: input.sessionId,
    date: day, status: r.status, note: r.note, markedBy: actor.id, markedAt: now, editHistory: [],
  }));
  try {
    const created = await Attendance.insertMany(docs, { ordered: true });
    // Phase 9 hook (§24): parents of students marked ABSENT are notified
    // (verified parent links only, via the resolver). Never throws.
    const absentIds = input.records.filter((r) => r.status === "absent").map((r) => r.studentId);
    if (absentIds.length > 0) {
      await notify({
        userIds: await userIdsForStudents(absentIds).catch(() => []),
        type: "student-absence", title: "Student absence recorded",
        body: `Your child was marked absent on ${day.toISOString().slice(0, 10)}. Please contact the school office if this is unexpected.`,
        createdBy: actor.id,
      });
    }
    return { date: day, count: created.length, records: created };
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "ATTENDANCE_ALREADY_MARKED", "Attendance is already marked for this date for some students");
    throw err;
  }
}

/** Roster for the marking screen: active enrollments + any attendance already recorded that day. */
export async function getRoster(actor: Actor, query: { classId: string; sectionId: string; sessionId: string; date?: Date }) {
  await assertTeacherAssigned(actor, { schoolClass: query.classId, section: query.sectionId, session: query.sessionId });
  const enrollments = await Enrollment.find({ schoolClass: query.classId, section: query.sectionId, session: query.sessionId, status: "active" })
    .populate({ path: "student", select: "admissionNumber firstName lastName gender status" }).sort({ createdAt: 1 }).lean();
  let marked: Record<string, string> = {};
  if (query.date) {
    const rows = await Attendance.find({ schoolClass: query.classId, section: query.sectionId, session: query.sessionId, date: normalizeDay(query.date) }).select("student status").lean();
    marked = Object.fromEntries(rows.map((r) => [String(r.student), r.status]));
  }
  return { enrollments, marked };
}

export async function getByClass(actor: Actor, query: { classId: string; sectionId: string; sessionId: string; date: Date }) {
  if (actor.role === "teacher") await assertTeacherAssigned(actor, { schoolClass: query.classId, section: query.sectionId, session: query.sessionId });
  if (actor.role !== "admin" && actor.role !== "principal" && actor.role !== "teacher") throw new AppError(403, "FORBIDDEN", "Class attendance is available to Admin, Principal and assigned teachers");
  const items = await Attendance.find({ schoolClass: query.classId, section: query.sectionId, session: query.sessionId, date: normalizeDay(query.date) })
    .populate(POPULATE).sort({ createdAt: 1 }).lean();
  return { date: normalizeDay(query.date), items };
}

export async function getStudentAttendance(actor: Actor, studentId: string, query: Record<string, unknown>) {
  requireObjectId(studentId, "Student");
  await assertStudentVisible(actor, studentId);
  const filter: Record<string, unknown> = { student: studentId };
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.from === "string" && query.from) filter.date = { ...((filter.date as object) ?? {}), $gte: normalizeDay(query.from) };
  if (typeof query.to === "string" && query.to) filter.date = { ...((filter.date as object) ?? {}), $lte: normalizeDay(query.to) };
  const { page, limit } = pageOptions(query);
  const [items, total] = await Promise.all([
    Attendance.find(filter).populate(POPULATE).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) }, summary: summarize(items as Array<{ status: AttendanceStatus }>) };
}

export async function correctAttendance(actor: Actor, id: string, input: { status: AttendanceStatus; note?: string }) {
  requireObjectId(id, "Attendance");
  const doc = await Attendance.findById(id);
  if (!doc) throw new AppError(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found");
  if (actor.role === "teacher") await assertTeacherAssigned(actor, { schoolClass: String(doc.schoolClass), section: String(doc.section), session: String(doc.session) });
  else if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only Admin or the assigned teacher may correct attendance");
  if (doc.status === input.status) return doc;
  const previousStatus = doc.status;
  doc.editHistory.push({ editedBy: actor.id as never, editedAt: new Date(), oldStatus: doc.status, newStatus: input.status, note: input.note });
  doc.status = input.status;
  if (input.note) doc.note = input.note;
  await doc.save();
  await logActivity({ actor, action: "attendance.correct", entityKind: "attendance", entityId: String(doc._id), summary: "Corrected an attendance record", metadata: { studentId: String(doc.student), oldStatus: previousStatus, newStatus: input.status } });
  return Attendance.findById(doc._id).populate(POPULATE).lean();
}

function summarize(rows: Array<{ status: AttendanceStatus }>) {
  const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) counts[r.status] += 1;
  const total = rows.length;
  const attended = counts.present + counts.late + counts.excused;
  return { total, counts, attendancePercentage: total === 0 ? null : Math.round((attended / total) * 10000) / 100 };
}

/**
 * Report (§9/§27): daily/weekly/monthly/date-range — the caller passes any
 * from/to range; percentages are computed from real Attendance records.
 * Per-student breakdown + whole-scope totals.
 */
export async function attendanceReport(actor: Actor, query: { sessionId: string; classId?: string; sectionId?: string; studentId?: string; from: Date; to: Date }) {
  const filter: Record<string, unknown> = { session: query.sessionId, date: { $gte: normalizeDay(query.from), $lte: normalizeDay(query.to) } };
  if (query.classId) filter.schoolClass = query.classId;
  if (query.sectionId) filter.section = query.sectionId;
  if (query.studentId) { await assertStudentVisible(actor, query.studentId); filter.student = query.studentId; }
  if (actor.role === "teacher") {
    if (query.classId && query.sectionId) await assertTeacherAssigned(actor, { schoolClass: query.classId, section: query.sectionId, session: query.sessionId });
    else {
      const { teacherAssignments } = await import("../academic-scope");
      const { assignments } = await teacherAssignments(actor.id);
      if (assignments.length === 0) throw new AppError(403, "FORBIDDEN", "You have no assigned classes");
      filter.$or = assignments.filter((a) => String(a.session) === query.sessionId).map((a) => ({ schoolClass: a.schoolClass, section: a.section }));
      if ((filter.$or as unknown[]).length === 0) throw new AppError(403, "FORBIDDEN", "You have no assigned classes in this session");
    }
  } else if (actor.role !== "admin" && actor.role !== "principal" && !query.studentId) {
    throw new AppError(403, "FORBIDDEN", "Class reports are available to Admin, Principal and assigned teachers");
  }
  const rows = await Attendance.find(filter).populate({ path: "student", select: "admissionNumber firstName lastName" }).sort({ date: 1 }).lean();
  const perStudent = new Map<string, { student: unknown; rows: Array<{ status: AttendanceStatus }> }>();
  for (const r of rows as Array<{ student: unknown; status: AttendanceStatus }>) {
    const key = String((r.student as { _id?: unknown })?._id ?? "unknown");
    if (!perStudent.has(key)) perStudent.set(key, { student: r.student, rows: [] });
    perStudent.get(key)!.rows.push(r);
  }
  return {
    from: normalizeDay(query.from), to: normalizeDay(query.to),
    overall: summarize(rows as Array<{ status: AttendanceStatus }>),
    students: [...perStudent.values()].map((s) => ({ student: s.student, ...summarize(s.rows) })),
  };
}

/**
 * Approved leave overlapping a date, for students in a class — the context a
 * teacher needs while marking attendance (§9). Student leave applications
 * live in the Leave module; imported lazily to avoid a module cycle.
 */
export async function approvedLeavesOn(actor: Actor, query: { date: Date; classId?: string; sectionId?: string; sessionId?: string }) {
  if (query.classId && query.sectionId && query.sessionId && actor.role === "teacher") {
    await assertTeacherAssigned(actor, { schoolClass: query.classId, section: query.sectionId, session: query.sessionId });
  }
  const { LeaveApplication } = await import("../leave/leave.model");
  const day = normalizeDay(query.date);
  const leaves = await LeaveApplication.find({ status: "approved", student: { $ne: null }, fromDate: { $lte: day }, toDate: { $gte: day } })
    .populate({ path: "student", select: "admissionNumber firstName lastName" }).lean();
  if (!query.classId) return leaves;
  const enrolled = await Enrollment.find({ schoolClass: query.classId, ...(query.sectionId ? { section: query.sectionId } : {}), ...(query.sessionId ? { session: query.sessionId } : {}), status: "active" }).select("student").lean();
  const ids = new Set(enrolled.map((e) => String(e.student)));
  return leaves.filter((l) => ids.has(String((l.student as { _id?: unknown })?._id ?? l.student)));
}
