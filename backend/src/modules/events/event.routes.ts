import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import { requireDb } from "../../middleware/requireDb";
import { validate } from "../../middleware/validate";
import { eventCreateSchema, eventUpdateSchema } from "./event.validation";
import { appointmentCreateSchema, appointmentStatusSchema, appointmentUpdateSchema } from "./appointment.validation";
import * as svc from "./event.service";
import * as appt from "./appointment.service";

/**
 * Internal Events Calendar (§23) under /api/v1/events — Phase 9.
 * Reads: any authenticated role, audience-sliced in the service.
 * Writes: Admin/Principal (matrix: website/announcements + calendar publish).
 * Deletes: Admin only.
 */
const r = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const ALL = ["admin", "principal", "teacher", "student", "parent", "accountant", "librarian", "receptionist"] as const;

r.get("/", authenticate, authorize(...ALL), requireDb, wrap(async (req, res) => {
  const out = await svc.listEvents(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { events: out.items }, meta: out.meta });
}));
r.post("/", authenticate, authorize("admin", "principal"), validate(eventCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { event: await svc.createEvent(actor(req), req.body) } });
}));
r.get("/:id", authenticate, authorize(...ALL), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { event: await svc.getEvent(actor(req), req.params.id) } });
}));
r.patch("/:id", authenticate, authorize("admin", "principal"), validate(eventUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { event: await svc.updateEvent(actor(req), req.params.id, req.body) } });
}));
r.delete("/:id", authenticate, authorize("admin"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.deleteEvent(actor(req), req.params.id) });
}));

export default r;

/**
 * Receptionist Appointments (§15) under /api/v1/appointments — Phase 9.
 * Writes: Receptionist/Admin. Reads: Receptionist/Admin (all) + any staff
 * member for appointments where THEY are staffToMeet (service-scoped).
 */
export const appointmentRouter = Router();
appointmentRouter.get("/", authenticate, authorize("admin", "receptionist", "principal", "teacher", "accountant", "librarian"), requireDb, wrap(async (req, res) => {
  const out = await appt.listAppointments(actor(req), req.query as Record<string, unknown>);
  res.json({ success: true, data: { appointments: out.items }, meta: out.meta });
}));
appointmentRouter.post("/", authenticate, authorize("admin", "receptionist"), validate(appointmentCreateSchema), requireDb, wrap(async (req, res) => {
  res.status(201).json({ success: true, data: { appointment: await appt.createAppointment(actor(req), req.body) } });
}));
appointmentRouter.patch("/:id", authenticate, authorize("admin", "receptionist"), validate(appointmentUpdateSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { appointment: await appt.updateAppointment(actor(req), req.params.id, req.body) } });
}));
appointmentRouter.patch("/:id/status", authenticate, authorize("admin", "receptionist"), validate(appointmentStatusSchema), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: { appointment: await appt.setAppointmentStatus(actor(req), req.params.id, req.body.status, req.body.note) } });
}));
appointmentRouter.delete("/:id", authenticate, authorize("admin", "receptionist"), requireDb, wrap(async (req, res) => {
  res.json({ success: true, data: await appt.deleteAppointment(actor(req), req.params.id) });
}));
