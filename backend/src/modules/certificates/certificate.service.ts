
import { AppError } from "../../utils/AppError";
import { pageOptions } from "../website/website.service";
import { Certificate } from "./certificate.model";
import { Student } from "../students/student.model";
import { Invoice } from "../fees/fee.model";
import { ownStudent, parentLinkedStudentIds, type Actor } from "../academic-scope";
import { logActivity } from "../audit/audit.service";
import { notify, userIdsForStudents } from "../notifications/notification.service";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });

export async function outstandingBalanceMinor(studentId: string): Promise<number> {
  const invoices = await Invoice.find({ student: studentId, status: { $ne: "cancelled" } }).select("totalDue amountPaid").lean();
  return invoices.reduce((sum, i) => sum + Math.max(0, Number(i.totalDue) - Number(i.amountPaid)), 0);
}
async function nextReference(): Promise<string> {
  const prefix = `CERT-${new Date().getFullYear()}-`;
  const rx = new RegExp(`^${prefix}`);
  const total = await Certificate.countDocuments({ referenceNumber: rx });
  const last = (await Certificate.findOne({ referenceNumber: rx }).sort({ referenceNumber: -1 }).select("referenceNumber").lean())?.referenceNumber;
  let seq = total + 1;
  if (last) { const n = Number.parseInt(last.slice(prefix.length), 10); if (Number.isFinite(n) && n >= seq) seq = n + 1; }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}
export async function issueCertificate(actor: Actor, input: { studentId: string; type: string; issueDate?: Date; notes?: string }) {
  const student = await Student.findById(input.studentId).lean(); if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  if (input.type === "fee-clearance") {
    const balance = await outstandingBalanceMinor(input.studentId);
    if (balance > 0) throw new AppError(422, "OUTSTANDING_BALANCE", `Fee-clearance cannot be issued: the student has an outstanding balance of ${balance} minor units`, { outstandingBalanceMinor: balance });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const cert = await Certificate.create({ student: input.studentId, type: input.type, referenceNumber: await nextReference(), issueDate: input.issueDate ?? new Date(), issuedBy: actor.id, notes: input.notes });
      await logActivity({ actor, action: "certificate.issue", entityKind: "certificate", entityId: String(cert._id), summary: `Issued ${input.type} certificate ${cert.referenceNumber}`, metadata: { studentId: input.studentId, referenceNumber: cert.referenceNumber, type: input.type } });
      await notify({ userIds: await userIdsForStudents([input.studentId]).catch(() => []), type: "certificate-issued", title: "Certificate issued", body: `A ${input.type} certificate (${cert.referenceNumber}) has been issued and is available for download.`, related: { kind: "certificate", id: String(cert._id) }, createdBy: actor.id });
      return cert;
    }
    catch (e) { if ((e as { code?: number }).code === 11000 && attempt < 4) continue; throw e; }
  }
  throw new AppError(409, "REFERENCE_COLLISION", "Could not allocate a unique certificate reference");
}
export async function listCertificates(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (actor.role === "student") { const self = await ownStudent(actor.id); if (!self) throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your account"); filter.student = self._id; }
  else if (actor.role === "parent") { const ids = await parentLinkedStudentIds(actor.id); if (typeof query.studentId === "string" && !ids.includes(query.studentId)) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account"); filter.student = typeof query.studentId === "string" ? query.studentId : { $in: ids }; }
  else if (typeof query.studentId === "string") filter.student = query.studentId;
  if (typeof query.type === "string") filter.type = query.type;
  if (typeof query.status === "string") filter.status = query.status;
  const [items, total] = await Promise.all([Certificate.find(filter).populate("student", "firstName lastName admissionNumber").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Certificate.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function getCertificate(actor: Actor, id: string) {
  const doc = await Certificate.findById(id).populate("student", "firstName lastName admissionNumber").lean();
  if (!doc) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  if (actor.role === "student") { const self = await ownStudent(actor.id); if (!self || String(doc.student._id ?? doc.student) !== String(self._id)) throw new AppError(403, "FORBIDDEN", "You can only access your own certificates"); }
  if (actor.role === "parent") { const ids = await parentLinkedStudentIds(actor.id); if (!ids.includes(String((doc.student as { _id?: unknown })._id ?? doc.student))) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account"); }
  return doc;
}
export async function revokeCertificate(actor: Actor, id: string, reason: string) {
  const doc = await Certificate.findById(id); if (!doc) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  if (doc.status === "revoked") throw new AppError(409, "ALREADY_REVOKED", "This certificate is already revoked");
  doc.status = "revoked"; doc.revokeReason = reason; doc.revokedBy = actor.id as never; doc.revokedAt = new Date(); await doc.save();
  await logActivity({ actor, action: "certificate.revoke", entityKind: "certificate", entityId: String(doc._id), summary: `Revoked certificate ${doc.referenceNumber}`, metadata: { referenceNumber: doc.referenceNumber, reason } });
  return doc;
}
/** PUBLIC verification — minimal data only (name, type, issue date, status). */
export async function verifyReference(reference: string) {
  const doc = await Certificate.findOne({ referenceNumber: reference }).populate("student", "firstName lastName").lean();
  if (!doc) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "No certificate exists with this reference number");
  const st = doc.student as unknown as { firstName?: string; lastName?: string } | null;
  return { referenceNumber: doc.referenceNumber, studentName: st ? `${st.firstName ?? ""} ${st.lastName ?? ""}`.trim() : "", type: doc.type, issueDate: doc.issueDate, status: doc.status, valid: doc.status === "issued" };
}
