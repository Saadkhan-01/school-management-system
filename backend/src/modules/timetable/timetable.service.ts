import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { AcademicSession, Classroom, SchoolClass, Section, Subject } from "../academics/academic.models";
import { TeacherProfile } from "../teachers/teacher.model";
import { TimetableEntry, type Weekday } from "./timetable.model";
import { activeEnrollmentFor, assertStudentVisible, assertTeacherAssigned, type Actor } from "../academic-scope";

/**
 * Timetable service (§18). Conflict validation runs on every create/update:
 *  - teacher double-booked (same session+weekday, overlapping time) → 409 TIMETABLE_TEACHER_CONFLICT
 *  - classroom double-booked → 409 TIMETABLE_CLASSROOM_CONFLICT
 *  - duplicate class-period (class+section already has that period) → 409 TIMETABLE_CLASS_PERIOD_CONFLICT
 * Unique indexes in the model back these checks at the database level.
 * Writes: Admin only (Principal reads/approves per permissions matrix — the
 * read endpoints include Principal; there is no separate draft state, noted
 * in the feature tracker). Reads are scoped per role.
 */
const POPULATE = [
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
  { path: "teacher", select: "employeeId", populate: { path: "user", select: "name email" } },
  { path: "classroom", select: "name" },
  { path: "session", select: "name isCurrent" },
];

export interface EntryInput {
  sessionId: string; classId: string; sectionId: string; subjectId: string; teacherId: string;
  classroomId?: string; weekday: Weekday; periodNumber: number; startTime: string; endTime: string;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

async function validateRefs(input: Partial<EntryInput>) {
  const checks: Array<Promise<unknown>> = [];
  if (input.sessionId) checks.push(AcademicSession.findById(input.sessionId).select("_id").lean().then((d) => { if (!d) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found"); }));
  if (input.classId) checks.push(SchoolClass.findById(input.classId).select("_id session").lean().then((d) => { if (!d) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found"); }));
  if (input.sectionId) checks.push(Section.findById(input.sectionId).select("_id schoolClass").lean().then((d) => { if (!d) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found"); }));
  if (input.subjectId) checks.push(Subject.findById(input.subjectId).select("_id").lean().then((d) => { if (!d) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found"); }));
  if (input.teacherId) checks.push(TeacherProfile.findById(input.teacherId).select("_id").lean().then((d) => { if (!d) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher profile not found"); }));
  if (input.classroomId) checks.push(Classroom.findById(input.classroomId).select("_id").lean().then((d) => { if (!d) throw new AppError(404, "CLASSROOM_NOT_FOUND", "Classroom not found"); }));
  await Promise.all(checks);
}

async function checkConflicts(candidate: { session: string; schoolClass: string; section: string; teacher: string; classroom?: string; weekday: string; periodNumber: number; startTime: string; endTime: string }, excludeId?: string) {
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  const classPeriod = await TimetableEntry.findOne({ ...ne, session: candidate.session, schoolClass: candidate.schoolClass, section: candidate.section, weekday: candidate.weekday, periodNumber: candidate.periodNumber }).lean();
  if (classPeriod) throw new AppError(409, "TIMETABLE_CLASS_PERIOD_CONFLICT", `This class/section already has a period ${candidate.periodNumber} on ${candidate.weekday}`);
  const teacherRows = await TimetableEntry.find({ ...ne, session: candidate.session, teacher: candidate.teacher, weekday: candidate.weekday }).lean();
  if (teacherRows.some((t) => overlaps(candidate.startTime, candidate.endTime, t.startTime, t.endTime))) {
    throw new AppError(409, "TIMETABLE_TEACHER_CONFLICT", "The teacher is already scheduled at this time on this weekday (double-booked)");
  }
  if (candidate.classroom) {
    const roomRows = await TimetableEntry.find({ ...ne, session: candidate.session, classroom: candidate.classroom, weekday: candidate.weekday }).lean();
    if (roomRows.some((t) => overlaps(candidate.startTime, candidate.endTime, t.startTime, t.endTime))) {
      throw new AppError(409, "TIMETABLE_CLASSROOM_CONFLICT", "The classroom is already booked at this time on this weekday");
    }
  }
}

function toDoc(input: EntryInput) {
  return {
    session: input.sessionId, schoolClass: input.classId, section: input.sectionId, subject: input.subjectId,
    teacher: input.teacherId, classroom: input.classroomId, weekday: input.weekday,
    periodNumber: input.periodNumber, startTime: input.startTime, endTime: input.endTime,
  };
}

export async function createEntry(input: EntryInput) {
  await validateRefs(input);
  const cls = await SchoolClass.findById(input.classId).select("session").lean();
  if (cls && String(cls.session) !== input.sessionId) throw new AppError(422, "CLASS_SESSION_MISMATCH", "The selected class does not belong to the selected session");
  const sec = await Section.findById(input.sectionId).select("schoolClass").lean();
  if (sec && String(sec.schoolClass) !== input.classId) throw new AppError(422, "SECTION_CLASS_MISMATCH", "The selected section does not belong to the selected class");
  const doc = toDoc(input);
  await checkConflicts(doc as never);
  try {
    const created = await TimetableEntry.create(doc);
    return TimetableEntry.findById(created._id).populate(POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "TIMETABLE_CONFLICT", "This entry conflicts with an existing timetable entry (teacher, classroom or class period)");
    throw err;
  }
}

export async function updateEntry(id: string, input: Partial<EntryInput>) {
  requireObjectId(id, "Timetable entry");
  const existing = await TimetableEntry.findById(id).lean();
  if (!existing) throw new AppError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Timetable entry not found");
  await validateRefs(input);
  const merged = {
    session: input.sessionId ?? String(existing.session),
    schoolClass: input.classId ?? String(existing.schoolClass),
    section: input.sectionId ?? String(existing.section),
    subject: input.subjectId ?? String(existing.subject),
    teacher: input.teacherId ?? String(existing.teacher),
    classroom: input.classroomId ?? (existing.classroom ? String(existing.classroom) : undefined),
    weekday: input.weekday ?? existing.weekday,
    periodNumber: input.periodNumber ?? existing.periodNumber,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
  };
  if (merged.endTime <= merged.startTime) throw new AppError(422, "VALIDATION_ERROR", "endTime must be after startTime");
  await checkConflicts(merged as never, id);
  const set = definedOnly({
    session: input.sessionId, schoolClass: input.classId, section: input.sectionId, subject: input.subjectId,
    teacher: input.teacherId, classroom: input.classroomId, weekday: input.weekday,
    periodNumber: input.periodNumber, startTime: input.startTime, endTime: input.endTime,
  });
  try {
    return await TimetableEntry.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).populate(POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "TIMETABLE_CONFLICT", "This change conflicts with an existing timetable entry");
    throw err;
  }
}

export async function deleteEntry(id: string) {
  requireObjectId(id, "Timetable entry");
  const doc = await TimetableEntry.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Timetable entry not found");
  return { deleted: true };
}

export async function listEntries(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (typeof query.sectionId === "string" && query.sectionId) filter.section = query.sectionId;
  if (typeof query.teacherId === "string" && query.teacherId) filter.teacher = query.teacherId;
  if (typeof query.classroomId === "string" && query.classroomId) filter.classroom = query.classroomId;
  if (typeof query.weekday === "string" && query.weekday) filter.weekday = query.weekday;
  if (actor.role === "teacher") {
    // Teachers see entries for their assigned classes plus their own teaching entries.
    const { teacherAssignments } = await import("../academic-scope");
    const { profile, assignments } = await teacherAssignments(actor.id);
    const or: Record<string, unknown>[] = [];
    if (profile) or.push({ teacher: profile._id });
    for (const a of assignments) or.push({ schoolClass: a.schoolClass, section: a.section, session: a.session });
    if (or.length === 0) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    filter.$and = [{ $or: or }];
  }
  if (actor.role === "student" || actor.role === "parent") {
    throw new AppError(403, "FORBIDDEN", "Use the by-student timetable endpoint so scope can be verified");
  }
  const [items, total] = await Promise.all([
    TimetableEntry.find(filter).populate(POPULATE).sort({ weekday: 1, periodNumber: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    TimetableEntry.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getEntry(actor: Actor, id: string) {
  requireObjectId(id, "Timetable entry");
  const doc = await TimetableEntry.findById(id).populate(POPULATE).lean();
  if (!doc) throw new AppError(404, "TIMETABLE_ENTRY_NOT_FOUND", "Timetable entry not found");
  if (actor.role === "teacher") {
    const { getTeacherProfile } = await import("../academic-scope");
    const profile = await getTeacherProfile(actor.id);
    if (!profile || String(doc.teacher) !== String(profile._id)) {
      await assertTeacherAssigned(actor, { schoolClass: String(doc.schoolClass), section: String(doc.section), session: String(doc.session) });
    }
  }
  return doc;
}

/** Student timetable: resolved through the student's own active enrollment; parents must be verified-linked. */
export async function byStudent(actor: Actor, studentId: string, sessionId?: string) {
  requireObjectId(studentId, "Student");
  await assertStudentVisible(actor, studentId);
  const enrollment = await activeEnrollmentFor(studentId, sessionId);
  if (!enrollment) return { enrollment: null, entries: [] };
  const entries = await TimetableEntry.find({ session: enrollment.session, schoolClass: enrollment.schoolClass, section: enrollment.section })
    .populate(POPULATE).sort({ weekday: 1, periodNumber: 1 }).lean();
  return { enrollment, entries };
}

export async function byTeacher(actor: Actor, teacherProfileId: string, sessionId?: string) {
  requireObjectId(teacherProfileId, "Teacher");
  if (actor.role === "teacher") {
    const { getTeacherProfile } = await import("../academic-scope");
    const profile = await getTeacherProfile(actor.id);
    if (!profile || String(profile._id) !== teacherProfileId) throw new AppError(403, "FORBIDDEN", "You can only view your own timetable");
  } else if (actor.role !== "admin" && actor.role !== "principal") {
    throw new AppError(403, "FORBIDDEN", "Teacher timetables are available to Admin, Principal and the teacher");
  }
  const filter: Record<string, unknown> = { teacher: teacherProfileId };
  if (sessionId) filter.session = sessionId;
  return TimetableEntry.find(filter).populate(POPULATE).sort({ weekday: 1, periodNumber: 1 }).lean();
}
