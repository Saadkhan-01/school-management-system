import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { TeacherProfile } from "../teachers/teacher.model";
import {
  AcademicSession, Classroom, GradingScale, SchoolClass, Section, Subject, TeacherAssignment,
} from "./academic.models";

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = definedOnly(input);
  for (const [k, v] of Object.entries(out)) if (v === "") delete out[k];
  return out;
}
async function mustExist<T>(promise: Promise<T | null>, code: string, message: string): Promise<T> {
  const doc = await promise;
  if (!doc) throw new AppError(404, code, message);
  return doc;
}

/* ---------------- Academic sessions ---------------- */
export async function createSession(input: Record<string, unknown>) {
  if (await AcademicSession.findOne({ name: input.name })) throw new AppError(409, "SESSION_EXISTS", "An academic session with this name already exists");
  const doc = await AcademicSession.create(clean(input));
  if (doc.isCurrent) await AcademicSession.updateMany({ _id: { $ne: doc._id }, isCurrent: true }, { $set: { isCurrent: false } });
  return doc;
}
export async function listSessions(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    AcademicSession.find(filter).sort({ startDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AcademicSession.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getSession(id: string) {
  requireObjectId(id, "Academic session");
  return mustExist(AcademicSession.findById(id).lean(), "SESSION_NOT_FOUND", "Academic session not found");
}
export async function updateSession(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Academic session");
  const data = clean(input);
  const start = data.startDate ? new Date(String(data.startDate)) : undefined;
  const end = data.endDate ? new Date(String(data.endDate)) : undefined;
  if (start || end) {
    const existing = await mustExist(AcademicSession.findById(id).lean(), "SESSION_NOT_FOUND", "Academic session not found");
    const s = start ?? existing.startDate; const e = end ?? existing.endDate;
    if (e.getTime() <= s.getTime()) throw new AppError(422, "VALIDATION_ERROR", "Session end date must be after its start date");
  }
  if (data.name) {
    const clash = await AcademicSession.findOne({ name: data.name, _id: { $ne: id } });
    if (clash) throw new AppError(409, "SESSION_EXISTS", "An academic session with this name already exists");
  }
  const doc = await AcademicSession.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  if (doc.isCurrent) await AcademicSession.updateMany({ _id: { $ne: doc._id }, isCurrent: true }, { $set: { isCurrent: false } });
  return doc;
}
export async function deleteSession(id: string) {
  requireObjectId(id, "Academic session");
  const inUse = await SchoolClass.countDocuments({ session: id });
  if (inUse > 0) throw new AppError(409, "SESSION_IN_USE", "This session still has classes and cannot be deleted. Sessions with history are kept.");
  const doc = await AcademicSession.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  return { deleted: true };
}

/* ---------------- Classes ---------------- */
export async function createClass(input: Record<string, unknown>) {
  const data = clean(input);
  const session = await mustExist(AcademicSession.findById(String(data.sessionId)).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  if (await SchoolClass.findOne({ name: data.name, session: session._id })) throw new AppError(409, "CLASS_EXISTS", "This class already exists in the selected session");
  return SchoolClass.create({ name: data.name, session: session._id, level: data.level, description: data.description });
}
export async function listClasses(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    SchoolClass.find(filter).populate({ path: "session", select: "name isCurrent" }).sort({ level: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    SchoolClass.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getClass(id: string) {
  requireObjectId(id, "Class");
  return mustExist(SchoolClass.findById(id).populate({ path: "session", select: "name isCurrent startDate endDate" }).lean(), "CLASS_NOT_FOUND", "Class not found");
}
export async function updateClass(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Class");
  const data = clean(input);
  const sessionId = data.sessionId ? String(data.sessionId) : undefined;
  delete data.sessionId;
  if (sessionId) await mustExist(AcademicSession.findById(sessionId).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  const existing = await mustExist(SchoolClass.findById(id).lean(), "CLASS_NOT_FOUND", "Class not found");
  const name = (data.name as string) ?? existing.name;
  const session = sessionId ?? String(existing.session);
  if (await SchoolClass.findOne({ name, session, _id: { $ne: id } })) throw new AppError(409, "CLASS_EXISTS", "This class already exists in the selected session");
  const doc = await SchoolClass.findByIdAndUpdate(id, { $set: { ...data, ...(sessionId ? { session: sessionId } : {}) } }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  return doc;
}
export async function deleteClass(id: string) {
  requireObjectId(id, "Class");
  const sections = await Section.countDocuments({ schoolClass: id });
  if (sections > 0) throw new AppError(409, "CLASS_IN_USE", "This class still has sections and cannot be deleted");
  const doc = await SchoolClass.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  return { deleted: true };
}

/* ---------------- Sections ---------------- */
export async function createSection(input: Record<string, unknown>) {
  const data = clean(input);
  const cls = await mustExist(SchoolClass.findById(String(data.classId)).select("_id").lean(), "CLASS_NOT_FOUND", "Class not found");
  if (data.classTeacherId) await mustExist(TeacherProfile.findById(String(data.classTeacherId)).select("_id").lean(), "TEACHER_NOT_FOUND", "Class teacher profile not found");
  if (await Section.findOne({ schoolClass: cls._id, name: data.name })) throw new AppError(409, "SECTION_EXISTS", "This section already exists in the selected class");
  return Section.create({ schoolClass: cls._id, name: data.name, capacity: data.capacity, classTeacher: data.classTeacherId || undefined });
}
export async function listSections(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    Section.find(filter)
      .populate({ path: "schoolClass", select: "name session", populate: { path: "session", select: "name" } })
      .populate({ path: "classTeacher", select: "employeeId", populate: { path: "user", select: "name" } })
      .sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Section.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getSection(id: string) {
  requireObjectId(id, "Section");
  return mustExist(Section.findById(id).populate({ path: "schoolClass", select: "name session" }).lean(), "SECTION_NOT_FOUND", "Section not found");
}
export async function updateSection(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Section");
  const data = clean(input);
  const classId = data.classId ? String(data.classId) : undefined; delete data.classId;
  const teacherId = data.classTeacherId ? String(data.classTeacherId) : undefined; delete data.classTeacherId;
  if (classId) await mustExist(SchoolClass.findById(classId).select("_id").lean(), "CLASS_NOT_FOUND", "Class not found");
  if (teacherId) await mustExist(TeacherProfile.findById(teacherId).select("_id").lean(), "TEACHER_NOT_FOUND", "Class teacher profile not found");
  const existing = await mustExist(Section.findById(id).lean(), "SECTION_NOT_FOUND", "Section not found");
  const name = (data.name as string) ?? existing.name;
  const schoolClass = classId ?? String(existing.schoolClass);
  if (await Section.findOne({ schoolClass, name, _id: { $ne: id } })) throw new AppError(409, "SECTION_EXISTS", "This section already exists in the selected class");
  const doc = await Section.findByIdAndUpdate(id, { $set: { ...data, ...(classId ? { schoolClass: classId } : {}), ...(teacherId ? { classTeacher: teacherId } : {}) } }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  return doc;
}
export async function deleteSection(id: string) {
  requireObjectId(id, "Section");
  const doc = await Section.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  return { deleted: true };
}

/* ---------------- Subjects ---------------- */
export async function createSubject(input: Record<string, unknown>) {
  const data = clean(input);
  const session = await mustExist(AcademicSession.findById(String(data.sessionId)).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  const code = String(data.code).toUpperCase();
  if (await Subject.findOne({ code, session: session._id })) throw new AppError(409, "SUBJECT_CODE_EXISTS", "A subject with this code already exists in the selected session");
  return Subject.create({ name: data.name, code, session: session._id, description: data.description });
}
export async function listSubjects(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { code: rx }];
  }
  const [items, total] = await Promise.all([
    Subject.find(filter).populate({ path: "session", select: "name isCurrent" }).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Subject.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getSubject(id: string) {
  requireObjectId(id, "Subject");
  return mustExist(Subject.findById(id).populate({ path: "session", select: "name isCurrent" }).lean(), "SUBJECT_NOT_FOUND", "Subject not found");
}
export async function updateSubject(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Subject");
  const data = clean(input);
  const sessionId = data.sessionId ? String(data.sessionId) : undefined; delete data.sessionId;
  if (sessionId) await mustExist(AcademicSession.findById(sessionId).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  const existing = await mustExist(Subject.findById(id).lean(), "SUBJECT_NOT_FOUND", "Subject not found");
  const code = data.code ? String(data.code).toUpperCase() : existing.code;
  const session = sessionId ?? String(existing.session);
  if (await Subject.findOne({ code, session, _id: { $ne: id } })) throw new AppError(409, "SUBJECT_CODE_EXISTS", "A subject with this code already exists in the selected session");
  const doc = await Subject.findByIdAndUpdate(id, { $set: { ...data, code, ...(sessionId ? { session: sessionId } : {}) } }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  return doc;
}
export async function deleteSubject(id: string) {
  requireObjectId(id, "Subject");
  const used = await TeacherAssignment.countDocuments({ subject: id });
  if (used > 0) throw new AppError(409, "SUBJECT_IN_USE", "This subject is used in teacher assignments and cannot be deleted");
  const doc = await Subject.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  return { deleted: true };
}

/* ---------------- Classrooms ---------------- */
export async function createClassroom(input: Record<string, unknown>) {
  if (await Classroom.findOne({ name: input.name })) throw new AppError(409, "CLASSROOM_EXISTS", "A classroom with this name already exists");
  return Classroom.create(clean(input));
}
export async function listClassrooms(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    Classroom.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Classroom.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getClassroom(id: string) {
  requireObjectId(id, "Classroom");
  return mustExist(Classroom.findById(id).lean(), "CLASSROOM_NOT_FOUND", "Classroom not found");
}
export async function updateClassroom(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Classroom");
  const data = clean(input);
  if (data.name && await Classroom.findOne({ name: data.name, _id: { $ne: id } })) throw new AppError(409, "CLASSROOM_EXISTS", "A classroom with this name already exists");
  const doc = await Classroom.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "CLASSROOM_NOT_FOUND", "Classroom not found");
  return doc;
}
export async function deleteClassroom(id: string) {
  requireObjectId(id, "Classroom");
  const doc = await Classroom.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "CLASSROOM_NOT_FOUND", "Classroom not found");
  return { deleted: true };
}

/* ---------------- Teacher assignments ---------------- */
const ASSIGNMENT_POPULATE = [
  { path: "teacher", select: "employeeId", populate: { path: "user", select: "name email" } },
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
  { path: "session", select: "name isCurrent" },
];
export async function createTeacherAssignment(input: { teacherId: string; classId: string; sectionId: string; subjectId: string; sessionId: string }) {
  const [teacher, cls, section, subject, session] = await Promise.all([
    TeacherProfile.findById(input.teacherId).select("_id").lean(),
    SchoolClass.findById(input.classId).select("_id session").lean(),
    Section.findById(input.sectionId).select("_id schoolClass").lean(),
    Subject.findById(input.subjectId).select("_id").lean(),
    AcademicSession.findById(input.sessionId).select("_id").lean(),
  ]);
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher profile not found");
  if (!cls) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  if (String(section.schoolClass) !== String(cls._id)) throw new AppError(422, "SECTION_CLASS_MISMATCH", "The selected section does not belong to the selected class");
  if (String(cls.session) !== String(session._id)) throw new AppError(422, "CLASS_SESSION_MISMATCH", "The selected class does not belong to the selected session");
  const existing = await TeacherAssignment.findOne({ teacher: teacher._id, schoolClass: cls._id, section: section._id, subject: subject._id, session: session._id });
  if (existing) throw new AppError(409, "ASSIGNMENT_EXISTS", "This teacher is already assigned to this class/section/subject for the session");
  const doc = await TeacherAssignment.create({ teacher: teacher._id, schoolClass: cls._id, section: section._id, subject: subject._id, session: session._id });
  return TeacherAssignment.findById(doc._id).populate(ASSIGNMENT_POPULATE).lean();
}
export async function listTeacherAssignments(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.teacherId === "string" && query.teacherId) filter.teacher = query.teacherId;
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.subjectId === "string" && query.subjectId) filter.subject = query.subjectId;
  const [items, total] = await Promise.all([
    TeacherAssignment.find(filter).populate(ASSIGNMENT_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TeacherAssignment.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function deleteTeacherAssignment(id: string) {
  requireObjectId(id, "Teacher assignment");
  const doc = await TeacherAssignment.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Teacher assignment not found");
  return { deleted: true };
}

/* ---------------- Grading scales ---------------- */
export async function createGradingScale(input: Record<string, unknown>) {
  const data = clean(input);
  const sessionId = data.sessionId ? String(data.sessionId) : undefined; delete data.sessionId;
  if (sessionId) await mustExist(AcademicSession.findById(sessionId).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  const doc = await GradingScale.create({ ...data, ...(sessionId ? { session: sessionId } : {}) });
  if (doc.isDefault) await GradingScale.updateMany({ _id: { $ne: doc._id }, isDefault: true }, { $set: { isDefault: false } });
  return doc;
}
export async function listGradingScales(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    GradingScale.find(filter).populate({ path: "session", select: "name" }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    GradingScale.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export async function getGradingScale(id: string) {
  requireObjectId(id, "Grading scale");
  return mustExist(GradingScale.findById(id).populate({ path: "session", select: "name" }).lean(), "GRADING_SCALE_NOT_FOUND", "Grading scale not found");
}
export async function updateGradingScale(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Grading scale");
  const data = clean(input);
  const sessionId = data.sessionId ? String(data.sessionId) : undefined; delete data.sessionId;
  if (sessionId) await mustExist(AcademicSession.findById(sessionId).select("_id").lean(), "SESSION_NOT_FOUND", "Academic session not found");
  const doc = await GradingScale.findByIdAndUpdate(id, { $set: { ...data, ...(sessionId ? { session: sessionId } : {}) } }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "GRADING_SCALE_NOT_FOUND", "Grading scale not found");
  if (doc.isDefault) await GradingScale.updateMany({ _id: { $ne: doc._id }, isDefault: true }, { $set: { isDefault: false } });
  return doc;
}
export async function deleteGradingScale(id: string) {
  requireObjectId(id, "Grading scale");
  const doc = await GradingScale.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "GRADING_SCALE_NOT_FOUND", "Grading scale not found");
  return { deleted: true };
}

/* ---------------- Phase 5: teacher's own assignments ---------------- */
/** The signed-in teacher's TeacherAssignment rows, resolved via their profile (teacher portal "My Classes"). */
export async function listMyTeacherAssignments(userId: string) {
  const profile = await TeacherProfile.findOne({ user: userId }).select("_id employeeId").lean();
  if (!profile) return { profile: null, items: [] as unknown[] };
  const items = await TeacherAssignment.find({ teacher: profile._id }).populate(ASSIGNMENT_POPULATE).sort({ createdAt: -1 }).lean();
  return { profile, items };
}
