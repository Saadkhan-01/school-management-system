import { AppError } from "../../utils/AppError";
import { requireObjectId, definedOnly } from "../../utils/helpers";
import { pageOptions } from "../website/website.service";
import { Appointment, type AppointmentStatus } from "./appointment.model";
import { User } from "../users/user.model";
import { notify } from "../notifications/notification.service";
import type { Actor } from "../academic-scope";

/**
 * Appointments service (§15) — Phase 9.
 * Create/update/status: Receptionist + Admin (front desk). Reads: Receptionist
 * + Admin see all; any other staff member sees ONLY appointments where they
 * are the staffToMeet (read-only — their route access is GET-only).
 * Overlap rule: a new/updated `scheduled` appointment may not overlap another
 * `scheduled` appointment for the same staff member → 409 STAFF_DOUBLE_BOOKED.
 */
const POPULATE = [
  { path: "staffToMeet", select: "name email role" },
  { path: "recordedBy", select: "name email role" },
];

async function assertNoOverlap(staffToMeet: string, scheduledAt: Date, durationMinutes: number, excludeId?: string) {
  const start = scheduledAt.getTime();
  const end = start + durationMinutes * 60_000;
  const sameDay = await Appointment.find({ staffToMeet, status: "scheduled", ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).lean();
  const clash = sameDay.find((a) => {
    const aStart = new Date(a.scheduledAt).getTime();
    const aEnd = aStart + a.durationMinutes * 60_000;
    return start < aEnd && aStart < end;
  });
  if (clash) throw new AppError(409, "STAFF_DOUBLE_BOOKED", "That staff member already has a scheduled appointment overlapping this time", { conflictingAppointmentId: String(clash._id) });
}

export interface AppointmentInput {
  visitorName: string; visitorPhone?: string; visitorEmail?: string; purpose: string;
  scheduledAt: Date; durationMinutes: number; staffToMeet: string; note?: string;
}

export async function createAppointment(actor: Actor, input: AppointmentInput) {
  const staff = await User.findById(input.staffToMeet).select("role isActive").lean();
  if (!staff) throw new AppError(404, "USER_NOT_FOUND", "staffToMeet user was not found");
  if (["student", "parent"].includes(staff.role)) throw new AppError(422, "VALIDATION_ERROR", "Appointments are with staff members, not student/parent accounts");
  await assertNoOverlap(input.staffToMeet, input.scheduledAt, input.durationMinutes);
  const doc = await Appointment.create({ ...input, recordedBy: actor.id });
  await notify({
    userIds: [input.staffToMeet], type: "appointment", title: "New appointment scheduled",
    body: `${input.visitorName} — ${input.purpose} at ${input.scheduledAt.toISOString()}`,
    related: { kind: "appointment", id: String(doc._id) }, createdBy: actor.id,
  });
  return Appointment.findById(doc._id).populate(POPULATE).lean();
}

export async function listAppointments(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query);
  const filter: Record<string, unknown> = {};
  if (actor.role !== "admin" && actor.role !== "receptionist") filter.staffToMeet = actor.id; // staff: own schedule only
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.staffToMeet === "string" && query.staffToMeet && (actor.role === "admin" || actor.role === "receptionist")) filter.staffToMeet = query.staffToMeet;
  const from = typeof query.from === "string" ? new Date(query.from) : null;
  const to = typeof query.to === "string" ? new Date(query.to) : null;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from && !Number.isNaN(from.getTime())) range.$gte = from;
    if (to && !Number.isNaN(to.getTime())) range.$lte = to;
    if (Object.keys(range).length) filter.scheduledAt = range;
  }
  const [items, total] = await Promise.all([
    Appointment.find(filter).populate(POPULATE).sort({ scheduledAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateAppointment(actor: Actor, id: string, input: Partial<AppointmentInput>) {
  requireObjectId(id, "Appointment");
  const doc = await Appointment.findById(id);
  if (!doc) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
  if (doc.status !== "scheduled") throw new AppError(409, "APPOINTMENT_FINAL", `A '${doc.status}' appointment can no longer be edited`);
  const staffToMeet = input.staffToMeet ?? String(doc.staffToMeet);
  const scheduledAt = input.scheduledAt ?? doc.scheduledAt;
  const duration = input.durationMinutes ?? doc.durationMinutes;
  if (input.staffToMeet || input.scheduledAt || input.durationMinutes) await assertNoOverlap(staffToMeet, new Date(scheduledAt), duration, id);
  Object.assign(doc, definedOnly(input as Record<string, unknown>));
  await doc.save();
  return Appointment.findById(doc._id).populate(POPULATE).lean();
}

export async function setAppointmentStatus(actor: Actor, id: string, status: AppointmentStatus, note?: string) {
  requireObjectId(id, "Appointment");
  const doc = await Appointment.findById(id);
  if (!doc) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
  if (doc.status !== "scheduled" && status !== doc.status) throw new AppError(409, "APPOINTMENT_FINAL", `This appointment is already '${doc.status}'`);
  doc.status = status;
  if (note) doc.note = note;
  await doc.save();
  return Appointment.findById(doc._id).populate(POPULATE).lean();
}

export async function deleteAppointment(_actor: Actor, id: string) {
  requireObjectId(id, "Appointment");
  const doc = await Appointment.findById(id);
  if (!doc) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
  if (doc.status === "scheduled") throw new AppError(409, "USE_CANCEL", "Cancel a scheduled appointment instead of deleting it, so the front-desk record is preserved");
  await doc.deleteOne();
  return { deleted: true };
}
