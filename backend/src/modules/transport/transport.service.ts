
import { AppError } from "../../utils/AppError";
import { pageOptions } from "../website/website.service";
import { Bus, TransportRoute, TransportAllocation, MaintenanceRecord } from "./transport.model";
import { Student } from "../students/student.model";
import { ownStudent, parentLinkedStudentIds, type Actor } from "../academic-scope";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });

export async function createBus(input: Record<string, unknown>) {
  if (await Bus.findOne({ registrationNumber: input.registrationNumber }).lean()) throw new AppError(409, "REGISTRATION_EXISTS", "A vehicle with this registration number already exists");
  return Bus.create(input);
}
export async function listBuses(query: Record<string, unknown>) { const { page, limit } = pageOptions(query); const [items, total] = await Promise.all([Bus.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Bus.countDocuments()]); return { items, meta: meta(page, limit, total) }; }
export async function updateBus(id: string, input: Record<string, unknown>) { const doc = await Bus.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "BUS_NOT_FOUND", "Vehicle not found"); return doc; }
export async function createRoute(input: { name: string; stops: string[] }) { if (await TransportRoute.findOne({ name: input.name }).lean()) throw new AppError(409, "ROUTE_EXISTS", "A route with this name already exists"); return TransportRoute.create(input); }
export async function listRoutes() { return TransportRoute.find().sort({ name: 1 }).lean(); }
export async function updateRoute(id: string, input: Record<string, unknown>) { const doc = await TransportRoute.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "ROUTE_NOT_FOUND", "Route not found"); return doc; }

export async function createAllocation(input: { studentId: string; routeId: string; busId: string; stop: string; sessionId: string }) {
  const [student, route, bus] = await Promise.all([Student.findById(input.studentId).lean(), TransportRoute.findById(input.routeId).lean(), Bus.findById(input.busId).lean()]);
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  if (!route) throw new AppError(404, "ROUTE_NOT_FOUND", "Route not found");
  if (!bus) throw new AppError(404, "BUS_NOT_FOUND", "Vehicle not found");
  if (!(route.stops as string[]).includes(input.stop)) throw new AppError(422, "STOP_NOT_ON_ROUTE", "The chosen stop is not on this route");
  if (await TransportAllocation.findOne({ student: input.studentId, session: input.sessionId, status: "active" }).lean()) throw new AppError(409, "ALLOCATION_EXISTS", "This student already has an active transport allocation for this session");
  const used = await TransportAllocation.countDocuments({ bus: input.busId, session: input.sessionId, status: "active" });
  if (used >= bus.capacity) throw new AppError(409, "BUS_CAPACITY_FULL", `This vehicle is at capacity (${bus.capacity}) for this session`);
  return TransportAllocation.create({ student: input.studentId, route: input.routeId, bus: input.busId, stop: input.stop, session: input.sessionId });
}
export async function listAllocations(actor: Actor, query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (actor.role === "student") { const self = await ownStudent(actor.id); if (!self) throw new AppError(404, "STUDENT_PROFILE_NOT_LINKED", "No student record is linked to your account"); filter.student = self._id; }
  else if (actor.role === "parent") { const ids = await parentLinkedStudentIds(actor.id); filter.student = { $in: ids }; if (typeof query.studentId === "string" && !ids.includes(query.studentId)) throw new AppError(403, "FORBIDDEN", "This student is not linked to your account"); if (typeof query.studentId === "string") filter.student = query.studentId; }
  else if (typeof query.studentId === "string") filter.student = query.studentId;
  if (typeof query.sessionId === "string") filter.session = query.sessionId;
  if (typeof query.busId === "string") filter.bus = query.busId;
  const [items, total] = await Promise.all([TransportAllocation.find(filter).populate("student", "firstName lastName admissionNumber").populate("route", "name stops").populate("bus", "name registrationNumber driverName driverPhone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), TransportAllocation.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function cancelAllocation(id: string) { const doc = await TransportAllocation.findById(id); if (!doc) throw new AppError(404, "ALLOCATION_NOT_FOUND", "Allocation not found"); if (doc.status !== "active") throw new AppError(409, "ALREADY_CANCELLED", "This allocation is not active"); doc.status = "cancelled"; await doc.save(); return doc; }
export async function createMaintenance(actor: Actor, input: { busId: string; date: Date; type: string; cost: number; note?: string }) {
  if (!(await Bus.findById(input.busId).lean())) throw new AppError(404, "BUS_NOT_FOUND", "Vehicle not found");
  return MaintenanceRecord.create({ bus: input.busId, date: input.date, type: input.type, cost: input.cost, note: input.note, recordedBy: actor.id });
}
export async function listMaintenance(query: Record<string, unknown>) { const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {}; if (typeof query.busId === "string") filter.bus = query.busId; const [items, total] = await Promise.all([MaintenanceRecord.find(filter).populate("bus", "name registrationNumber").sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(), MaintenanceRecord.countDocuments(filter)]); return { items, meta: meta(page, limit, total) }; }
/** Vehicles with any document expiring within `days` (computed from stored dates — no cron, no fake notifications). */
export async function expiringDocuments(days: number) {
  const horizon = new Date(Date.now() + days * 86_400_000);
  const buses = await Bus.find({ isActive: true }).lean();
  const out: Array<Record<string, unknown>> = [];
  for (const b of buses) for (const [field, label] of [["insuranceExpiry", "Insurance"], ["registrationExpiry", "Registration"], ["fitnessExpiry", "Fitness certificate"]] as const) {
    const d = b[field] as Date | undefined; if (d && new Date(d) <= horizon) out.push({ busId: b._id, busName: b.name, registrationNumber: b.registrationNumber, document: label, expiryDate: d, expired: new Date(d) < new Date() });
  }
  return out.sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
}
