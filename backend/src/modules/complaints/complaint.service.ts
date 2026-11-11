
import { AppError } from "../../utils/AppError";
import { pageOptions } from "../website/website.service";
import { Complaint, DisciplineRecord } from "./complaint.model";
import { Student } from "../students/student.model";
import { ownStudent, parentLinkedStudentIds, type Actor } from "../academic-scope";
import { notify } from "../notifications/notification.service";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });
const MANAGERS = ["admin", "principal"];

export async function createComplaint(actor: Actor, input: { studentId?: string; category: string; description: string; attachmentName?: string }) {
  let studentId = input.studentId;
  if (actor.role === "student") { const self = await ownStudent(actor.id); if (!self) throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your account"); if (studentId && studentId !== String(self._id)) throw new AppError(403, "FORBIDDEN", "Students can only complain about their own record"); studentId = String(self._id); }
  if (actor.role === "parent") { if (!studentId) throw new AppError(422, "STUDENT_REQUIRED", "A parent complaint must name the child (studentId)"); const ids = await parentLinkedStudentIds(actor.id); if (!ids.includes(studentId)) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account"); }
  if (studentId && !(await Student.findById(studentId).lean())) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  return Complaint.create({ submittedBy: actor.id, submittedByRole: actor.role, student: studentId, category: input.category, description: input.description, attachmentName: input.attachmentName });
}
export async function listComplaints(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (MANAGERS.includes(actor.role)) { /* all */ }
  else if (actor.role === "receptionist") { /* routing view: all, assign-only actions enforced in transition() */ }
  else { filter.$or = [{ submittedBy: actor.id }, { assignedTo: actor.id }]; }
  if (typeof query.status === "string") filter.status = query.status;
  if (typeof query.category === "string") filter.category = query.category;
  const [items, total] = await Promise.all([Complaint.find(filter).populate("student", "firstName lastName admissionNumber").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Complaint.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
async function loadVisible(actor: Actor, id: string) {
  const doc = await Complaint.findById(id); if (!doc) throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  const visible = MANAGERS.includes(actor.role) || actor.role === "receptionist" || String(doc.submittedBy) === actor.id || String(doc.assignedTo ?? "") === actor.id;
  if (!visible) throw new AppError(403, "FORBIDDEN", "This complaint is not visible to you");
  return doc;
}
export async function getComplaint(actor: Actor, id: string) { return loadVisible(actor, id); }
export async function respond(actor: Actor, id: string, message: string) {
  const doc = await loadVisible(actor, id);
  const canRespond = MANAGERS.includes(actor.role) || String(doc.assignedTo ?? "") === actor.id || String(doc.submittedBy) === actor.id;
  if (!canRespond) throw new AppError(403, "FORBIDDEN", "You cannot respond to this complaint");
  if (doc.status === "closed") throw new AppError(409, "COMPLAINT_CLOSED", "This complaint is closed");
  doc.responses.push({ author: actor.id as never, authorRole: actor.role, message, at: new Date() });
  if (doc.status === "open" && MANAGERS.includes(actor.role)) doc.status = "in-progress";
  await doc.save(); return doc;
}
export async function transition(actor: Actor, id: string, input: { status: string; assignedTo?: string; resolutionNote?: string }) {
  const doc = await loadVisible(actor, id);
  const isManager = MANAGERS.includes(actor.role);
  const isAssignee = String(doc.assignedTo ?? "") === actor.id;
  // Receptionist may ONLY assign (routing): no status changes, no resolution.
  if (actor.role === "receptionist") {
    if (!input.assignedTo || input.status !== doc.status) throw new AppError(403, "FORBIDDEN", "Receptionists can only route complaints by assigning them");
  } else if (!isManager && !isAssignee) throw new AppError(403, "FORBIDDEN", "Only Admin/Principal or the assigned staff member can update this complaint");
  if (doc.status === "closed" && input.status !== "closed") throw new AppError(409, "COMPLAINT_CLOSED", "A closed complaint cannot be reopened");
  if (input.status === "resolved" && !input.resolutionNote && !doc.resolutionNote) throw new AppError(422, "RESOLUTION_NOTE_REQUIRED", "A resolution note is required to resolve a complaint");
  const statusChanged = input.status !== doc.status;
  doc.status = input.status as typeof doc.status;
  if (input.assignedTo) doc.assignedTo = input.assignedTo as never;
  if (input.resolutionNote) doc.resolutionNote = input.resolutionNote;
  await doc.save();
  // Phase 9 hook (§24): the submitter is notified when the status changes. Never throws.
  if (statusChanged && String(doc.submittedBy) !== actor.id) {
    await notify({
      userIds: [String(doc.submittedBy)], type: "complaint-updated", title: `Complaint ${input.status}`,
      body: `Your complaint (${doc.category}) is now "${input.status}".${input.resolutionNote ? ` Resolution note: ${input.resolutionNote}` : ""}`,
      related: { kind: "complaint", id: String(doc._id) }, createdBy: actor.id,
    });
  }
  return doc;
}
/* ---- Discipline: Admin/Principal ONLY (matrix) ---- */
export async function createDiscipline(actor: Actor, input: { studentId: string; incidentDate: Date; category: string; description: string; actionTaken: string }) {
  if (!(await Student.findById(input.studentId).lean())) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  return DisciplineRecord.create({ student: input.studentId, incidentDate: input.incidentDate, category: input.category, description: input.description, actionTaken: input.actionTaken, recordedBy: actor.id });
}
export async function listDiscipline(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (typeof query.studentId === "string") filter.student = query.studentId;
  if (typeof query.category === "string") filter.category = query.category;
  const [items, total] = await Promise.all([DisciplineRecord.find(filter).populate("student", "firstName lastName admissionNumber").sort({ incidentDate: -1 }).skip((page - 1) * limit).limit(limit).lean(), DisciplineRecord.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function updateDiscipline(id: string, input: Record<string, unknown>) { const doc = await DisciplineRecord.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "RECORD_NOT_FOUND", "Discipline record not found"); return doc; }
