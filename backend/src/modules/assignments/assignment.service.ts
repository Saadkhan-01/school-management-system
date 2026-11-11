import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { Assignment, StudyMaterial, Submission, type IAssignment } from "./assignment.model";
import {
  activeEnrollmentFor, assertStudentVisible, assertTeacherAssigned, ownStudent,
  parentLinkedStudentIds, requireTeacherProfile, type Actor,
} from "../academic-scope";
import { notify, userIdsForClassSection, userIdsForStudents } from "../notifications/notification.service";

/**
 * Assignments + submissions + study materials (§9/§20).
 * Scope rules enforced here:
 *  - teacher creates only for classes/subjects they are assigned to, and
 *    grades only their OWN assignments;
 *  - student lists/submits only for their own active enrollment's
 *    class/section/session; one submission per assignment (unique index) —
 *    resubmission is allowed BEFORE the deadline and resets grading;
 *    after the deadline a second submission is a 409;
 *  - parent reads only verified-linked children, and sees marks/feedback
 *    only when feedbackPublished is true;
 *  - late flag is computed server-side from submittedAt vs deadline.
 */
const ASSIGNMENT_POPULATE = [
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
  { path: "teacher", select: "employeeId", populate: { path: "user", select: "name" } },
];
const SUBMISSION_POPULATE = [
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "gradedBy", select: "name" },
];

async function mustAssignment(id: string): Promise<IAssignment> {
  requireObjectId(id, "Assignment");
  const doc = await Assignment.findById(id);
  if (!doc) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  return doc;
}

/** Visibility of one assignment for student/parent actors (throws 403/404). */
async function assertAssignmentVisible(actor: Actor, assignment: IAssignment, studentIdHint?: string) {
  if (actor.role === "admin" || actor.role === "principal") return;
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    if (String(assignment.teacher) === String(profile._id)) return;
    await assertTeacherAssigned(actor, { schoolClass: String(assignment.schoolClass), section: String(assignment.section), session: String(assignment.session), subject: String(assignment.subject) });
    return;
  }
  if (actor.role === "student") {
    const self = await ownStudent(actor.id);
    if (!self) throw new AppError(403, "FORBIDDEN", "No student record is linked to your account");
    const enr = await activeEnrollmentFor(String(self._id), String(assignment.session));
    if (enr && String(enr.schoolClass) === String(assignment.schoolClass) && String(enr.section) === String(assignment.section)) return;
    throw new AppError(403, "FORBIDDEN", "This assignment is not for your class");
  }
  if (actor.role === "parent") {
    if (!studentIdHint) throw new AppError(422, "VALIDATION_ERROR", "studentId query parameter is required for parent access");
    await assertStudentVisible(actor, studentIdHint);
    const enr = await activeEnrollmentFor(studentIdHint, String(assignment.session));
    if (enr && String(enr.schoolClass) === String(assignment.schoolClass) && String(enr.section) === String(assignment.section)) return;
    throw new AppError(403, "FORBIDDEN", "This assignment is not for your child's class");
  }
  throw new AppError(403, "FORBIDDEN", "Your role cannot access assignments");
}

export async function createAssignment(actor: Actor, input: Record<string, unknown>) {
  let teacherId: string;
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    teacherId = String(profile._id);
  } else if (actor.role === "admin") {
    if (!input.teacherId) throw new AppError(422, "VALIDATION_ERROR", "teacherId is required when an Admin creates an assignment");
    teacherId = String(input.teacherId);
  } else throw new AppError(403, "FORBIDDEN", "Only teachers (or Admin) may create assignments");
  if (actor.role === "teacher") {
    await assertTeacherAssigned(actor, { schoolClass: String(input.classId), section: String(input.sectionId), session: String(input.sessionId), subject: String(input.subjectId) });
  }
  const doc = await Assignment.create({
    teacher: teacherId, createdBy: actor.id,
    schoolClass: input.classId, section: input.sectionId, subject: input.subjectId, session: input.sessionId,
    title: input.title, instructions: input.instructions, deadline: input.deadline,
    maxMarks: input.maxMarks, attachments: input.attachments ?? [],
  });
  const created = await Assignment.findById(doc._id).populate(ASSIGNMENT_POPULATE).lean();
  // Phase 9 hook (§24): notify enrolled students of the class/section + their
  // verified parents. notify() never throws — it cannot fail this create.
  await notify({
    userIds: await userIdsForClassSection({ schoolClass: String(input.classId), section: String(input.sectionId), session: String(input.sessionId) }).catch(() => []),
    type: "assignment-created", title: `New assignment: ${String(input.title)}`,
    body: `A new assignment "${String(input.title)}" has been posted for your class. Deadline: ${new Date(String(input.deadline)).toISOString().slice(0, 10)}.`,
    related: { kind: "assignment", id: String(doc._id) }, createdBy: actor.id,
  });
  return created;
}

export async function listAssignments(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (typeof query.sectionId === "string" && query.sectionId) filter.section = query.sectionId;
  if (typeof query.subjectId === "string" && query.subjectId) filter.subject = query.subjectId;
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) filter.title = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    filter.teacher = profile._id;
  } else if (actor.role === "student") {
    const self = await ownStudent(actor.id);
    if (!self) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    const enr = await activeEnrollmentFor(String(self._id), typeof query.sessionId === "string" ? query.sessionId : undefined);
    if (!enr) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    filter.schoolClass = enr.schoolClass; filter.section = enr.section; filter.session = enr.session;
  } else if (actor.role === "parent") {
    const studentId = typeof query.studentId === "string" ? query.studentId : undefined;
    if (!studentId) throw new AppError(422, "VALIDATION_ERROR", "studentId query parameter is required for parent access");
    await assertStudentVisible(actor, studentId);
    const enr = await activeEnrollmentFor(studentId, typeof query.sessionId === "string" ? query.sessionId : undefined);
    if (!enr) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    filter.schoolClass = enr.schoolClass; filter.section = enr.section; filter.session = enr.session;
  } else if (actor.role !== "admin" && actor.role !== "principal") {
    throw new AppError(403, "FORBIDDEN", "Your role cannot access assignments");
  }
  const [items, total] = await Promise.all([
    Assignment.find(filter).populate(ASSIGNMENT_POPULATE).sort({ deadline: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Assignment.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getAssignment(actor: Actor, id: string, studentIdHint?: string) {
  const doc = await mustAssignment(id);
  await assertAssignmentVisible(actor, doc, studentIdHint);
  return Assignment.findById(doc._id).populate(ASSIGNMENT_POPULATE).lean();
}

export async function updateAssignment(actor: Actor, id: string, input: Record<string, unknown>) {
  const doc = await mustAssignment(id);
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    if (String(doc.teacher) !== String(profile._id)) throw new AppError(403, "FORBIDDEN", "You can only edit your own assignments");
  } else if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only the owning teacher (or Admin) may edit an assignment");
  const updated = await Assignment.findByIdAndUpdate(id, { $set: definedOnly(input) }, { new: true, runValidators: true });
  return Assignment.findById(updated!._id).populate(ASSIGNMENT_POPULATE).lean();
}

/* ---------------- Submissions ---------------- */

export async function submitAssignment(actor: Actor, assignmentId: string, input: { content?: string; attachments?: unknown[] }) {
  const assignment = await mustAssignment(assignmentId);
  const self = await ownStudent(actor.id);
  if (!self) throw new AppError(403, "FORBIDDEN", "No student record is linked to your account");
  const enr = await activeEnrollmentFor(String(self._id), String(assignment.session));
  if (!enr || String(enr.schoolClass) !== String(assignment.schoolClass) || String(enr.section) !== String(assignment.section)) {
    throw new AppError(403, "FORBIDDEN", "This assignment is not for your class");
  }
  const now = new Date();
  const isLate = now.getTime() > new Date(assignment.deadline).getTime();
  const existing = await Submission.findOne({ assignment: assignment._id, student: self._id });
  if (existing) {
    // Documented rule: resubmission is allowed BEFORE the deadline (grading resets); after it, the single submission stands.
    if (isLate) throw new AppError(409, "SUBMISSION_LOCKED", "You have already submitted and the deadline has passed, so the submission can no longer be changed");
    existing.content = input.content; existing.attachments = (input.attachments ?? []) as never;
    existing.submittedAt = now; existing.isLate = isLate;
    existing.status = "submitted"; existing.marks = undefined; existing.feedback = undefined;
    existing.feedbackPublished = false; existing.gradedBy = undefined; existing.gradedAt = undefined;
    await existing.save();
    return Submission.findById(existing._id).populate(SUBMISSION_POPULATE).lean();
  }
  try {
    const doc = await Submission.create({
      assignment: assignment._id, student: self._id, enrollment: enr._id,
      content: input.content, attachments: input.attachments ?? [], submittedAt: now, isLate,
    });
    return Submission.findById(doc._id).populate(SUBMISSION_POPULATE).lean();
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) throw new AppError(409, "SUBMISSION_EXISTS", "You have already submitted this assignment");
    throw err;
  }
}

export async function listSubmissions(actor: Actor, assignmentId: string) {
  const assignment = await mustAssignment(assignmentId);
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    if (String(assignment.teacher) !== String(profile._id)) throw new AppError(403, "FORBIDDEN", "You can only view submissions for your own assignments");
  } else if (actor.role !== "admin" && actor.role !== "principal") {
    throw new AppError(403, "FORBIDDEN", "Submission lists are available to the owning teacher, Admin and Principal");
  }
  return Submission.find({ assignment: assignment._id }).populate(SUBMISSION_POPULATE).sort({ submittedAt: 1 }).lean();
}

function redactForParent<T extends Record<string, unknown>>(sub: T): T {
  if (sub && sub.feedbackPublished !== true) {
    const copy = { ...sub } as Record<string, unknown>;
    delete copy.marks; delete copy.feedback; delete copy.gradedBy; delete copy.gradedAt;
    copy.feedbackNote = "Feedback has not been published by the teacher yet";
    return copy as T;
  }
  return sub;
}

export async function getMySubmission(actor: Actor, assignmentId: string, studentIdHint?: string) {
  const assignment = await mustAssignment(assignmentId);
  let studentId: string;
  if (actor.role === "student") {
    const self = await ownStudent(actor.id);
    if (!self) throw new AppError(403, "FORBIDDEN", "No student record is linked to your account");
    studentId = String(self._id);
  } else if (actor.role === "parent") {
    if (!studentIdHint) throw new AppError(422, "VALIDATION_ERROR", "studentId query parameter is required for parent access");
    await assertStudentVisible(actor, studentIdHint);
    studentId = studentIdHint;
  } else if (actor.role === "admin" || actor.role === "principal" || actor.role === "teacher") {
    if (!studentIdHint) throw new AppError(422, "VALIDATION_ERROR", "studentId query parameter is required");
    studentId = studentIdHint;
  } else throw new AppError(403, "FORBIDDEN", "Your role cannot access submissions");
  await assertAssignmentVisible(actor, assignment, studentId);
  const sub = await Submission.findOne({ assignment: assignment._id, student: studentId }).populate(SUBMISSION_POPULATE).lean();
  if (!sub) throw new AppError(404, "SUBMISSION_NOT_FOUND", "No submission found for this assignment");
  if (actor.role === "parent") return redactForParent(sub as unknown as Record<string, unknown>);
  if (actor.role === "student" && (sub as { feedbackPublished?: boolean }).feedbackPublished !== true) return redactForParent(sub as unknown as Record<string, unknown>);
  return sub;
}

export async function gradeSubmission(actor: Actor, submissionId: string, input: { marks?: number; feedback?: string; feedbackPublished?: boolean }) {
  requireObjectId(submissionId, "Submission");
  const sub = await Submission.findById(submissionId);
  if (!sub) throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
  const assignment = await mustAssignment(String(sub.assignment));
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    if (String(assignment.teacher) !== String(profile._id)) throw new AppError(403, "FORBIDDEN", "You can only grade submissions for your own assignments");
  } else if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only the owning teacher (or Admin) may grade submissions");
  if (input.marks !== undefined && assignment.maxMarks && input.marks > assignment.maxMarks) {
    throw new AppError(422, "MARKS_EXCEED_MAX", `Marks cannot exceed the assignment maximum of ${assignment.maxMarks}`, { maxMarks: assignment.maxMarks });
  }
  if (input.marks !== undefined) sub.marks = input.marks;
  if (input.feedback !== undefined) sub.feedback = input.feedback;
  if (input.feedbackPublished !== undefined) sub.feedbackPublished = input.feedbackPublished;
  if (input.marks !== undefined || input.feedback !== undefined) {
    sub.status = "graded"; sub.gradedBy = actor.id as never; sub.gradedAt = new Date();
    if (input.feedbackPublished === undefined && input.feedback !== undefined) sub.feedbackPublished = true;
  }
  await sub.save();
  const graded = await Submission.findById(sub._id).populate(SUBMISSION_POPULATE).lean();
  // Phase 9 hook (§24): the graded student (+ verified parents) is notified.
  if (input.marks !== undefined || input.feedback !== undefined) {
    await notify({
      userIds: await userIdsForStudents([String(sub.student)]).catch(() => []),
      type: "assignment-graded", title: `Assignment graded: ${assignment.title}`,
      body: `Your submission for "${assignment.title}" has been graded${input.marks !== undefined ? ` (${input.marks}${assignment.maxMarks ? `/${assignment.maxMarks}` : ""})` : ""}.`,
      related: { kind: "assignment", id: String(assignment._id) }, createdBy: actor.id,
    });
  }
  return graded;
}

/* ---------------- Study materials ---------------- */

export async function createMaterial(actor: Actor, input: Record<string, unknown>) {
  let teacherId: string | undefined;
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    teacherId = String(profile._id);
    await assertTeacherAssigned(actor, { schoolClass: String(input.classId), section: String(input.sectionId ?? ""), session: String(input.sessionId), subject: String(input.subjectId) }).catch(async () => {
      // Section is optional for materials: accept any assignment for class+subject+session.
      const { teacherAssignments } = await import("../academic-scope");
      const { assignments } = await teacherAssignments(actor.id);
      const ok = assignments.some((a) => String(a.schoolClass) === String(input.classId) && String(a.subject) === String(input.subjectId) && String(a.session) === String(input.sessionId));
      if (!ok) throw new AppError(403, "FORBIDDEN", "You are not assigned to this class/subject");
    });
  } else if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only teachers (or Admin) may add study materials");
  const doc = await StudyMaterial.create({
    title: input.title, description: input.description,
    schoolClass: input.classId, section: input.sectionId, subject: input.subjectId, session: input.sessionId,
    teacher: teacherId, uploadedBy: actor.id,
    fileName: input.fileName, fileUrl: input.fileUrl, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
  });
  return doc;
}

export async function listMaterials(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.subjectId === "string" && query.subjectId) filter.subject = query.subjectId;
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) filter.title = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    filter.$or = [{ teacher: profile._id }];
    const { teacherAssignments } = await import("../academic-scope");
    const { assignments } = await teacherAssignments(actor.id);
    for (const a of assignments) (filter.$or as Record<string, unknown>[]).push({ schoolClass: a.schoolClass, subject: a.subject, session: a.session });
  } else if (actor.role === "student" || actor.role === "parent") {
    let studentId: string | undefined;
    if (actor.role === "student") { const self = await ownStudent(actor.id); studentId = self ? String(self._id) : undefined; }
    else {
      studentId = typeof query.studentId === "string" ? query.studentId : undefined;
      if (!studentId) {
        const ids = await parentLinkedStudentIds(actor.id);
        if (ids.length === 0) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
        studentId = ids[0];
      } else await assertStudentVisible(actor, studentId);
    }
    if (!studentId) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    const enr = await activeEnrollmentFor(studentId, typeof query.sessionId === "string" ? query.sessionId : undefined);
    if (!enr) return { items: [], meta: { page, limit, total: 0, pages: 0 } };
    filter.schoolClass = enr.schoolClass; filter.session = enr.session;
    filter.$or = [{ section: enr.section }, { section: null }, { section: { $exists: false } }];
  } else if (actor.role !== "admin" && actor.role !== "principal") {
    throw new AppError(403, "FORBIDDEN", "Your role cannot access study materials");
  }
  const populate = [
    { path: "schoolClass", select: "name" },
    { path: "section", select: "name" },
    { path: "subject", select: "name code" },
  ];
  const [items, total] = await Promise.all([
    StudyMaterial.find(filter).populate(populate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StudyMaterial.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function deleteMaterial(actor: Actor, id: string) {
  requireObjectId(id, "Study material");
  const doc = await StudyMaterial.findById(id);
  if (!doc) throw new AppError(404, "MATERIAL_NOT_FOUND", "Study material not found");
  if (actor.role === "teacher") {
    const profile = await requireTeacherProfile(actor.id);
    if (!doc.teacher || String(doc.teacher) !== String(profile._id)) throw new AppError(403, "FORBIDDEN", "You can only delete your own study materials");
  } else if (actor.role !== "admin") throw new AppError(403, "FORBIDDEN", "Only the uploading teacher (or Admin) may delete study materials");
  await StudyMaterial.findByIdAndDelete(id);
  return { deleted: true };
}
