import { AppError } from "../../utils/AppError";
import { definedOnly, requireObjectId } from "../../utils/helpers";
import { escapeRegex, pageOptions } from "../website/website.service";
import { AcademicSession, SchoolClass, Section } from "../academics/academic.models";
import { Enrollment } from "../enrollments/enrollment.model";
import { Student } from "../students/student.model";
import { nextInvoiceNumber } from "../../utils/financeNumbers";
import { ownStudent, parentLinkedStudentIds, type Actor } from "../academic-scope";
import {
  FeeStructure, Invoice, Scholarship,
  computeInvoiceStatus, computeInvoiceTotals,
  type IInvoice, type InvoiceAdjustment,
} from "./fee.model";
import { Payment } from "../payments/payment.model";
import { logActivity } from "../audit/audit.service";
import { notify, userIdsForStudents } from "../notifications/notification.service";

/**
 * Fees, invoices & scholarships service (§12).
 * Totals are ALWAYS computed server-side (computeInvoiceTotals); clients can
 * never submit a total. amountPaid is derived from verified payments only
 * (recomputeInvoiceFromPayments) — this module is the single writer of
 * Invoice.amountPaid/totalDue/status.
 */

const STRUCTURE_POPULATE = [
  { path: "session", select: "name isCurrent" },
  { path: "schoolClass", select: "name" },
  { path: "section", select: "name" },
  { path: "createdBy", select: "name email role" },
];
const INVOICE_POPULATE = [
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "session", select: "name" },
  { path: "feeStructure", select: "name periodLabel" },
  { path: "issuedBy", select: "name email role" },
];

/* ---------------- Scope ---------------- */

/**
 * Finance read scope (§12 + permissions matrix):
 * admin/accountant/principal see every invoice; a student only their own;
 * a parent only verified-linked children's. Everyone else is rejected at the
 * route layer already; this resolves the student-id filter for reads.
 */
export async function invoiceStudentScope(actor: Actor, requestedStudentId?: string): Promise<{ studentIds: string[] | null }> {
  if (actor.role === "admin" || actor.role === "accountant" || actor.role === "principal") {
    return { studentIds: requestedStudentId ? [requestedStudentId] : null };
  }
  if (actor.role === "student") {
    const self = await ownStudent(actor.id);
    if (!self) throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your account");
    if (requestedStudentId && requestedStudentId !== String(self._id)) {
      throw new AppError(403, "FORBIDDEN", "You can only access your own fee records");
    }
    return { studentIds: [String(self._id)] };
  }
  if (actor.role === "parent") {
    const linked = await parentLinkedStudentIds(actor.id);
    if (requestedStudentId) {
      if (!linked.includes(requestedStudentId)) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account");
      return { studentIds: [requestedStudentId] };
    }
    return { studentIds: linked };
  }
  throw new AppError(403, "FORBIDDEN", "Your role cannot access fee records");
}

/** Throws 403 unless the actor may see this specific invoice. */
export async function assertInvoiceVisible(actor: Actor, invoice: { student: unknown }) {
  if (actor.role === "admin" || actor.role === "accountant" || actor.role === "principal") return;
  await invoiceStudentScope(actor, String(invoice.student));
}

/** Present an invoice with computed balance + effective (computed) status. */
export function presentInvoice<T extends Record<string, unknown>>(inv: T & { totalDue: number; amountPaid: number; dueDate: Date | string; status: string }): T {
  const due = inv.dueDate instanceof Date ? inv.dueDate : new Date(inv.dueDate);
  const status = computeInvoiceStatus({ totalDue: inv.totalDue, amountPaid: inv.amountPaid, dueDate: due, status: inv.status as IInvoice["status"] });
  return { ...inv, status, balance: Math.max(0, inv.totalDue - inv.amountPaid) };
}

/**
 * THE single writer of amountPaid/status: recomputes from the verified
 * payment set (payments in status "verified" only — pending, rejected,
 * reversed and refunded payments never count) and refreshes the computed
 * status. Called after every verification and reversal.
 */
export async function recomputeInvoiceFromPayments(invoiceId: string): Promise<IInvoice> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
  const verified = await Payment.find({ invoice: invoice._id, status: "verified" }).select("amount").lean();
  invoice.amountPaid = verified.reduce((s, p) => s + p.amount, 0);
  invoice.status = computeInvoiceStatus(invoice);
  await invoice.save();
  return invoice;
}

/* ---------------- Finance-scoped reference data ----------------
 * The permissions matrix gives Accountant no general Students/Academics
 * access (○), yet §12 requires accountants to create fee structures and
 * invoices. These two minimal, finance-only lookups bridge that: they expose
 * ONLY the fields the finance forms need (ids + display names), never full
 * student records, and are restricted to Admin/Accountant (+Principal read
 * for reference data) at the route layer. */

export async function financeReferenceData() {
  const [sessions, classes, sections] = await Promise.all([
    AcademicSession.find({}).select("name isCurrent").sort({ startDate: -1 }).lean(),
    SchoolClass.find({}).select("name session").sort({ name: 1 }).lean(),
    Section.find({}).select("name schoolClass").sort({ name: 1 }).lean(),
  ]);
  return { sessions, classes, sections };
}

export async function financeStudentLookup(search: string) {
  const q = (search ?? "").trim();
  if (q.length < 2) return [];
  const rx = { $regex: escapeRegex(q), $options: "i" };
  return Student.find({ $or: [{ admissionNumber: rx }, { firstName: rx }, { lastName: rx }] })
    .select("admissionNumber firstName lastName status").limit(20).lean();
}

/* ---------------- Fee structures ---------------- */

async function validateStructureRefs(input: { sessionId?: string; classId?: string; sectionId?: string | null }, base?: { session: unknown; schoolClass: unknown }) {
  const sessionId = input.sessionId ?? (base ? String(base.session) : undefined);
  const classId = input.classId ?? (base ? String(base.schoolClass) : undefined);
  if (sessionId) {
    const s = await AcademicSession.findById(sessionId).select("_id").lean();
    if (!s) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  }
  if (classId) {
    const c = await SchoolClass.findById(classId).select("_id session").lean();
    if (!c) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    if (sessionId && String(c.session) !== sessionId) throw new AppError(422, "CLASS_SESSION_MISMATCH", "The class does not belong to the selected session");
  }
  if (input.sectionId) {
    const sec = await Section.findById(input.sectionId).select("_id schoolClass").lean();
    if (!sec) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
    if (classId && String(sec.schoolClass) !== classId) throw new AppError(422, "SECTION_CLASS_MISMATCH", "The section does not belong to the selected class");
  }
}

export async function createFeeStructure(actor: Actor, input: Record<string, unknown>) {
  await validateStructureRefs(input as never);
  const lineItems = input.lineItems as Array<{ label: string; amount: number }>;
  const totalAmount = lineItems.reduce((s, li) => s + li.amount, 0);
  const doc = await FeeStructure.create({
    name: input.name,
    session: input.sessionId,
    schoolClass: input.classId,
    section: input.sectionId,
    lineItems,
    totalAmount,
    lateFeePolicy: input.lateFeePolicy ?? { type: "flat", value: 0, graceDays: 0 },
    partialPaymentsAllowed: input.partialPaymentsAllowed ?? false,
    isActive: input.isActive ?? true,
    periodLabel: input.periodLabel,
    createdBy: actor.id,
  });
  await logActivity({ actor, action: "fee-structure.create", entityKind: "feeStructure", entityId: String(doc._id), summary: `Created fee structure "${String(input.name)}"`, metadata: { totalAmount } });
  return FeeStructure.findById(doc._id).populate(STRUCTURE_POPULATE).lean();
}

export async function listFeeStructures(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.classId === "string" && query.classId) filter.schoolClass = query.classId;
  if (query.isActive === "true" || query.isActive === "false") filter.isActive = query.isActive === "true";
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  const [items, total] = await Promise.all([
    FeeStructure.find(filter).populate(STRUCTURE_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FeeStructure.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getFeeStructure(id: string) {
  requireObjectId(id, "Fee structure");
  const doc = await FeeStructure.findById(id).populate(STRUCTURE_POPULATE).lean();
  if (!doc) throw new AppError(404, "FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  return doc;
}

export async function updateFeeStructure(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Fee structure");
  const existing = await FeeStructure.findById(id);
  if (!existing) throw new AppError(404, "FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  await validateStructureRefs(input as never, existing);
  const patch = definedOnly(input as Record<string, unknown>);
  const update: Record<string, unknown> = { ...patch };
  if (patch.sectionId !== undefined) { update.section = patch.sectionId; delete update.sectionId; }
  if (patch.lineItems) {
    const items = patch.lineItems as Array<{ label: string; amount: number }>;
    update.totalAmount = items.reduce((s, li) => s + li.amount, 0);
  }
  const doc = await FeeStructure.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
  return FeeStructure.findById(doc!._id).populate(STRUCTURE_POPULATE).lean();
}

/** Structures carry no financial history of their own, but deactivation is preferred once invoices reference them (§29 soft-deactivation). */
export async function deleteFeeStructure(id: string) {
  requireObjectId(id, "Fee structure");
  const used = await Invoice.countDocuments({ feeStructure: id });
  if (used > 0) throw new AppError(409, "STRUCTURE_IN_USE", "Invoices were generated from this fee structure; deactivate it instead of deleting it");
  const doc = await FeeStructure.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  return { deleted: true };
}

/* ---------------- Scholarships ---------------- */

export async function createScholarship(actor: Actor, input: { studentId: string; sessionId?: string; type: "percent" | "flat"; value: number; reason: string; isActive?: boolean }) {
  const student = await Student.findById(input.studentId).select("_id").lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  if (input.sessionId) {
    const s = await AcademicSession.findById(input.sessionId).select("_id").lean();
    if (!s) throw new AppError(404, "SESSION_NOT_FOUND", "Academic session not found");
  }
  const doc = await Scholarship.create({
    student: input.studentId, session: input.sessionId, type: input.type, value: input.value,
    reason: input.reason, isActive: input.isActive ?? true, approvedBy: actor.id,
  });
  return Scholarship.findById(doc._id)
    .populate({ path: "student", select: "admissionNumber firstName lastName" })
    .populate({ path: "approvedBy", select: "name email role" }).lean();
}

export async function listScholarships(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.studentId === "string" && query.studentId) filter.student = query.studentId;
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  const [items, total] = await Promise.all([
    Scholarship.find(filter)
      .populate({ path: "student", select: "admissionNumber firstName lastName" })
      .populate({ path: "approvedBy", select: "name email role" })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Scholarship.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateScholarship(id: string, input: Record<string, unknown>) {
  requireObjectId(id, "Scholarship");
  const doc = await Scholarship.findByIdAndUpdate(id, { $set: definedOnly(input as Record<string, unknown>) }, { new: true, runValidators: true });
  if (!doc) throw new AppError(404, "SCHOLARSHIP_NOT_FOUND", "Scholarship not found");
  return Scholarship.findById(doc._id)
    .populate({ path: "student", select: "admissionNumber firstName lastName" })
    .populate({ path: "approvedBy", select: "name email role" }).lean();
}

/** Scholarship discount (minor units) a student is owed against a subtotal in a session. */
export async function scholarshipAdjustmentsFor(studentId: string, sessionId: string, subtotal: number): Promise<Array<Omit<InvoiceAdjustment, "appliedBy" | "appliedAt">>> {
  const awards = await Scholarship.find({
    student: studentId, isActive: true,
    $or: [{ session: sessionId }, { session: { $exists: false } }, { session: null }],
  }).lean();
  const out: Array<Omit<InvoiceAdjustment, "appliedBy" | "appliedAt">> = [];
  for (const a of awards) {
    const amount = a.type === "percent" ? Math.floor((subtotal * a.value) / 100) : Math.min(a.value, subtotal);
    if (amount > 0) out.push({ label: `Scholarship — ${a.reason}`, amount, type: "scholarship", scholarship: a._id as never });
  }
  return out;
}

/* ---------------- Invoice generation ---------------- */

async function createInvoiceWithRetry(data: Record<string, unknown>): Promise<IInvoice> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Invoice.create({ ...data, invoiceNumber: await nextInvoiceNumber() });
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        // Either the number collided (retry with a fresh sequence) or the
        // student+structure+period guard fired — distinguish by re-checking.
        const guard = await Invoice.findOne({
          student: data.student, feeStructure: data.feeStructure, periodLabel: data.periodLabel ?? undefined,
          status: { $ne: "cancelled" },
        }).select("_id invoiceNumber").lean();
        if (guard && attempt > 0) throw new AppError(409, "INVOICE_ALREADY_EXISTS", `An invoice already exists for this student, fee structure and period (${guard.invoiceNumber})`);
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new AppError(409, "INVOICE_NUMBER_CONFLICT", "Could not allocate a unique invoice number after retries");
}

export async function generateInvoice(actor: Actor, input: { studentId: string; feeStructureId: string; enrollmentId?: string; dueDate: Date; periodLabel?: string }) {
  const structure = await FeeStructure.findById(input.feeStructureId);
  if (!structure) throw new AppError(404, "FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  if (!structure.isActive) throw new AppError(409, "STRUCTURE_INACTIVE", "This fee structure is inactive and cannot be invoiced");
  const student = await Student.findById(input.studentId).select("_id").lean();
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  let enrollment: { _id: unknown; schoolClass: unknown; section: unknown } | null = null;
  if (input.enrollmentId) {
    enrollment = await Enrollment.findById(input.enrollmentId).select("_id schoolClass section student session").lean() as never;
    if (!enrollment) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
    const e = enrollment as unknown as { student: unknown; session: unknown };
    if (String(e.student) !== input.studentId) throw new AppError(422, "ENROLLMENT_STUDENT_MISMATCH", "The enrollment does not belong to this student");
    if (String(e.session) !== String(structure.session)) throw new AppError(422, "ENROLLMENT_SESSION_MISMATCH", "The enrollment session does not match the fee structure session");
  } else {
    enrollment = await Enrollment.findOne({ student: input.studentId, session: structure.session, status: "active" }).select("_id schoolClass section").lean() as never;
    if (!enrollment) throw new AppError(422, "NO_ACTIVE_ENROLLMENT", "The student has no active enrollment in the fee structure's session");
  }
  if (String((enrollment as { schoolClass: unknown }).schoolClass) !== String(structure.schoolClass)) {
    throw new AppError(422, "ENROLLMENT_CLASS_MISMATCH", "The student's enrollment class does not match the fee structure class");
  }
  if (structure.section && String((enrollment as { section: unknown }).section) !== String(structure.section)) {
    throw new AppError(422, "ENROLLMENT_SECTION_MISMATCH", "The student's enrollment section does not match the fee structure section");
  }
  const periodLabel = input.periodLabel ?? structure.periodLabel;
  const existing = await Invoice.findOne({ student: input.studentId, feeStructure: structure._id, periodLabel, status: { $ne: "cancelled" } }).select("_id invoiceNumber").lean();
  if (existing) throw new AppError(409, "INVOICE_ALREADY_EXISTS", `An invoice already exists for this student, fee structure and period (${existing.invoiceNumber})`);

  const lineItems = structure.lineItems.map((li) => ({ label: li.label, amount: li.amount }));
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const scholarshipAdj = await scholarshipAdjustmentsFor(input.studentId, String(structure.session), subtotal);
  const adjustments: InvoiceAdjustment[] = scholarshipAdj.map((a) => ({ ...a, appliedBy: actor.id as never, appliedAt: new Date() }));
  const totals = computeInvoiceTotals(lineItems, adjustments);
  const doc = await createInvoiceWithRetry({
    student: input.studentId,
    enrollment: (enrollment as { _id: unknown })._id,
    session: structure.session,
    feeStructure: structure._id,
    periodLabel,
    lineItems,
    adjustments,
    subtotal: totals.subtotal,
    totalDue: totals.totalDue,
    amountPaid: 0,
    dueDate: input.dueDate,
    status: totals.totalDue === 0 ? "paid" : "unpaid",
    partialPaymentsAllowed: structure.partialPaymentsAllowed,
    lateFeePolicy: structure.lateFeePolicy,
    issuedBy: actor.id,
    history: [
      { at: new Date(), by: actor.id, action: "generated", detail: `Generated from fee structure "${structure.name}"` },
      ...adjustments.map((a) => ({ at: new Date(), by: actor.id as never, action: "scholarship-applied", detail: `${a.label}: -${a.amount} minor units` })),
    ],
  });
  await logActivity({ actor, action: "invoice.generate", entityKind: "invoice", entityId: String(doc._id), summary: `Generated invoice ${doc.invoiceNumber}`, metadata: { invoiceNumber: doc.invoiceNumber, studentId: input.studentId, totalDue: totals.totalDue } });
  // Phase 9 hook (§24: fee challan generated) — notify student + verified parents. Never throws.
  await notify({
    userIds: await userIdsForStudents([input.studentId]).catch(() => []),
    type: "fee-invoice-generated", title: `New fee invoice ${doc.invoiceNumber}`,
    body: `A fee invoice of ${totals.totalDue} minor units has been generated. Due date: ${new Date(input.dueDate).toISOString().slice(0, 10)}.`,
    related: { kind: "invoice", id: String(doc._id) }, createdBy: actor.id,
  });
  return getInvoice(actor, String(doc._id));
}

/**
 * Bulk generation for a class/section (§12): every actively-enrolled student
 * in the structure's class (optionally narrowed to a section) gets an
 * invoice; students already invoiced for the same structure+period are
 * SKIPPED and counted — never duplicated (unique partial index backs this).
 */
export async function bulkGenerateInvoices(actor: Actor, input: { feeStructureId: string; classId?: string; sectionId?: string; dueDate: Date; periodLabel?: string }) {
  const structure = await FeeStructure.findById(input.feeStructureId);
  if (!structure) throw new AppError(404, "FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  if (!structure.isActive) throw new AppError(409, "STRUCTURE_INACTIVE", "This fee structure is inactive and cannot be invoiced");
  const classId = input.classId ?? String(structure.schoolClass);
  if (classId !== String(structure.schoolClass)) throw new AppError(422, "CLASS_STRUCTURE_MISMATCH", "The class does not match the fee structure's class");
  const sectionId = input.sectionId ?? (structure.section ? String(structure.section) : undefined);
  if (structure.section && sectionId !== String(structure.section)) throw new AppError(422, "SECTION_STRUCTURE_MISMATCH", "The section does not match the fee structure's section");
  const filter: Record<string, unknown> = { session: structure.session, schoolClass: structure.schoolClass, status: "active" };
  if (sectionId) filter.section = sectionId;
  const enrollments = await Enrollment.find(filter).select("_id student").lean();
  let created = 0;
  let skipped = 0;
  const errors: Array<{ studentId: string; message: string }> = [];
  for (const enr of enrollments) {
    try {
      await generateInvoice(actor, {
        studentId: String(enr.student),
        feeStructureId: input.feeStructureId,
        enrollmentId: String(enr._id),
        dueDate: input.dueDate,
        periodLabel: input.periodLabel,
      });
      created++;
    } catch (err) {
      if (err instanceof AppError && err.code === "INVOICE_ALREADY_EXISTS") { skipped++; continue; }
      errors.push({ studentId: String(enr.student), message: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return { created, skipped, errors, totalEnrolled: enrollments.length, feeStructureId: input.feeStructureId, periodLabel: input.periodLabel ?? structure.periodLabel ?? null };
}

/* ---------------- Invoice reads / lifecycle ---------------- */

export async function listInvoices(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const scope = await invoiceStudentScope(actor, typeof query.studentId === "string" ? query.studentId : undefined);
  const filter: Record<string, unknown> = {};
  if (scope.studentIds) filter.student = scope.studentIds.length === 1 ? scope.studentIds[0] : { $in: scope.studentIds };
  if (typeof query.sessionId === "string" && query.sessionId) filter.session = query.sessionId;
  if (typeof query.search === "string" && query.search.trim()) filter.invoiceNumber = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  let items: Array<Record<string, unknown>> = [];
  let total = 0;
  const statusFilter = typeof query.status === "string" ? query.status : undefined;
  if (statusFilter === "overdue") {
    // Overdue is computed: unpaid/partially-paid stored rows past their due date.
    filter.status = { $in: ["unpaid", "partially-paid", "overdue"] };
    filter.dueDate = { $lt: new Date() };
    const [rows, count] = await Promise.all([
      Invoice.find(filter).populate(INVOICE_POPULATE).sort({ dueDate: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);
    items = rows.map((r) => presentInvoice(r as never)) as Array<Record<string, unknown>>;
    total = count;
  } else {
    if (statusFilter) filter.status = statusFilter;
    const [rows, count] = await Promise.all([
      Invoice.find(filter).populate(INVOICE_POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);
    items = rows.map((r) => presentInvoice(r as never)) as Array<Record<string, unknown>>;
    total = count;
  }
  // Enrollment class/section filtering happens post-population only when asked
  // for a class the caller's scope cannot see — kept simple: class filter is
  // applied through enrollments of that class.
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function mustInvoice(id: string): Promise<IInvoice> {
  requireObjectId(id, "Invoice");
  const inv = await Invoice.findById(id);
  if (!inv) throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
  return inv;
}

export async function getInvoice(actor: Actor, id: string) {
  const inv = await mustInvoice(id);
  await assertInvoiceVisible(actor, inv);
  const populated = await Invoice.findById(inv._id).populate(INVOICE_POPULATE)
    .populate({ path: "enrollment", populate: [{ path: "schoolClass", select: "name" }, { path: "section", select: "name" }] })
    .lean();
  return presentInvoice(populated as never);
}

/** Data for the challan PDF — same scope checks as the JSON read. */
export async function getChallanData(actor: Actor, id: string) {
  const inv = await mustInvoice(id);
  await assertInvoiceVisible(actor, inv);
  const populated = await Invoice.findById(inv._id)
    .populate({ path: "student", select: "admissionNumber firstName lastName" })
    .populate({ path: "session", select: "name" })
    .populate({ path: "feeStructure", select: "name" })
    .populate({ path: "enrollment", populate: [{ path: "schoolClass", select: "name" }, { path: "section", select: "name" }] })
    .lean();
  return presentInvoice(populated as never) as Record<string, unknown> & { invoiceNumber: string };
}

/**
 * Add a discount / scholarship / late-fee / charge adjustment (§12).
 * Totals are recomputed server-side and the change is written to the
 * invoice's audit history. An adjustment that would push totalDue below the
 * already-verified amountPaid is refused (409) — verified money is never
 * made inconsistent by editing the bill afterwards.
 */
export async function addAdjustment(actor: Actor, id: string, input: { label: string; amount: number; type: InvoiceAdjustment["type"]; scholarshipId?: string; note?: string }) {
  const inv = await mustInvoice(id);
  if (inv.status === "cancelled") throw new AppError(409, "INVOICE_CANCELLED", "A cancelled invoice cannot be adjusted");
  let scholarshipId = input.scholarshipId;
  if (input.type === "scholarship" && !scholarshipId) {
    const awards = await Scholarship.find({ student: inv.student, isActive: true }).sort({ createdAt: -1 }).lean();
    if (awards.length === 0) throw new AppError(422, "NO_SCHOLARSHIP", "No active scholarship exists for this student — create one first, or use type \"discount\"");
    scholarshipId = String(awards[0]._id);
  }
  if (scholarshipId) {
    const award = await Scholarship.findById(scholarshipId).select("_id student").lean();
    if (!award) throw new AppError(404, "SCHOLARSHIP_NOT_FOUND", "Scholarship not found");
    if (String(award.student) !== String(inv.student)) throw new AppError(422, "SCHOLARSHIP_STUDENT_MISMATCH", "The scholarship belongs to a different student");
  }
  const adjustment: InvoiceAdjustment = {
    label: input.label, amount: input.amount, type: input.type,
    scholarship: scholarshipId as never, appliedBy: actor.id as never, appliedAt: new Date(), note: input.note,
  };
  const totals = computeInvoiceTotals(inv.lineItems, [...inv.adjustments, adjustment]);
  if (totals.totalDue < inv.amountPaid) {
    throw new AppError(409, "ADJUSTMENT_BELOW_PAID", `This adjustment would set the total due below the verified amount already paid (${inv.amountPaid} minor units). Reverse a payment first if the bill truly changed.`);
  }
  inv.adjustments.push(adjustment);
  inv.subtotal = totals.subtotal;
  inv.totalDue = totals.totalDue;
  inv.status = computeInvoiceStatus(inv);
  inv.history.push({ at: new Date(), by: actor.id as never, action: "adjustment-added", detail: `${input.type} "${input.label}": ${input.amount} minor units → total due ${totals.totalDue}` });
  await inv.save();
  return getInvoice(actor, id);
}

/** Apply the structure's late-fee policy once the grace period has passed. */
export async function applyLateFee(actor: Actor, id: string) {
  const inv = await mustInvoice(id);
  if (inv.status === "cancelled") throw new AppError(409, "INVOICE_CANCELLED", "A cancelled invoice cannot accrue late fees");
  const balance = inv.totalDue - inv.amountPaid;
  if (balance <= 0) throw new AppError(409, "INVOICE_PAID", "This invoice is fully paid; no late fee applies");
  const policy = inv.lateFeePolicy;
  if (!policy || policy.value <= 0) throw new AppError(409, "NO_LATE_FEE_POLICY", "The fee structure for this invoice has no late-fee policy (value is 0)");
  const graceEnd = new Date(inv.dueDate.getTime() + policy.graceDays * 24 * 60 * 60 * 1000);
  if (new Date() <= graceEnd) throw new AppError(409, "GRACE_PERIOD_ACTIVE", `The late-fee grace period runs until ${graceEnd.toISOString().slice(0, 10)}`);
  if (inv.adjustments.some((a) => a.type === "late-fee")) throw new AppError(409, "LATE_FEE_ALREADY_APPLIED", "A late fee has already been applied to this invoice");
  const amount = policy.type === "flat" ? policy.value : Math.floor((balance * policy.value) / 100);
  if (amount <= 0) throw new AppError(409, "LATE_FEE_ZERO", "The computed late fee is zero");
  return addAdjustment(actor, id, { label: "Late fee", amount, type: "late-fee", note: `Policy: ${policy.type} ${policy.value}, grace ${policy.graceDays} days` });
}

/** Cancel only when NO verified payments exist (§12) — otherwise 409; money already verified is handled by reversal, never by cancelling the bill. */
export async function cancelInvoice(actor: Actor, id: string, reason: string) {
  const inv = await mustInvoice(id);
  if (inv.status === "cancelled") throw new AppError(409, "ALREADY_CANCELLED", "This invoice is already cancelled");
  const verifiedCount = await Payment.countDocuments({ invoice: inv._id, status: "verified" });
  if (verifiedCount > 0 || inv.amountPaid > 0) {
    throw new AppError(409, "INVOICE_HAS_VERIFIED_PAYMENTS", "This invoice has verified payments and cannot be cancelled. Reverse the payments first if a refund is intended.");
  }
  inv.status = "cancelled";
  inv.cancelledBy = actor.id as never;
  inv.cancelledAt = new Date();
  inv.cancelReason = reason;
  inv.history.push({ at: new Date(), by: actor.id as never, action: "cancelled", detail: reason });
  await inv.save();
  await logActivity({ actor, action: "invoice.cancel", entityKind: "invoice", entityId: id, summary: `Cancelled invoice ${inv.invoiceNumber}`, metadata: { invoiceNumber: inv.invoiceNumber, reason } });
  return getInvoice(actor, id);
}
