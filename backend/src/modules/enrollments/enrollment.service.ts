import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { Student } from "../students/student.model";
import { AcademicSession, SchoolClass, Section } from "../academics/academic.models";
import { Enrollment, type IEnrollment } from "./enrollment.model";

/**
 * Enrollment service (§17). Invariants enforced here AND in the schema:
 *  - all referenced records must exist, and section ∈ class, class ∈ session;
 *  - ONE active enrollment per student per session (service check → 409, plus
 *    the unique partial index as the database-level guard);
 *  - transfer/withdraw/promote close the current record (status + closedAt) and
 *    preserve it — history is never overwritten or deleted.
 */
const POPULATE = [
  { path: "student", select: "admissionNumber firstName lastName gender status" },
  { path: "session", select: "name isCurrent" },
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
];

/** Exported for admission conversion (§16), which must apply the exact same placement rules. */
export async function validatePlacement(sessionId: string, classId: string, sectionId: string) {
  const [session, cls, section] = await Promise.all([
    AcademicSession.findById(sessionId).select("_id").lean(),
    SchoolClass.findById(classId).select("_id session").lean(),
    Section.findById(sectionId).select("_id schoolClass").lean(),
  ]);
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  if (!cls) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  if (String(cls.session) !== sessionId) throw new AppError(422, "CLASS_SESSION_MISMATCH", "The selected class does not belong to the selected session");
  if (String(section.schoolClass) !== classId) throw new AppError(422, "SECTION_CLASS_MISMATCH", "The selected section does not belong to the selected class");
  return { session, cls, section };
}

async function activeEnrollment(studentId: string, sessionId: string) {
  return Enrollment.findOne({ student: studentId, session: sessionId, status: "active" });
}

export async function enrollStudent(input: { studentId: string; sessionId: string; classId: string; sectionId: string; enrollmentDate?: Date; notes?: string }): Promise<IEnrollment> {
  const student = await Student.findById(input.studentId).select("_id status").lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  if (student.status === "withdrawn" || student.status === "graduated") {
    throw new AppError(422, "STUDENT_NOT_ACTIVE", `Student status is '${student.status}' and cannot be enrolled`);
  }
  await validatePlacement(input.sessionId, input.classId, input.sectionId);
  if (await activeEnrollment(input.studentId, input.sessionId)) {
    throw new AppError(409, "ALREADY_ENROLLED", "This student already has an active enrollment in this session. Transfer or withdraw it first.");
  }
  try {
    const doc = await Enrollment.create({
      student: input.studentId, session: input.sessionId, schoolClass: input.classId, section: input.sectionId,
      enrollmentDate: input.enrollmentDate ?? new Date(), status: "active", statusNote: input.notes,
    });
    return (await Enrollment.findById(doc._id).populate(POPULATE).lean()) as unknown as IEnrollment;
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "ALREADY_ENROLLED", "This student already has an active enrollment in this session");
    throw err;
  }
}

export async function listEnrollments(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.studentId === "string" && query.studentId) filter.student = query.studentId;
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (typeof query.sectionId === "string" && query.sectionId) filter.section = query.sectionId;
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Enrollment.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Enrollment.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getEnrollment(id: string) {
  requireObjectId(id, "Enrollment");
  const doc = await Enrollment.findById(id).populate(POPULATE).lean();
  if (!doc) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
  return doc;
}

async function mustBeActive(id: string): Promise<IEnrollment> {
  requireObjectId(id, "Enrollment");
  const doc = await Enrollment.findById(id);
  if (!doc) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
  if (doc.status !== "active") throw new AppError(409, "ENROLLMENT_NOT_ACTIVE", `Enrollment is '${doc.status}' — only an active enrollment can be transferred, withdrawn or promoted`);
  return doc;
}

/** Transfer within the same session: close current (transferred) + open a new active record. */
export async function transferEnrollment(id: string, input: { classId: string; sectionId: string; notes?: string }) {
  const current = await mustBeActive(id);
  if (String(current.schoolClass) === input.classId && String(current.section) === input.sectionId) {
    throw new AppError(422, "SAME_PLACEMENT", "The student is already in this class and section");
  }
  await validatePlacement(String(current.session), input.classId, input.sectionId);
  current.status = "transferred";
  current.closedAt = new Date();
  if (input.notes) current.statusNote = input.notes;
  await current.save();
  const doc = await Enrollment.create({
    student: current.student, session: current.session, schoolClass: input.classId, section: input.sectionId,
    enrollmentDate: new Date(), status: "active", previousEnrollment: current._id, statusNote: input.notes,
  });
  return Enrollment.findById(doc._id).populate(POPULATE).lean();
}

export async function withdrawEnrollment(id: string, input: { notes?: string }) {
  const current = await mustBeActive(id);
  current.status = "withdrawn";
  current.closedAt = new Date();
  if (input.notes) current.statusNote = input.notes;
  await current.save();
  return Enrollment.findById(current._id).populate(POPULATE).lean();
}

/** Promotion: close current (promoted) + create the next-session enrollment; prior history is preserved. */
export async function promoteEnrollment(id: string, input: { toSessionId: string; toClassId: string; toSectionId: string; notes?: string }) {
  const current = await mustBeActive(id);
  if (String(current.session) === input.toSessionId) throw new AppError(422, "SAME_SESSION", "Promotion target must be a different academic session — use transfer for a move within the same session");
  await validatePlacement(input.toSessionId, input.toClassId, input.toSectionId);
  if (await activeEnrollment(String(current.student), input.toSessionId)) {
    throw new AppError(409, "ALREADY_ENROLLED", "This student already has an active enrollment in the target session");
  }
  current.status = "promoted";
  current.closedAt = new Date();
  if (input.notes) current.statusNote = input.notes;
  await current.save();
  try {
    const doc = await Enrollment.create({
      student: current.student, session: input.toSessionId, schoolClass: input.toClassId, section: input.toSectionId,
      enrollmentDate: new Date(), status: "active", previousEnrollment: current._id, statusNote: input.notes ?? "Promoted",
    });
    return Enrollment.findById(doc._id).populate(POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "ALREADY_ENROLLED", "This student already has an active enrollment in the target session");
    throw err;
  }
}
