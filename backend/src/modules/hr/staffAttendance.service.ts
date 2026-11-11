
import { AppError } from "../../utils/AppError";
import { pageOptions } from "../website/website.service";
import { StaffAttendance } from "./staffAttendance.model";
import { User } from "../users/user.model";
import type { Actor } from "../academic-scope";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });
const dayKey = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
async function assertStaffUser(userId: string) { const u = await User.findById(userId).select("role").lean(); if (!u) throw new AppError(404, "USER_NOT_FOUND", "User not found"); if (u.role === "student" || u.role === "parent") throw new AppError(422, "NOT_STAFF", "Staff attendance can only be marked for staff accounts"); }
export async function mark(actor: Actor, input: { userId: string; date: Date; status: string; note?: string }) {
  await assertStaffUser(input.userId); const date = dayKey(input.date);
  if (await StaffAttendance.findOne({ user: input.userId, date }).lean()) throw new AppError(409, "STAFF_ATTENDANCE_DUPLICATE", "Attendance for this staff member on this date already exists — update the record instead");
  return StaffAttendance.create({ user: input.userId, date, status: input.status, note: input.note, markedBy: actor.id });
}
export async function bulkMark(actor: Actor, input: { date: Date; records: Array<{ userId: string; status: string; note?: string }> }) {
  let created = 0; const errors: Array<Record<string, unknown>> = [];
  for (const rec of input.records) { try { await mark(actor, { ...rec, date: input.date }); created++; } catch (e) { errors.push({ userId: rec.userId, message: e instanceof Error ? e.message : String(e) }); } }
  return { created, errors, total: input.records.length };
}
export async function list(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  // Non-managers (teacher/librarian/receptionist/accountant/staff roles) see ONLY their own records.
  const MANAGERS = ["admin", "principal"];
  if (!MANAGERS.includes(actor.role)) filter.user = actor.id;
  else if (typeof query.userId === "string") filter.user = query.userId;
  if (typeof query.from === "string" || typeof query.to === "string") { const range: Record<string, unknown> = {}; if (typeof query.from === "string") range.$gte = new Date(query.from); if (typeof query.to === "string") range.$lte = new Date(query.to); filter.date = range; }
  if (typeof query.status === "string") filter.status = query.status;
  const [items, total] = await Promise.all([StaffAttendance.find(filter).populate("user", "name email role").sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(), StaffAttendance.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function update(actor: Actor, id: string, input: Record<string, unknown>) {
  const doc = await StaffAttendance.findById(id); if (!doc) throw new AppError(404, "RECORD_NOT_FOUND", "Staff attendance record not found");
  if (actor.role !== "admin" && actor.role !== "principal" && String(doc.user) !== actor.id) throw new AppError(403, "FORBIDDEN", "You can only view your own staff attendance");
  if (actor.role !== "admin" && actor.role !== "principal") throw new AppError(403, "FORBIDDEN", "Only Admin/Principal can correct staff attendance");
  Object.assign(doc, input); await doc.save(); return doc;
}
