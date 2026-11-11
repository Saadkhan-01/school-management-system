import { AppError } from "../../utils/AppError";
import { requireObjectId } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { LeaveApplication, type LeaveType } from "./leave.model";
import { normalizeDay } from "../attendance/attendance.model";
import { assertStudentVisible, type Actor } from "../academic-scope";
import { notify } from "../notifications/notification.service";

/**
 * Leave service (§9/§11/§13, docs/permissions.md "HR/leave approve"):
 *  - staff (teacher/accountant/librarian/receptionist/principal) apply for
 *    themselves; parents apply only for verified-linked children;
 *  - Admin/Principal decide (Principal approves teacher leave per matrix);
 *  - lists are scoped: staff/parents see only their own applications,
 *    Admin/Principal see all (filterable).
 */
const POPULATE = [
  { path: "applicantUser", select: "name email role" },
  { path: "student", select: "admissionNumber firstName lastName" },
  { path: "decidedBy", select: "name email" },
];
const STAFF_LEAVE_ROLES = ["teacher", "accountant", "librarian", "receptionist", "principal", "admin"];

export async function createLeave(actor: Actor, input: { studentId?: string; leaveType: LeaveType; fromDate: Date; toDate: Date; reason: string }) {
  if (actor.role === "parent") {
    if (!input.studentId) throw new AppError(422, "VALIDATION_ERROR", "studentId is required when a parent applies for leave");
    await assertStudentVisible(actor, input.studentId);
    return LeaveApplication.create({
      applicantUser: actor.id, applicantRole: actor.role, student: input.studentId,
      leaveType: input.leaveType, fromDate: input.fromDate, toDate: input.toDate, reason: input.reason,
    });
  }
  if (STAFF_LEAVE_ROLES.includes(actor.role)) {
    if (input.studentId) throw new AppError(422, "VALIDATION_ERROR", "Staff leave is for yourself — do not pass studentId");
    return LeaveApplication.create({
      applicantUser: actor.id, applicantRole: actor.role, student: null,
      leaveType: input.leaveType, fromDate: input.fromDate, toDate: input.toDate, reason: input.reason,
    });
  }
  throw new AppError(403, "FORBIDDEN", "Your role cannot apply for leave");
}

export async function listLeave(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.applicantRole === "string" && query.applicantRole) filter.applicantRole = query.applicantRole;
  if (typeof query.studentId === "string" && query.studentId) filter.student = query.studentId;
  if (actor.role !== "admin" && actor.role !== "principal") filter.applicantUser = actor.id;
  const [items, total] = await Promise.all([
    LeaveApplication.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    LeaveApplication.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getLeave(actor: Actor, id: string) {
  requireObjectId(id, "Leave application");
  const doc = await LeaveApplication.findById(id).populate(POPULATE).lean();
  if (!doc) throw new AppError(404, "LEAVE_NOT_FOUND", "Leave application not found");
  if (actor.role !== "admin" && actor.role !== "principal" && String(doc.applicantUser) !== actor.id) {
    throw new AppError(403, "FORBIDDEN", "You can only view your own leave applications");
  }
  return doc;
}

export async function decideLeave(actor: Actor, id: string, input: { status: "approved" | "rejected"; decisionNote?: string }) {
  requireObjectId(id, "Leave application");
  const doc = await LeaveApplication.findById(id);
  if (!doc) throw new AppError(404, "LEAVE_NOT_FOUND", "Leave application not found");
  if (doc.status !== "pending") throw new AppError(409, "ALREADY_DECIDED", `This application has already been ${doc.status}`);
  doc.status = input.status;
  doc.decidedBy = actor.id as never;
  doc.decidedAt = new Date();
  if (input.decisionNote) doc.decisionNote = input.decisionNote;
  await doc.save();
  const decided = await LeaveApplication.findById(doc._id).populate(POPULATE).lean();
  // Phase 9 hook (§24): notify the applicant of the decision. Never throws.
  await notify({
    userIds: [String(doc.applicantUser)], type: "leave-decided",
    title: `Leave application ${input.status}`,
    body: `Your ${doc.leaveType} leave (${doc.fromDate.toISOString().slice(0, 10)} → ${doc.toDate.toISOString().slice(0, 10)}) has been ${input.status}.${input.decisionNote ? ` Note: ${input.decisionNote}` : ""}`,
    related: { kind: "leave", id: String(doc._id) }, createdBy: actor.id,
  });
  return decided;
}

/** Approved leave overlapping a given day — both staff and student leave (attendance context + HR views). */
export async function approvedOn(dateInput: Date) {
  const day = normalizeDay(dateInput);
  return LeaveApplication.find({ status: "approved", fromDate: { $lte: day }, toDate: { $gte: day } }).populate(POPULATE).lean();
}
