import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { AcademicSession, GradingScale, SchoolClass, Section, Subject } from "../academics/academic.models";
import { Enrollment } from "../enrollments/enrollment.model";
import { Exam, ExamSchedule, type IExam } from "./exam.model";
import { Mark } from "./marks.model";
import { assertTeacherAssigned, type Actor } from "../academic-scope";
import { notify, userIdsForExamClasses } from "../notifications/notification.service";
import { logActivity } from "../audit/audit.service";

/**
 * Examinations + Marks + Results service (§19).
 * Workflow: Admin creates exam + schedules → teachers enter marks for
 * ASSIGNED subjects/classes only (403 otherwise), marks ≤ maxMarks (422) →
 * Admin/Principal approve → Admin/Principal publish. Unpublished results are
 * invisible to students/parents (404 RESULT_NOT_PUBLISHED in results fns).
 */
const EXAM_POPULATE = [
  { path: "session", select: "name isCurrent" },
  { path: "classes", select: "name" },
  { path: "gradingScale", select: "name isDefault" },
];
const SCHEDULE_POPULATE = [
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
];

async function mustExam(id: string): Promise<IExam> {
  requireObjectId(id, "Exam");
  const exam = await Exam.findById(id);
  if (!exam) throw new AppError(404, "EXAM_NOT_FOUND", "Exam not found");
  return exam;
}

export async function createExam(input: Record<string, unknown>) {
  const session = await AcademicSession.findById(String(input.sessionId)).select("_id").lean();
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  const classIds = (input.classIds as string[]) ?? [];
  const classes = await SchoolClass.find({ _id: { $in: classIds } }).select("_id session").lean();
  if (classes.length !== classIds.length) throw new AppError(404, "CLASS_NOT_FOUND", "One or more classes were not found");
  if (classes.some((c) => String(c.session) !== String(input.sessionId))) throw new AppError(422, "CLASS_SESSION_MISMATCH", "All classes must belong to the exam session");
  if (input.gradingScaleId) {
    const scale = await GradingScale.findById(String(input.gradingScaleId)).select("_id").lean();
    if (!scale) throw new AppError(404, "GRADING_SCALE_NOT_FOUND", "Grading scale not found");
  }
  const doc = await Exam.create({
    name: input.name, type: input.type, session: input.sessionId, classes: classIds,
    startDate: input.startDate, endDate: input.endDate, status: input.status ?? "draft",
    gradingScale: input.gradingScaleId, allowPositions: input.allowPositions ?? false,
  });
  return Exam.findById(doc._id).populate(EXAM_POPULATE).lean();
}

export async function listExams(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.resultStatus === "string" && query.resultStatus) filter.resultStatus = query.resultStatus;
  const [items, total] = await Promise.all([
    Exam.find(filter).populate(EXAM_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Exam.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getExam(id: string) {
  const exam = await mustExam(id);
  return Exam.findById(exam._id).populate(EXAM_POPULATE).lean();
}

export async function updateExam(id: string, input: Record<string, unknown>) {
  const exam = await mustExam(id);
  if (exam.resultStatus === "published") throw new AppError(409, "RESULT_PUBLISHED_LOCKED", "Results for this exam are published; exam configuration is locked");
  const data = definedOnly(input as Record<string, unknown>);
  const patch: Record<string, unknown> = { ...data };
  if (data.classIds) {
    const ids = data.classIds as string[];
    const classes = await SchoolClass.find({ _id: { $in: ids } }).select("_id session").lean();
    if (classes.length !== ids.length) throw new AppError(404, "CLASS_NOT_FOUND", "One or more classes were not found");
    if (classes.some((c) => String(c.session) !== String(exam.session))) throw new AppError(422, "CLASS_SESSION_MISMATCH", "All classes must belong to the exam session");
    patch.classes = ids; delete patch.classIds;
  }
  if (data.gradingScaleId) { patch.gradingScale = data.gradingScaleId; delete patch.gradingScaleId; }
  const doc = await Exam.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
  return Exam.findById(doc!._id).populate(EXAM_POPULATE).lean();
}

export async function addSchedule(examId: string, input: { classId: string; sectionId?: string; subjectId: string; date: Date; startTime?: string; endTime?: string; maxMarks: number }) {
  const exam = await mustExam(examId);
  if (exam.resultStatus === "published") throw new AppError(409, "RESULT_PUBLISHED_LOCKED", "Results are published; schedules are locked");
  if (!exam.classes.map(String).includes(input.classId)) throw new AppError(422, "EXAM_CLASS_MISMATCH", "This class is not part of the exam. Add it to the exam first.");
  const subject = await Subject.findById(input.subjectId).select("_id session").lean();
  if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  if (String(subject.session) !== String(exam.session)) throw new AppError(422, "SUBJECT_SESSION_MISMATCH", "The subject does not belong to the exam session");
  if (input.sectionId) {
    const section = await Section.findById(input.sectionId).select("_id schoolClass").lean();
    if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
    if (String(section.schoolClass) !== input.classId) throw new AppError(422, "SECTION_CLASS_MISMATCH", "The selected section does not belong to the selected class");
  }
  const clash = await ExamSchedule.findOne({ exam: exam._id, schoolClass: input.classId, section: input.sectionId ?? null, subject: input.subjectId });
  if (clash) throw new AppError(409, "SCHEDULE_EXISTS", "A schedule already exists for this exam/class/section/subject");
  try {
    const doc = await ExamSchedule.create({ exam: exam._id, schoolClass: input.classId, section: input.sectionId, subject: input.subjectId, date: input.date, startTime: input.startTime, endTime: input.endTime, maxMarks: input.maxMarks });
    return ExamSchedule.findById(doc._id).populate(SCHEDULE_POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "SCHEDULE_EXISTS", "A schedule already exists for this exam/class/section/subject");
    throw err;
  }
}

export async function listSchedules(examId: string) {
  await mustExam(examId);
  return ExamSchedule.find({ exam: examId }).populate(SCHEDULE_POPULATE).sort({ date: 1 }).lean();
}

export async function deleteSchedule(examId: string, scheduleId: string) {
  const exam = await mustExam(examId);
  if (exam.resultStatus === "published") throw new AppError(409, "RESULT_PUBLISHED_LOCKED", "Results are published; schedules are locked");
  requireObjectId(scheduleId, "Exam schedule");
  const marks = await Mark.countDocuments({ examSchedule: scheduleId });
  if (marks > 0) throw new AppError(409, "SCHEDULE_HAS_MARKS", "Marks already exist for this schedule; it cannot be deleted");
  const doc = await ExamSchedule.findOneAndDelete({ _id: scheduleId, exam: examId });
  if (!doc) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Exam schedule not found");
  return { deleted: true };
}

/* ---------------- Marks ---------------- */

/** Teacher scope for a schedule: assignment must cover class (+section when the schedule is section-specific) + subject + exam session. */
async function assertScheduleScope(actor: Actor, schedule: { schoolClass: unknown; section?: unknown; subject: unknown }, sessionId: string) {
  if (actor.role === "admin") return;
  if (actor.role !== "teacher") throw new AppError(403, "FORBIDDEN", "Only assigned teachers (or Admin) may enter marks");
  const { teacherAssignments } = await import("../academic-scope");
  const { assignments } = await teacherAssignments(actor.id);
  const ok = assignments.some((a) =>
    String(a.schoolClass) === String(schedule.schoolClass) && String(a.subject) === String(schedule.subject) && String(a.session) === sessionId &&
    (!schedule.section || String(a.section) === String(schedule.section)));
  if (!ok) throw new AppError(403, "FORBIDDEN", "You are not assigned to this subject/class, so you cannot enter its marks");
  await assertTeacherAssigned(actor, { schoolClass: String(schedule.schoolClass), section: schedule.section ? String(schedule.section) : String(assignments.find((a) => String(a.subject) === String(schedule.subject))?.section ?? ""), session: sessionId, subject: String(schedule.subject) }).catch(() => undefined);
}

export async function enterMarksBulk(actor: Actor, input: { examScheduleId: string; entries: Array<{ studentId: string; obtainedMarks: number }> }) {
  requireObjectId(input.examScheduleId, "Exam schedule");
  const schedule = await ExamSchedule.findById(input.examScheduleId).lean();
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Exam schedule not found");
  const exam = await mustExam(String(schedule.exam));
  if (exam.resultStatus === "published") throw new AppError(409, "RESULT_PUBLISHED_LOCKED", "Results are published; marks are locked");
  await assertScheduleScope(actor, schedule, String(exam.session));
  const over = input.entries.filter((e) => e.obtainedMarks > schedule.maxMarks);
  if (over.length > 0) throw new AppError(422, "MARKS_EXCEED_MAX", `Obtained marks cannot exceed the maximum of ${schedule.maxMarks}`, { studentIds: over.map((e) => e.studentId), maxMarks: schedule.maxMarks });
  const studentIds = input.entries.map((e) => e.studentId);
  const enrollmentFilter: Record<string, unknown> = { student: { $in: studentIds }, schoolClass: schedule.schoolClass, session: exam.session, status: "active" };
  if (schedule.section) enrollmentFilter.section = schedule.section;
  const enrolled = await Enrollment.find(enrollmentFilter).select("student").lean();
  const enrolledIds = new Set(enrolled.map((e) => String(e.student)));
  const notEnrolled = studentIds.filter((id) => !enrolledIds.has(id));
  if (notEnrolled.length > 0) throw new AppError(422, "STUDENT_NOT_ENROLLED", "Some students are not enrolled in this schedule's class for the exam session", { studentIds: notEnrolled });
  const results = [];
  for (const entry of input.entries) {
    const existing = await Mark.findOne({ examSchedule: schedule._id, student: entry.studentId });
    if (existing) {
      if (existing.obtainedMarks !== entry.obtainedMarks) {
        existing.changeHistory.push({ changedBy: actor.id as never, changedAt: new Date(), oldMarks: existing.obtainedMarks, newMarks: entry.obtainedMarks, note: "Bulk marks entry correction" });
        existing.obtainedMarks = entry.obtainedMarks;
        existing.updatedBy = actor.id as never;
        await existing.save();
      }
      results.push(existing);
    } else {
      results.push(await Mark.create({ exam: exam._id, examSchedule: schedule._id, student: entry.studentId, obtainedMarks: entry.obtainedMarks, enteredBy: actor.id }));
    }
  }
  if (exam.resultStatus === "draft") { exam.resultStatus = "in-review"; await exam.save(); }
  await logActivity({ actor, action: "marks.bulk-enter", entityKind: "examSchedule", entityId: String(schedule._id), summary: `Entered/corrected ${results.length} mark(s) for exam "${exam.name}"`, metadata: { examId: String(exam._id), count: results.length } });
  return { examId: String(exam._id), examScheduleId: String(schedule._id), count: results.length, marks: results };
}

export async function correctMark(actor: Actor, markId: string, input: { obtainedMarks: number; note?: string }) {
  requireObjectId(markId, "Mark");
  const mark = await Mark.findById(markId);
  if (!mark) throw new AppError(404, "MARK_NOT_FOUND", "Mark record not found");
  const schedule = await ExamSchedule.findById(mark.examSchedule).lean();
  if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Exam schedule not found");
  const exam = await mustExam(String(mark.exam));
  if (exam.resultStatus === "published") throw new AppError(409, "RESULT_PUBLISHED_LOCKED", "Results are published; marks are locked");
  await assertScheduleScope(actor, schedule, String(exam.session));
  if (input.obtainedMarks > schedule.maxMarks) throw new AppError(422, "MARKS_EXCEED_MAX", `Obtained marks cannot exceed the maximum of ${schedule.maxMarks}`, { maxMarks: schedule.maxMarks });
  if (mark.obtainedMarks !== input.obtainedMarks) {
    const oldMarks = mark.obtainedMarks;
    mark.changeHistory.push({ changedBy: actor.id as never, changedAt: new Date(), oldMarks, newMarks: input.obtainedMarks, note: input.note });
    mark.obtainedMarks = input.obtainedMarks;
    mark.updatedBy = actor.id as never;
    await mark.save();
    await logActivity({ actor, action: "marks.correct", entityKind: "mark", entityId: String(mark._id), summary: `Corrected a mark for exam "${exam.name}"`, metadata: { examId: String(exam._id), oldMarks, newMarks: input.obtainedMarks } });
  }
  return mark;
}

export async function listMarks(actor: Actor, query: Record<string, unknown>) {
  const filter: Record<string, unknown> = {};
  if (typeof query.examScheduleId === "string" && query.examScheduleId) filter.examSchedule = query.examScheduleId;
  if (typeof query.examId === "string" && query.examId) filter.exam = query.examId;
  if (typeof query.studentId === "string" && query.studentId) filter.student = query.studentId;
  if (actor.role === "student" || actor.role === "parent") {
    if (!filter.student) throw new AppError(422, "VALIDATION_ERROR", "studentId is required");
    const { assertStudentVisible } = await import("../academic-scope");
    await assertStudentVisible(actor, String(filter.student));
    const examId = filter.exam ?? (filter.examSchedule ? String((await ExamSchedule.findById(String(filter.examSchedule)).select("exam").lean())?.exam ?? "") : "");
    if (!examId) throw new AppError(422, "VALIDATION_ERROR", "examId or examScheduleId is required");
    const exam = await mustExam(String(examId));
    if (exam.resultStatus !== "published") throw new AppError(404, "RESULT_NOT_PUBLISHED", "Results for this exam have not been published yet");
  }
  if (actor.role === "teacher" && filter.examSchedule) {
    const schedule = await ExamSchedule.findById(String(filter.examSchedule)).lean();
    if (!schedule) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Exam schedule not found");
    const exam = await mustExam(String(schedule.exam));
    await assertScheduleScope(actor, schedule, String(exam.session));
  }
  const { page, limit } = pageOptions(query);
  const [items, total] = await Promise.all([
    Mark.find(filter)
      .populate({ path: "student", select: "admissionNumber firstName lastName" })
      .populate({ path: "examSchedule", select: "maxMarks date", populate: { path: "subject", select: "name code" } })
      .sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Mark.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

/* ---------------- Result workflow + computation ---------------- */

export async function approveResults(actor: Actor, examId: string) {
  const exam = await mustExam(examId);
  if (exam.resultStatus === "published") throw new AppError(409, "ALREADY_PUBLISHED", "Results are already published");
  const count = await Mark.countDocuments({ exam: exam._id });
  if (count === 0) throw new AppError(409, "NO_MARKS", "No marks have been entered for this exam yet");
  exam.resultStatus = "approved";
  exam.approvedBy = actor.id as never;
  exam.approvedAt = new Date();
  await exam.save();
  return Exam.findById(exam._id).populate(EXAM_POPULATE).lean();
}

export async function publishResults(actor: Actor, examId: string) {
  const exam = await mustExam(examId);
  if (exam.resultStatus === "published") throw new AppError(409, "ALREADY_PUBLISHED", "Results are already published");
  if (exam.resultStatus !== "approved") throw new AppError(409, "RESULT_NOT_APPROVED", "Results must be approved before they can be published");
  exam.resultStatus = "published";
  exam.publishedBy = actor.id as never;
  exam.publishedAt = new Date();
  exam.status = "completed";
  await exam.save();
  const published = await Exam.findById(exam._id).populate(EXAM_POPULATE).lean();
  // Phase 9 hook (§24): students of the exam's classes + their verified
  // parents are notified that results are published. Never throws.
  await notify({
    userIds: await userIdsForExamClasses({ classes: exam.classes.map(String), session: String(exam.session) }).catch(() => []),
    type: "result-published", title: `Results published: ${exam.name}`,
    body: `Results for ${exam.name} (${exam.type}) have been published. Report cards are now available.`,
    related: { kind: "exam", id: String(exam._id) }, createdBy: actor.id,
  });
  await logActivity({ actor, action: "results.publish", entityKind: "exam", entityId: String(exam._id), summary: `Published results for exam "${exam.name}"` });
  return published;
}

export function gradeFor(percentage: number, scale: { ranges: Array<{ min: number; max: number; grade: string; points?: number; remark?: string }> } | null): { grade: string; points?: number; remark?: string } | null {
  if (!scale) return null;
  const hit = scale.ranges.find((r) => percentage >= r.min && percentage <= r.max);
  return hit ? { grade: hit.grade, points: hit.points, remark: hit.remark } : null;
}

async function resolveScale(exam: IExam) {
  if (exam.gradingScale) {
    const s = await GradingScale.findById(exam.gradingScale).lean();
    if (s) return s;
  }
  const sessionScale = await GradingScale.findOne({ session: exam.session }).sort({ isDefault: -1 }).lean();
  if (sessionScale) return sessionScale;
  return GradingScale.findOne({ isDefault: true }).lean();
}

/**
 * Report-card computation for one student + exam. Visibility rule (§19):
 * students/parents receive 404 RESULT_NOT_PUBLISHED until the exam's results
 * are published; staff roles additionally pass the scope checks.
 */
export async function computeReportCard(actor: Actor, examId: string, studentId: string) {
  requireObjectId(studentId, "Student");
  const exam = await mustExam(examId);
  const { assertStudentVisible } = await import("../academic-scope");
  await assertStudentVisible(actor, studentId);
  if ((actor.role === "student" || actor.role === "parent") && exam.resultStatus !== "published") {
    throw new AppError(404, "RESULT_NOT_PUBLISHED", "Results for this exam have not been published yet");
  }
  const enrollment = await Enrollment.findOne({ student: studentId, session: exam.session }).sort({ createdAt: -1 })
    .populate({ path: "schoolClass", select: "name" }).populate({ path: "section", select: "name" }).lean();
  if (!enrollment) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "The student has no enrollment in the exam session");
  // Populated refs are document objects — extract the raw ids BEFORE using
  // them in queries/comparisons. Passing the populated object to the schedule
  // query (and String()-ing it for the section check) matched nothing, so
  // every published report card 404'd with MARKS_NOT_FOUND. (Phase 10 §36.)
  const enrollmentClassId = String((enrollment.schoolClass as unknown as { _id: unknown })._id);
  const enrollmentSectionId = enrollment.section ? String((enrollment.section as unknown as { _id: unknown })._id) : null;
  const schedules = await ExamSchedule.find({ exam: exam._id, schoolClass: enrollmentClassId })
    .populate({ path: "subject", select: "name code" }).sort({ date: 1 }).lean();
  const relevant = schedules.filter((s) => !s.section || String(s.section) === enrollmentSectionId);
  const marks = await Mark.find({ exam: exam._id, student: studentId }).lean();
  const markBySchedule = new Map(marks.map((m) => [String(m.examSchedule), m]));
  const subjects = relevant.map((s) => {
    const m = markBySchedule.get(String(s._id));
    return {
      subject: s.subject, scheduleId: String(s._id), date: s.date, maxMarks: s.maxMarks,
      obtainedMarks: m ? m.obtainedMarks : null,
      percentage: m ? Math.round((m.obtainedMarks / s.maxMarks) * 10000) / 100 : null,
    };
  });
  const graded = subjects.filter((s) => s.obtainedMarks !== null);
  if (graded.length === 0) throw new AppError(404, "MARKS_NOT_FOUND", "No marks have been entered for this student in this exam");
  const totalObtained = graded.reduce((sum, s) => sum + (s.obtainedMarks ?? 0), 0);
  const totalMax = graded.reduce((sum, s) => sum + s.maxMarks, 0);
  const percentage = Math.round((totalObtained / totalMax) * 10000) / 100;
  const scale = await resolveScale(exam);
  const grade = gradeFor(percentage, scale as never);
  let position: number | null = null;
  if (exam.allowPositions) {
    const classMarks = await Mark.find({ exam: exam._id }).lean();
    const totals = new Map<string, number>();
    const classStudents = await Enrollment.find({ session: exam.session, schoolClass: enrollmentClassId, section: enrollmentSectionId }).select("student").lean();
    const inClass = new Set(classStudents.map((e) => String(e.student)));
    for (const m of classMarks) {
      if (!inClass.has(String(m.student))) continue;
      totals.set(String(m.student), (totals.get(String(m.student)) ?? 0) + m.obtainedMarks);
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([id]) => id === studentId);
    position = idx >= 0 ? idx + 1 : null;
  }
  const student = await (await import("../students/student.model")).Student.findById(studentId).select("admissionNumber firstName lastName").lean();
  return {
    exam: { id: String(exam._id), name: exam.name, type: exam.type, resultStatus: exam.resultStatus, publishedAt: exam.publishedAt ?? null },
    student,
    enrollment: { class: enrollment.schoolClass, section: enrollment.section },
    subjects,
    totalObtained, totalMax, percentage,
    grade: grade?.grade ?? null, gradePoints: grade?.points ?? null, gradeRemark: grade?.remark ?? null,
    gradingScaleName: scale ? (scale as { name?: string }).name ?? null : null,
    position,
    positionNote: exam.allowPositions ? undefined : "Class positions are disabled by school policy for this exam",
  };
}

/** Class-level summary for staff: per-schedule averages + per-student totals (staff scope only). */
export async function classResultSummary(actor: Actor, examId: string) {
  const exam = await mustExam(examId);
  if (actor.role === "teacher") {
    const schedules = await ExamSchedule.find({ exam: exam._id }).lean();
    let any = false;
    for (const s of schedules) {
      try { await assertScheduleScope(actor, s, String(exam.session)); any = true; break; } catch { /* try next */ }
    }
    if (!any && schedules.length > 0) throw new AppError(403, "FORBIDDEN", "You are not assigned to any subject in this exam");
  }
  const marks = await Mark.find({ exam: exam._id }).populate({ path: "student", select: "admissionNumber firstName lastName" }).lean();
  const totals = new Map<string, { student: unknown; total: number; count: number }>();
  for (const m of marks) {
    const key = String((m.student as { _id?: unknown })?._id ?? m.student);
    if (!totals.has(key)) totals.set(key, { student: m.student, total: 0, count: 0 });
    const t = totals.get(key)!; t.total += m.obtainedMarks; t.count += 1;
  }
  return {
    exam: { id: String(exam._id), name: exam.name, resultStatus: exam.resultStatus },
    students: [...totals.values()].sort((a, b) => b.total - a.total),
    marksEntered: marks.length,
  };
}
